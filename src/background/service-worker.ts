import { ExtensionMessage, ExtensionMessageResponse } from '../shared/types';

/**
 * Chrome Extension Manifest V3 Background Service Worker
 * Coordinates Side Panel opening (both from toolbar and Popup),
 * activeTab screenshot capture (Vision mode), and safe message routing
 * between Side Panel / Popup and Content Script.
 */

const chromeGlobal = (globalThis as Record<string, any>).chrome;

const DEFAULT_API_BASE = 'http://localhost:3000/api/ai';

/**
 * Sends a message to the active tab's content script.
 * If the content script is not yet injected (e.g. tab was open before extension load),
 * dynamically injects content/content-script.js and retries sending the message.
 */
function sendToTabWithAutoInject(
  tabId: number,
  message: ExtensionMessage,
  callback?: (res: ExtensionMessageResponse) => void
): void {
  if (!chromeGlobal?.tabs?.sendMessage) {
    callback?.({ ok: false, error: 'Tabs API unavailable' });
    return;
  }

  chromeGlobal.tabs.sendMessage(
    tabId,
    message,
    (response: ExtensionMessageResponse) => {
      if (!chromeGlobal.runtime.lastError) {
        callback?.(response || { ok: true });
        return;
      }

      // Content script not yet running in this tab — inject it dynamically if scripting API is available
      if (chromeGlobal.scripting?.executeScript) {
        chromeGlobal.scripting.executeScript(
          {
            target: { tabId },
            files: ['content/content-script.js'],
          },
          () => {
            if (chromeGlobal.runtime.lastError) {
              callback?.({
                ok: false,
                error:
                  chromeGlobal.runtime.lastError.message ||
                  'Cannot inject content script on this page.',
              });
              return;
            }
            setTimeout(() => {
              chromeGlobal.tabs.sendMessage(
                tabId,
                message,
                (retryRes: ExtensionMessageResponse) => {
                  if (chromeGlobal.runtime.lastError) {
                    callback?.({
                      ok: false,
                      error:
                        chromeGlobal.runtime.lastError.message ||
                        'Content script unavailable after injection.',
                    });
                  } else {
                    callback?.(retryRes || { ok: true });
                  }
                }
              );
            }, 60);
          }
        );
      } else {
        callback?.({
          ok: false,
          error:
            chromeGlobal.runtime.lastError.message ||
            'Content script unavailable on this page.',
        });
      }
    }
  );
}

