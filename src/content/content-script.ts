import { ExtensionMessage, ExtensionMessageResponse } from '../shared/types';
import { domAnalyzer } from './dom-analyzer';
import { elementHighlighter } from './element-highlighter';
import { floatingAssistant } from './floating-assistant';
import { pageObserver } from './page-observer';

/**
 * Chrome Extension Content Script Entry Point (Manifest V3)
 * - Toggles/renders the In-Page Floating M3ak Assistant when the user clicks the extension icon
 * - Inspects the webpage on-demand, resolves and highlights target elements,
 *   and observes user progress for automatic step-by-step verification.
 */
function initContentScript(): void {
  const win = window as unknown as Record<string, any>;
  if (win.__m3akContentScriptInitialized) {
    return;
  }
  win.__m3akContentScriptInitialized = true;

  const chromeGlobal = (globalThis as Record<string, any>).chrome;
  if (!chromeGlobal?.runtime?.onMessage) {
    return;
  }

  chromeGlobal.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender: unknown,
      sendResponse: (response: ExtensionMessageResponse) => void
    ) => {
      try {
        switch (message.type) {
          case 'TOGGLE_M3AK_ASSISTANT': {
            const state = floatingAssistant.toggle(message.payload);
            sendResponse({
              ok: true,
              visible: state.visible,
              minimized: state.minimized,
            });
            break;
          }
          case 'SHOW_M3AK_ASSISTANT': {
            const state = floatingAssistant.show(message.payload);
            sendResponse({
              ok: true,
              visible: state.visible,
              minimized: state.minimized,
            });
            break;
          }
          case 'HIDE_M3AK_ASSISTANT': {
            const state = floatingAssistant.hide();
            sendResponse({
              ok: true,
              visible: state.visible,
              minimized: state.minimized,
            });
            break;
          }
          case 'INSPECT_PAGE':
          case 'ANALYZE_PAGE': {
            const context = domAnalyzer.inspectPage(document.body);
            sendResponse({ ok: true, pageContext: context });
            break;
          }
          case 'HIGHLIGHT_ELEMENT': {
            const target = elementHighlighter.highlight(
              message.payload,
              document.body
            );
            if (!target) {
              sendResponse({
                ok: false,
                error: `Target element ${message.payload.elementId} could not be resolved on page.`,
                resolvedElementId: null,
              });
            } else {
              sendResponse({
                ok: true,
                resolvedElementId: message.payload.elementId,
              });
            }
            break;
          }
          case 'CLEAR_HIGHLIGHT': {
            elementHighlighter.clearHighlight();
            sendResponse({ ok: true });
            break;
          }
          case 'VERIFY_ACTION': {
            const context = domAnalyzer.inspectPage(document.body);
            sendResponse({ ok: true, pageContext: context });
            break;
          }
          case 'EXECUTE_ACTION': {
            const el = domAnalyzer.resolveElement(
              message.payload.elementId,
              document.body
            );
            if (!el) {
              sendResponse({
                ok: false,
                error: `Element ${message.payload.elementId} not found`,
              });
              break;
            }
            if (message.payload.action === 'click') {
              el.click();
            } else if (
              message.payload.action === 'focus' ||
              message.payload.action === 'type' ||
              message.payload.action === 'input'
            ) {
              el.focus();
            } else if (message.payload.action === 'scroll') {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            sendResponse({ ok: true, resolvedElementId: message.payload.elementId });
            break;
          }
          default:
            sendResponse({ ok: false, error: 'Unsupported message type' });
            break;
        }
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'Content script execution error';
        sendResponse({ ok: false, error: errorMessage });
      }
      return true;
    }
  );

  pageObserver.attach(document.body, {
    onUserInteraction: (ev) => {
      void floatingAssistant.handlePageUserInteraction(ev);
      try {
        chromeGlobal.runtime.sendMessage(
          {
            type: 'USER_ACTION_DETECTED',
            payload: ev,
          } satisfies ExtensionMessage,
          () => {
            // Ignore lastError if sidepanel is closed
            void chromeGlobal.runtime?.lastError;
          }
        );
      } catch {
        // Extension context invalidated or sidepanel closed
      }
    },
    onDomMutated: () => {
      floatingAssistant.handlePageDomMutated();
      try {
        chromeGlobal.runtime.sendMessage(
          {
            type: 'PAGE_MUTATED',
            payload: {
              url: window.location.href,
              title: document.title,
            },
          } satisfies ExtensionMessage,
          () => {
            void chromeGlobal.runtime?.lastError;
          }
        );
      } catch {
        // Ignore if receiver is not open
      }
    },
  });

  window.addEventListener('pagehide', () => {
    elementHighlighter.clearHighlight();
    pageObserver.detach();
  });

  // Ensure the floating M3ak orb remains available on any normal website while M3ak is active
  if (
    window.location.protocol === 'http:' ||
    window.location.protocol === 'https:'
  ) {
    try {
      if (chromeGlobal.storage?.local?.get) {
        chromeGlobal.storage.local.get(
          ['m3ak_companion_active'],
          (res: Record<string, any>) => {
            const isActive = res?.m3ak_companion_active !== false;
            if (isActive) {
              floatingAssistant.show({ startAsOrb: true });
            }
          }
        );
      } else {
        floatingAssistant.show({ startAsOrb: true });
      }
    } catch {
      floatingAssistant.show({ startAsOrb: true });
    }
  }
}

// Auto-initialize when injected into a tab by Chrome Extension runtime
if (
  typeof window !== 'undefined' &&
  typeof (globalThis as Record<string, any>).chrome?.runtime?.onMessage !==
    'undefined' &&
  !document.getElementById('root')
) {
  initContentScript();
}
