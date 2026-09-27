import React, { useState } from 'react';
import {
  Mic,
  PanelRightOpen,
  Settings,
  Send,
  Search,
  AlertCircle,
} from 'lucide-react';
import { AssistantAvatar } from '../../sidepanel/components/AssistantAvatar';
import {
  AvatarState,
  ExtensionMessage,
  ExtensionMessageResponse,
  MicrophoneState,
} from '../../shared/types';
import { AI_NAME, AI_NAME_ARABIC } from '../../shared/constants';

interface ExtensionPopupProps {
  avatarState: AvatarState;
  micState: MicrophoneState;
  onStartTask: (goal: string) => void;
  onAnalyzePage: () => void;
  onToggleVoice: () => void;
  onOpenSidePanel: () => void;
  onOpenSettings: () => void;
}

/**
 * Lightweight, fast Chrome Extension Popup (Section 12 & 16 of spec)
 * Shows Avatar, "سلام 👋", "شنو بغيتي ندير ليك؟", Input, Microphone,
 * "Open Assistant", "Analyze this page", and Settings.
 * Handles missing active tab or unsupported page gracefully with a friendly Darija error.
 */
export const ExtensionPopup: React.FC<ExtensionPopupProps> = ({
  avatarState,
  micState,
  onStartTask,
  onAnalyzePage,
  onToggleVoice,
  onOpenSidePanel,
  onOpenSettings,
}) => {
  const [input, setInput] = useState('');
  const [popupNotice, setPopupNotice] = useState<string | null>(null);

  const verifyActiveTabOrProceed = (callback: () => void) => {
    setPopupNotice(null);
    const chromeGlobal = (globalThis as Record<string, any>).chrome;
    // When running as a standalone Chrome Extension Popup, check active tab first
    if (chromeGlobal?.tabs?.query && !document.getElementById('m3ak-sandbox-viewport')) {
      chromeGlobal.tabs.query(
        { active: true, currentWindow: true },
        (tabs: Array<{ id?: number; url?: string }>) => {
          const activeTab = tabs?.[0];
          if (!activeTab || typeof activeTab.id !== 'number') {
            setPopupNotice(
              'ما لقيت حتى صفحة محلولة دابا 😅 حل شي موقع وجرب من جديد.'
            );
            return;
          }
          if (
            activeTab.url &&
            (activeTab.url.startsWith('chrome://') ||
              activeTab.url.startsWith('edge://'))
          ) {
            setPopupNotice(
              'هاد الصفحة ديال المتصفح محمية من طرف Chrome 🔒 حل شي موقع عادي باش نعاونك فيه.'
            );
            return;
          }
          callback();
        }
      );
      return;
    }
    callback();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const goal = input.trim();
    verifyActiveTabOrProceed(() => {
      onStartTask(goal);
      setInput('');
      onOpenSidePanel();
    });
  };

  return (
    <div className="w-[340px] rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-100 shadow-2xl">
      {/* Top Row: Brand & Settings */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-tight text-white">
            {AI_NAME} ({AI_NAME_ARABIC})
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-[11px] text-emerald-400">Online ●</span>
        </div>
        <button
          onClick={onOpenSettings}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Greeting & Avatar */}
      <div className="mt-4 flex flex-col items-center text-center">
        <AssistantAvatar state={avatarState} size="lg" showStatusDot />
        <h2 className="mt-3 text-lg font-bold text-white font-darija" dir="rtl">
          سلام 👋
        </h2>
        <p className="mt-0.5 text-sm text-slate-300 font-darija" dir="rtl">
          شنو بغيتي ندير ليك فهاد الصفحة؟
        </p>
      </div>

      {popupNotice && (
        <div
          className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200 font-darija"
          dir="rtl"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>{popupNotice}</span>
        </div>
      )}

      {/* Fast Input & Mic */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-700/90 bg-slate-950 px-2.5 py-1.5 focus-within:border-emerald-500">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="bghit n9leb 3la login..."
            className="min-w-0 flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onToggleVoice}
            className={`rounded-lg p-1.5 transition-colors ${
              micState === 'Listening'
                ? 'bg-rose-500/20 text-rose-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title={`Voice (${micState})`}
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            title="Start Task"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>

      {/* Quick Demo Triggers */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          'bghit n9leb 3la login',
          'bghit ndir compte hna',
          'bghit n9leb 3la stage',
        ].map((cmd) => (
          <button
            key={cmd}
            type="button"
            onClick={() =>
              verifyActiveTabOrProceed(() => {
                onStartTask(cmd);
                onOpenSidePanel();
              })
            }
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors whitespace-nowrap"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Primary Popup Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3.5">
        <button
          type="button"
          onClick={() =>
            verifyActiveTabOrProceed(() => {
              onAnalyzePage();
              onOpenSidePanel();
            })
          }
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap"
        >
          <Search className="h-3.5 w-3.5 text-emerald-400" />
          <span>Analyze this page</span>
        </button>

        <button
          type="button"
          onClick={() =>
            verifyActiveTabOrProceed(() => {
              const chromeGlobal = (globalThis as Record<string, any>).chrome;
              if (chromeGlobal?.runtime?.sendMessage) {
                chromeGlobal.runtime.sendMessage(
                  { type: 'OPEN_SIDE_PANEL' } satisfies ExtensionMessage,
                  (_res: ExtensionMessageResponse) => {
                    void chromeGlobal.runtime?.lastError;
                  }
                );
              }
              onOpenSidePanel();
            })
          }
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
          <span>Open Assistant</span>
        </button>
      </div>
    </div>
  );
};
