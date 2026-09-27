import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Camera,
  Settings,
  Send,
  Search,
  Volume2,
  CheckCircle2,
  ShieldAlert,
  Target,
  XCircle,
  RotateCcw,
  ArrowUpRight,
} from 'lucide-react';
import {
  AvatarState,
  ChatMessage,
  MicrophoneState,
  PageContext,
  TaskState,
} from '../../shared/types';
import {
  AI_NAME,
  AI_NAME_ARABIC,
  DARIJA_QUICK_PROMPTS,
} from '../../shared/constants';
import { formatTimeShort } from '../../shared/utils';
import { AssistantAvatar } from './AssistantAvatar';

interface SidePanelViewProps {
  messages: ChatMessage[];
  taskState: TaskState;
  avatarState: AvatarState;
  micState: MicrophoneState;
  pageContext: PageContext | null;
  isAnalyzing: boolean;
  onSendMessage: (
    text: string,
    options?: { withScreenshot?: boolean }
  ) => void;
  onAnalyzePage: (withScreenshot?: boolean) => void;
  onToggleVoice: () => void;
  onConfirmSensitiveAction: (executeAutomatically: boolean) => void;
  onRetryTask: () => void;
  onStopTask: () => void;
  onOpenSettings: () => void;
  onSpeakText: (text: string) => void;
  onHighlightElementManual?: (elementId: string, label: string) => void;
}

