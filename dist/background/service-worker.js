//#region src/background/service-worker.ts
var e = globalThis.chrome, t = "http://localhost:3000/api/ai";
function n(t, n, r) {
	if (!e?.tabs?.sendMessage) {
		r?.({
			ok: !1,
			error: "Tabs API unavailable"
		});
		return;
	}
	e.tabs.sendMessage(t, n, (i) => {
		if (!e.runtime.lastError) {
			r?.(i || { ok: !0 });
			return;
		}
		e.scripting?.executeScript ? e.scripting.executeScript({
			target: { tabId: t },
			files: ["content/content-script.js"]
		}, () => {
			if (e.runtime.lastError) {
				r?.({
					ok: !1,
					error: e.runtime.lastError.message || "Cannot inject content script on this page."
				});
				return;
			}
			setTimeout(() => {
				e.tabs.sendMessage(t, n, (t) => {
					e.runtime.lastError ? r?.({
						ok: !1,
						error: e.runtime.lastError.message || "Content script unavailable after injection."
					}) : r?.(t || { ok: !0 });
				});
			}, 60);
		}) : r?.({
			ok: !1,
			error: e.runtime.lastError.message || "Content script unavailable on this page."
		});
	});
}
e?.runtime && (e.runtime.onInstalled.addListener(() => {
	e.sidePanel?.setPanelBehavior && e.sidePanel.setPanelBehavior({ openPanelOnActionClick: !1 }).catch((e) => console.warn("[M3ak SW] SidePanel behavior setup:", e));
}), e.action?.onClicked && e.action.onClicked.addListener((t) => {
	let r = t?.id, i = t?.url || "";
	if (!r || i.startsWith("chrome://") || i.startsWith("edge://") || i.startsWith("about:") || i.startsWith("chrome-extension://")) {
		e.sidePanel?.open && typeof t?.windowId == "number" && e.sidePanel.open({ windowId: t.windowId }).catch(() => {});
		return;
	}
	n(r, { type: "TOGGLE_M3AK_ASSISTANT" });
}), e.runtime.onMessage.addListener((r, i, a) => {
	if (!r || typeof r.type != "string") return a({
		ok: !1,
		error: "Invalid extension message"
	}), !1;
	if (r.type === "AI_API_REQUEST") {
		let { endpoint: e, body: n } = r.payload || {};
		return e ? (fetch(`${t}${e}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(n || {})
		}).then(async (e) => {
			if (!e.ok) {
				a({
					ok: !1,
					error: `HTTP_${e.status}`
				});
				return;
			}
			a({
				ok: !0,
				data: await e.json()
			});
		}).catch((e) => {
			a({
				ok: !1,
				error: e?.message || "AI backend unreachable"
			});
		}), !0) : (a({
			ok: !1,
			error: "Missing AI endpoint"
		}), !1);
	}
	if (r.type === "OPEN_SIDE_PANEL") {
		if (!e.sidePanel?.open) return a({
			ok: !1,
			error: "Chrome Side Panel API is not supported in this browser."
		}), !1;
		let t = (t) => {
			if (typeof t != "number") {
				a({
					ok: !1,
					error: "No active browser window found."
				});
				return;
			}
			e.sidePanel.open({ windowId: t }).then(() => a({ ok: !0 })).catch((e) => a({
				ok: !1,
				error: e.message
			}));
		};
		return i?.tab?.windowId ? t(i.tab.windowId) : e.tabs?.query ? e.tabs.query({
			active: !0,
			currentWindow: !0
		}, (n) => {
			if (e.runtime.lastError || !n || n.length === 0) {
				a({
					ok: !1,
					error: e.runtime.lastError?.message || "No active tab found"
				});
				return;
			}
			t(n[0].windowId);
		}) : a({
			ok: !1,
			error: "Unable to resolve windowId"
		}), !0;
	}
	if (r.type === "CAPTURE_SCREENSHOT") return e.tabs?.captureVisibleTab ? (e.tabs.captureVisibleTab(null, {
		format: "jpeg",
		quality: 75
	}, (t) => {
		e.runtime.lastError || !t ? a({
			ok: !1,
			error: e.runtime.lastError?.message || "Failed to capture visible tab"
		}) : a({
			ok: !0,
			screenshotDataUrl: t
		});
	}), !0) : (a({
		ok: !1,
		error: "Screenshot capture API unavailable"
	}), !1);
	if (r.type === "BROWSER_AGENT_ACTION") {
		let { browserAction: t, url: n, query: o } = r.payload || {};
		if (!e.tabs) return a({
			ok: !1,
			error: "Chrome Tabs API unavailable"
		}), !1;
		let s = (t) => {
			if (i?.tab?.id) {
				t(i.tab);
				return;
			}
			e.tabs.query({
				active: !0,
				currentWindow: !0
			}, (e) => {
				t(e?.[0] || null);
			});
		};
		if (t === "open_tab" && n) return e.tabs.create({
			url: n,
			active: !0
		}, (e) => {
			a({
				ok: !0,
				data: {
					tabId: e?.id,
					url: n
				}
			});
		}), !0;
		if ((t === "navigate_url" || t === "open_search_result") && n) return s((t) => {
			typeof t?.id == "number" ? e.tabs.update(t.id, { url: n }, () => {
				a({
					ok: !0,
					data: {
						tabId: t.id,
						url: n
					}
				});
			}) : e.tabs.create({
				url: n,
				active: !0
			}, (e) => {
				a({
					ok: !0,
					data: {
						tabId: e?.id,
						url: n
					}
				});
			});
		}), !0;
		if (t === "search_query" || t === "open_search_engine") {
			let t = o ? `https://www.google.com/search?q=${encodeURIComponent(o)}` : n || "https://www.google.com";
			return e.tabs.create({
				url: t,
				active: !0
			}, (e) => {
				a({
					ok: !0,
					data: {
						tabId: e?.id,
						url: t
					}
				});
			}), !0;
		}
		return t === "go_back" ? (s((t) => {
			typeof t?.id == "number" && e.tabs.goBack ? e.tabs.goBack(t.id, () => a({ ok: !0 })) : a({
				ok: !1,
				error: "Cannot go back"
			});
		}), !0) : t === "go_forward" ? (s((t) => {
			typeof t?.id == "number" && e.tabs.goForward ? e.tabs.goForward(t.id, () => a({ ok: !0 })) : a({
				ok: !1,
				error: "Cannot go forward"
			});
		}), !0) : t === "reload" ? (s((t) => {
			typeof t?.id == "number" && e.tabs.reload ? e.tabs.reload(t.id, {}, () => a({ ok: !0 })) : a({
				ok: !1,
				error: "Cannot reload tab"
			});
		}), !0) : t === "switch_tab" ? (e.tabs.query({ currentWindow: !0 }, (t) => {
			if (!t || t.length < 2) {
				a({
					ok: !1,
					error: "No other tab to switch to"
				});
				return;
			}
			let n = t[(t.findIndex((e) => e.active) + 1) % t.length];
			typeof n?.id == "number" ? e.tabs.update(n.id, { active: !0 }, () => a({ ok: !0 })) : a({ ok: !1 });
		}), !0) : (a({ ok: !0 }), !1);
	}
	return r.type === "TOGGLE_M3AK_ASSISTANT" || r.type === "SHOW_M3AK_ASSISTANT" || r.type === "HIDE_M3AK_ASSISTANT" || r.type === "INSPECT_PAGE" || r.type === "ANALYZE_PAGE" || r.type === "HIGHLIGHT_ELEMENT" || r.type === "CLEAR_HIGHLIGHT" || r.type === "EXECUTE_ACTION" || r.type === "VERIFY_ACTION" ? e.tabs?.query ? (e.tabs.query({
		active: !0,
		currentWindow: !0
	}, (e) => {
		let t = e?.[0]?.id;
		if (typeof t != "number") {
			a({
				ok: !1,
				error: "No active tab available to inspect."
			});
			return;
		}
		n(t, r, a);
	}), !0) : (a({
		ok: !1,
		error: "Tabs API unavailable"
	}), !1) : !1;
}));
//#endregion
