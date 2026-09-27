import React, { useState } from 'react';
import { X, Code2, Terminal, CheckCircle2, Layers } from 'lucide-react';
import { PageContext, TaskState } from '../../shared/types';
import { AI_NAME } from '../../shared/constants';

interface ExtensionArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageContext: PageContext | null;
  taskState: TaskState;
}

export const ExtensionArchitectureModal: React.FC<
  ExtensionArchitectureModalProps
> = ({ isOpen, onClose, pageContext, taskState }) => {
  const [activeTab, setActiveTab] = useState<
    'dom-context' | 'state-machine' | 'chrome-setup'
  >('dom-context');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Code2 className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {AI_NAME} Chrome Extension Inspector & Manifest V3 Guide
              </h3>
              <p className="text-xs text-slate-400">
                Live structured DOM representation, Task State Machine, and Chrome unpacked loading guide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented Filter Controls */}
        <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-950/50 px-5 py-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('dom-context')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'dom-context'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Live Compact DOM Context ({pageContext?.elements.length || 0} elements)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('state-machine')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'state-machine'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Task State Machine ({taskState.status})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chrome-setup')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'chrome-setup'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Load in Chrome (Manifest V3)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {activeTab === 'dom-context' && (
            <div className="space-y-3">
              <p className="text-slate-400">
                Rather than sending the raw HTML DOM to Gemini,{' '}
                <code className="text-emerald-400">src/content/dom-analyzer.ts</code>{' '}
                extracts only visible interactive elements and assigns temporary{' '}
                <code className="text-emerald-400">element_N</code> identifiers:
              </p>
              <pre className="max-h-96 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono-tabular text-[11px] text-emerald-300">
                {JSON.stringify(pageContext, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'state-machine' && (
            <div className="space-y-3">
              <p className="text-slate-400">
                Current Task State Machine state stored by{' '}
                <code className="text-emerald-400">useBrowserAgent.ts</code>:
              </p>
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono-tabular text-[11px] text-sky-300">
                {JSON.stringify(taskState, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'chrome-setup' && (
            <div className="space-y-4 leading-relaxed text-slate-300">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <h4 className="font-semibold text-white">
                  How to Load M3ak in Google Chrome (Developer Mode)
                </h4>
                <ol className="mt-2 list-decimal pl-5 space-y-1.5 text-slate-300">
                  <li>
                    Run <code className="text-emerald-400">npm run build</code> to
                    generate the production bundle in <code className="text-emerald-400">dist/</code>{' '}
                    (includes <code className="text-emerald-400">manifest.json</code>,{' '}
                    <code className="text-emerald-400">assistant-avatar.png</code>, and icons).
                  </li>
                  <li>
                    Open Google Chrome and navigate to{' '}
                    <code className="text-emerald-400">chrome://extensions</code>.
                  </li>
                  <li>
                    Enable <strong>Developer mode</strong> in the top-right corner.
                  </li>
                  <li>
                    Click <strong>Load unpacked</strong> and select the{' '}
                    <code className="text-emerald-400">dist/</code> directory.
                  </li>
                  <li>
                    Pin <strong>M3ak (معاك)</strong> to your Chrome toolbar to open
                    either the Popup or the Chrome Side Panel on any website.
                  </li>
                </ol>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <h4 className="font-semibold text-white">
                  Replacing the Consistent AI Avatar
                </h4>
                <p className="mt-1 text-slate-400">
                  Replace <code className="text-emerald-400">/public/assistant-avatar.png</code>{' '}
                  with your custom square PNG/JPG asset. The <code className="text-emerald-400">AssistantAvatar</code>{' '}
                  component automatically propagates it across the Side Panel, Popup,
                  Chat messages, Voice bar, Onboarding, and Highlight Tooltip.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