export const SidePanelView: React.FC<SidePanelViewProps> = ({
  messages,
  taskState,
  avatarState,
  micState,
  pageContext,
  isAnalyzing,
  onSendMessage,
  onAnalyzePage,
  onToggleVoice,
  onConfirmSensitiveAction,
  onRetryTask,
  onStopTask,
  onOpenSettings,
  onSpeakText,
  onHighlightElementManual,
}) => {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, taskState.status]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAnalyzing) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const progressPercent =
    taskState.totalEstimatedSteps > 0
      ? Math.min(
          100,
          Math.round(
            (taskState.currentStep / taskState.totalEstimatedSteps) * 100
          )
        )
      : 0;

  const isFailedOrBlocked =
    taskState.status === 'ERROR' || taskState.status === 'BLOCKED';

  return (
    <aside className="flex h-full w-full flex-col border-l border-slate-800 bg-slate-900 text-slate-100">
      {/* 1. Side Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <AssistantAvatar state={avatarState} size="md" showStatusDot />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white">
                {AI_NAME} ({AI_NAME_ARABIC})
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="text-xs font-medium text-emerald-400 whitespace-nowrap">
                Online ●
              </span>
            </div>
            <p className="truncate text-xs text-slate-400">
              {taskState.goal
                ? `Helping with: "${taskState.goal}"`
                : 'Helping you with this page · معاونك فهاد الصفحة'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onAnalyzePage(false)}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/50 hover:text-white disabled:opacity-50 transition-colors whitespace-nowrap"
            title="Analyze current webpage structure in Darija"
          >
            <Search className="h-3.5 w-3.5 text-emerald-400" />
            <span>Analyze page</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Settings & Privacy"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. Current Task & Step State Machine Card */}
      {taskState.status !== 'IDLE' && (
        <div className="border-b border-slate-800 bg-slate-950/75 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono-tabular font-semibold text-emerald-400">
                Step {taskState.currentStep} /{' '}
                {taskState.totalEstimatedSteps || 3}
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span
                className={`font-mono-tabular text-[11px] ${
                  isFailedOrBlocked ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {taskState.status}
              </span>
              {taskState.targetElement && (
                <>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="font-mono-tabular text-[11px] text-sky-400">
                    #{taskState.targetElement}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isFailedOrBlocked && (
                <button
                  type="button"
                  onClick={onRetryTask}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-600/30 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>عاود المحاولة</span>
                </button>
              )}
              <button
                type="button"
                onClick={onStopTask}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors whitespace-nowrap"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>إلغاء</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              style={{
                width: `${
                  taskState.status === 'COMPLETED' ? 100 : progressPercent
                }%`,
              }}
              className={`h-full transition-all duration-300 ${
                isFailedOrBlocked
                  ? 'bg-rose-500'
                  : taskState.status === 'COMPLETED'
                  ? 'bg-emerald-500'
                  : taskState.requiresConfirmation
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
          </div>

          {/* Current Darija Step Instruction */}
          <p
            className="mt-2 text-xs font-medium text-slate-200 font-darija leading-relaxed"
            dir="rtl"
          >
            {taskState.status === 'COMPLETED'
              ? 'مزيان 🎉 كملنا جميع الخطوات ديال هاد المهمة!'
              : `دابا دير هاد الخطوة: ${taskState.currentInstruction}`}
          </p>

          {/* Section 10: Sensitive Action Confirmation Controls */}
          {taskState.requiresConfirmation && (
            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2" dir="rtl">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="text-xs font-darija text-amber-100">
                  وجدنا كلشي ✅ هادي خطوة حساسة. بغيتي نكليكي عليها ليك ولا
                  تكليكي نتا؟
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onConfirmSensitiveAction(true)}
                  className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
                >
                  Yes, continue · أه كمل
                </button>
                <button
                  type="button"
                  onClick={() => onConfirmSensitiveAction(false)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  I&apos;ll do it · أنا غنديرها
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => {
          const isAI = msg.sender === 'ai';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                isAI ? 'justify-start' : 'justify-end'
              }`}
            >
              {isAI && (
                <AssistantAvatar
                  state={msg.isError ? 'error' : 'idle'}
                  size="sm"
                  className="mt-0.5"
                />
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  isAI
                    ? msg.isError
                      ? 'border border-rose-500/30 bg-rose-950/40 text-rose-200'
                      : 'border border-slate-800 bg-slate-950/90 text-slate-100'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {/* Message Text */}
                <div
                  className="whitespace-pre-line font-darija text-[13px] leading-relaxed"
                  dir="auto"
                >
                  {msg.text}
                </div>

                {/* If Page Analysis Card */}
                {msg.pageAnalysis && (
                  <div className="mt-3 space-y-2 border-t border-slate-800/90 pt-2.5">
                    <div className="text-[11px] font-medium text-slate-400">
                      العناصر الرئيسية فهاد الصفحة · Key Page Elements:
                    </div>
                    <div className="space-y-1.5">
                      {msg.pageAnalysis.keyElements.map((ke) => (
                        <div
                          key={ke.id}
                          onClick={() =>
                            onHighlightElementManual?.(ke.id, ke.purposeDarija)
                          }
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-900/90 px-2.5 py-1.5 cursor-pointer hover:border-emerald-500/50 transition-colors"
                        >
                          <div className="min-w-0">
                            <span className="font-mono-tabular text-[11px] text-emerald-400">
                              {ke.id}
                            </span>
                            <span className="mx-1.5 text-slate-600">·</span>
                            <span className="font-medium text-slate-200">
                              {ke.label}
                            </span>
                            <p
                              className="text-[11px] text-slate-400 font-darija"
                              dir="rtl"
                            >
                              {ke.purposeDarija}
                            </p>
                          </div>
                          <Target className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        </div>
                      ))}
                    </div>

                    {msg.pageAnalysis.suggestedTasks.length > 0 && (
                      <div className="pt-1">
                        <div className="mb-1.5 text-[11px] text-slate-400">
                          جرب تقولي · Try asking:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.pageAnalysis.suggestedTasks.map((st) => (
                            <button
                              key={st.command}
                              type="button"
                              onClick={() => onSendMessage(st.command)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                            >
                              <span className="font-darija">
                                {st.labelDarija}
                              </span>
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Target Metadata Row */}
                {msg.actionResponse && msg.actionResponse.targetElementId && (
                  <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                    <span className="font-mono-tabular text-emerald-400">
                      Action: {msg.actionResponse.action} → #
                      {msg.actionResponse.targetElementId}
                    </span>
                    {msg.actionResponse.taskCompleted && (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Done
                      </span>
                    )}
                  </div>
                )}

                {/* Timestamp & TTS Speaker Button */}
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] opacity-70">
                  <span className="font-mono-tabular">
                    {formatTimeShort(msg.timestamp)}
                    {msg.isVoice ? ' · 🎤 Voice' : ''}
                    {msg.hasScreenshot ? ' · 📸 Vision' : ''}
                  </span>
                  {isAI && (
                    <button
                      type="button"
                      onClick={() => onSpeakText(msg.text)}
                      className="inline-flex items-center gap-1 hover:text-emerald-300 transition-colors"
                      title="Read aloud in Darija"
                    >
                      <Volume2 className="h-3 w-3" />
                      <span>سمع</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading / Thinking Indicator with consistent Avatar */}
        {isAnalyzing && (
          <div className="flex items-center gap-2.5">
            <AssistantAvatar state="thinking" size="sm" />
            <div
              className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-300 font-darija"
              dir="rtl"
            >
              شوية صبر، كنشوف الصفحة وكنوجد ليك الخطوة الجاية...
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 4. Quick Darija Suggestions Bar */}
      <div className="border-t border-slate-800/80 bg-slate-950/40 px-3 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {DARIJA_QUICK_PROMPTS.map((item) => (
            <button
              key={item.text}
              type="button"
              disabled={isAnalyzing}
              onClick={() => onSendMessage(item.text)}
              className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Voice Status Banner (when Listening / Processing / Speaking) */}
      {micState !== 'Idle' && (
        <div className="flex items-center justify-between border-t border-emerald-500/30 bg-emerald-950/30 px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <AssistantAvatar
              state={
                micState === 'Listening'
                  ? 'waiting'
                  : micState === 'Speaking'
                  ? 'speaking'
                  : 'thinking'
              }
              size="xs"
            />
            <span className="font-medium text-emerald-300">
              {micState === 'Listening' &&
                '🎤 كنسمعك دابا... هضر بالدارجة (Listening)'}
              {micState === 'Processing' &&
                '⏳ كنحلل الهضرة ديالك (Processing)'}
              {micState === 'Speaking' && '🔊 كنهضر معاك دابا (Speaking)'}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleVoice}
            className="text-[11px] font-medium text-slate-300 hover:text-white"
          >
            حبس (Stop)
          </button>
        </div>
      )}

      {/* 6. Input Area & Action Controls (Voice, Screenshot, Settings) */}
      <form
        onSubmit={handleFormSubmit}
        className="border-t border-slate-800 bg-slate-900 p-3"
      >
        <div className="flex items-center gap-2 rounded-xl border border-slate-700/90 bg-slate-950 px-3 py-2 focus-within:border-emerald-500">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Gol lia chno bghiti ndir..."
            className="min-w-0 flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isAnalyzing}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            title="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Bottom Action Toolbar: 🎤 Voice · 📎 Screenshot · ⚙ Settings + DOM Element Counter */}
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleVoice}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                micState === 'Listening'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Voice Interaction (Speech-to-Text)"
            >
              <Mic className="h-3.5 w-3.5 text-emerald-400" />
              <span>Voice ({micState})</span>
            </button>

            <button
              type="button"
              onClick={() => onAnalyzePage(true)}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap"
              title="Capture visible webpage area for Gemini Vision analysis"
            >
              <Camera className="h-3.5 w-3.5 text-sky-400" />
              <span>Screenshot</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
              title="Extension Settings"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>Settings</span>
            </button>
          </div>

          <div className="font-mono-tabular text-[11px] text-slate-500">
            {pageContext ? `${pageContext.elements.length} DOM nodes` : 'Ready'}
          </div>
        </div>
      </form>
    </aside>
  );
};