if (chromeGlobal?.runtime) {
  chromeGlobal.runtime.onInstalled.addListener(() => {
    if (chromeGlobal.sidePanel?.setPanelBehavior) {
      chromeGlobal.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: false })
        .catch((err: unknown) =>
          console.warn('[M3ak SW] SidePanel behavior setup:', err)
        );
    }
  });

  // Primary Flow: Clicking the M3ak extension icon toggles the in-page floating assistant
  if (chromeGlobal.action?.onClicked) {
    chromeGlobal.action.onClicked.addListener(
      (tab: { id?: number; url?: string; windowId?: number }) => {
        const tabId = tab?.id;
        const tabUrl = tab?.url || '';

        const isRestrictedPage =
          !tabId ||
          tabUrl.startsWith('chrome://') ||
          tabUrl.startsWith('edge://') ||
          tabUrl.startsWith('about:') ||
          tabUrl.startsWith('chrome-extension://');

        if (isRestrictedPage) {
          // Fallback on restricted browser pages where content scripts are blocked by Chrome
          if (chromeGlobal.sidePanel?.open && typeof tab?.windowId === 'number') {
            chromeGlobal.sidePanel.open({ windowId: tab.windowId }).catch(() => {
              // ignore
            });
          }
          return;
        }

        sendToTabWithAutoInject(tabId, { type: 'TOGGLE_M3AK_ASSISTANT' });
      }
    );
  }

  chromeGlobal.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      sender: Record<string, any>,
      sendResponse: (res: ExtensionMessageResponse) => void
    ) => {
      if (!message || typeof message.type !== 'string') {
        sendResponse({ ok: false, error: 'Invalid extension message' });
        return false;
      }

      // 0. Proxy AI API requests from Content Script to Backend Server (avoids CORS/Mixed-Content)
      if (message.type === 'AI_API_REQUEST') {
        const { endpoint, body } = message.payload || {};
        if (!endpoint) {
          sendResponse({ ok: false, error: 'Missing AI endpoint' });
          return false;
        }

        fetch(`${DEFAULT_API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body || {}),
        })
          .then(async (res) => {
            if (!res.ok) {
              sendResponse({ ok: false, error: `HTTP_${res.status}` });
              return;
            }
            const data = await res.json();
            sendResponse({ ok: true, data });
          })
          .catch((err: Error) => {
            sendResponse({
              ok: false,
              error: err?.message || 'AI backend unreachable',
            });
          });
        return true;
      }

      // 1. Open Side Panel (fallback / optional secondary view)
      if (message.type === 'OPEN_SIDE_PANEL') {
        if (!chromeGlobal.sidePanel?.open) {
          sendResponse({
            ok: false,
            error: 'Chrome Side Panel API is not supported in this browser.',
          });
          return false;
        }

        const openForWindowId = (windowId?: number) => {
          if (typeof windowId !== 'number') {
            sendResponse({
              ok: false,
              error: 'No active browser window found.',
            });
            return;
          }
          chromeGlobal.sidePanel
            .open({ windowId })
            .then(() => sendResponse({ ok: true }))
            .catch((err: Error) =>
              sendResponse({ ok: false, error: err.message })
            );
        };

        if (sender?.tab?.windowId) {
          openForWindowId(sender.tab.windowId);
        } else if (chromeGlobal.tabs?.query) {
          chromeGlobal.tabs.query(
            { active: true, currentWindow: true },
            (tabs: Array<{ id?: number; windowId?: number }>) => {
              if (chromeGlobal.runtime.lastError || !tabs || tabs.length === 0) {
                sendResponse({
                  ok: false,
                  error:
                    chromeGlobal.runtime.lastError?.message ||
                    'No active tab found',
                });
                return;
              }
              openForWindowId(tabs[0].windowId);
            }
          );
        } else {
          sendResponse({ ok: false, error: 'Unable to resolve windowId' });
        }
        return true;
      }

      // 2. Capture Visible Tab Screenshot for Vision Mode
      if (message.type === 'CAPTURE_SCREENSHOT') {
        if (!chromeGlobal.tabs?.captureVisibleTab) {
          sendResponse({
            ok: false,
            error: 'Screenshot capture API unavailable',
          });
          return false;
        }

        chromeGlobal.tabs.captureVisibleTab(
          null,
          { format: 'jpeg', quality: 75 },
          (dataUrl: string) => {
            if (chromeGlobal.runtime.lastError || !dataUrl) {
              sendResponse({
                ok: false,
                error:
                  chromeGlobal.runtime.lastError?.message ||
                  'Failed to capture visible tab',
              });
            } else {
              sendResponse({ ok: true, screenshotDataUrl: dataUrl });
            }
          }
        );
        return true;
      }

      // 3. Browser Agent Tab Control & Web Research Navigation
      if (message.type === 'BROWSER_AGENT_ACTION') {
        const { browserAction, url, query } = message.payload || {};
        if (!chromeGlobal.tabs) {
          sendResponse({ ok: false, error: 'Chrome Tabs API unavailable' });
          return false;
        }

        const resolveActiveTab = (
          cb: (tab: { id?: number; windowId?: number } | null) => void
        ) => {
          if (sender?.tab?.id) {
            cb(sender.tab);
            return;
          }
          chromeGlobal.tabs.query(
            { active: true, currentWindow: true },
            (tabs: Array<{ id?: number; windowId?: number }>) => {
              cb(tabs?.[0] || null);
            }
          );
        };

        if (browserAction === 'open_tab' && url) {
          chromeGlobal.tabs.create({ url, active: true }, (newTab: any) => {
            sendResponse({ ok: true, data: { tabId: newTab?.id, url } });
          });
          return true;
        }

        if (
          (browserAction === 'navigate_url' ||
            browserAction === 'open_search_result') &&
          url
        ) {
          resolveActiveTab((tab) => {
            if (typeof tab?.id === 'number') {
              chromeGlobal.tabs.update(tab.id, { url }, () => {
                sendResponse({ ok: true, data: { tabId: tab.id, url } });
              });
            } else {
              chromeGlobal.tabs.create({ url, active: true }, (newTab: any) => {
                sendResponse({ ok: true, data: { tabId: newTab?.id, url } });
              });
            }
          });
          return true;
        }

        if (
          browserAction === 'search_query' ||
          browserAction === 'open_search_engine'
        ) {
          const searchUrl = query
            ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
            : url || 'https://www.google.com';
          chromeGlobal.tabs.create(
            { url: searchUrl, active: true },
            (newTab: any) => {
              sendResponse({
                ok: true,
                data: { tabId: newTab?.id, url: searchUrl },
              });
            }
          );
          return true;
        }

        if (browserAction === 'go_back') {
          resolveActiveTab((tab) => {
            if (typeof tab?.id === 'number' && chromeGlobal.tabs.goBack) {
              chromeGlobal.tabs.goBack(tab.id, () =>
                sendResponse({ ok: true })
              );
            } else {
              sendResponse({ ok: false, error: 'Cannot go back' });
            }
          });
          return true;
        }

        if (browserAction === 'go_forward') {
          resolveActiveTab((tab) => {
            if (typeof tab?.id === 'number' && chromeGlobal.tabs.goForward) {
              chromeGlobal.tabs.goForward(tab.id, () =>
                sendResponse({ ok: true })
              );
            } else {
              sendResponse({ ok: false, error: 'Cannot go forward' });
            }
          });
          return true;
        }

        if (browserAction === 'reload') {
          resolveActiveTab((tab) => {
            if (typeof tab?.id === 'number' && chromeGlobal.tabs.reload) {
              chromeGlobal.tabs.reload(tab.id, {}, () =>
                sendResponse({ ok: true })
              );
            } else {
              sendResponse({ ok: false, error: 'Cannot reload tab' });
            }
          });
          return true;
        }

        if (browserAction === 'switch_tab') {
          chromeGlobal.tabs.query(
            { currentWindow: true },
            (tabs: Array<{ id?: number; active?: boolean }>) => {
              if (!tabs || tabs.length < 2) {
                sendResponse({ ok: false, error: 'No other tab to switch to' });
                return;
              }
              const activeIdx = tabs.findIndex((t) => t.active);
              const nextTab = tabs[(activeIdx + 1) % tabs.length];
              if (typeof nextTab?.id === 'number') {
                chromeGlobal.tabs.update(
                  nextTab.id,
                  { active: true },
                  () => sendResponse({ ok: true })
                );
              } else {
                sendResponse({ ok: false });
              }
            }
          );
          return true;
        }

        sendResponse({ ok: true });
        return false;
      }

      // 4. Forward Content Script commands to active tab when sent from SidePanel/Popup
      if (
        message.type === 'TOGGLE_M3AK_ASSISTANT' ||
        message.type === 'SHOW_M3AK_ASSISTANT' ||
        message.type === 'HIDE_M3AK_ASSISTANT' ||
        message.type === 'INSPECT_PAGE' ||
        message.type === 'ANALYZE_PAGE' ||
        message.type === 'HIGHLIGHT_ELEMENT' ||
        message.type === 'CLEAR_HIGHLIGHT' ||
        message.type === 'EXECUTE_ACTION' ||
        message.type === 'VERIFY_ACTION'
      ) {
        if (!chromeGlobal.tabs?.query) {
          sendResponse({ ok: false, error: 'Tabs API unavailable' });
          return false;
        }

        chromeGlobal.tabs.query(
          { active: true, currentWindow: true },
          (tabs: Array<{ id?: number }>) => {
            const activeTabId = tabs?.[0]?.id;
            if (typeof activeTabId !== 'number') {
              sendResponse({
                ok: false,
                error: 'No active tab available to inspect.',
              });
              return;
            }

            sendToTabWithAutoInject(activeTabId, message, sendResponse);
          }
        );
        return true;
      }

      return false;
    }
  );
}

export {};
