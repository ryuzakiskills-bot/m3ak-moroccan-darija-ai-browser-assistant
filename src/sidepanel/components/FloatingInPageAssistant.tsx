import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Camera,
  Settings,
  Send,
  Search,
  Volume2,
  VolumeX,
  CheckCircle2,
  ShieldAlert,
  Target,
  XCircle,
  RotateCcw,
  ArrowUpRight,
  Minus,
  X,
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
import { dispatchBrowserAgentPlan } from '../../browser-agent/browser-agent';

export type JarvisVisualState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'ERROR';

interface FloatingInPageAssistantProps {
  isVisible: boolean;
  isMinimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  onHide: () => void;
  messages: ChatMessage[];
  taskState: TaskState;
  avatarState: AvatarState;
  micState: MicrophoneState;
  wakeStandbyActive?: boolean;
  liveTranscript?: string;
  micPermissionDenied?: boolean;
  pageContext: PageContext | null;
  isAnalyzing: boolean;
  onSendMessage: (
    text: string,
    options?: { withScreenshot?: boolean }
  ) => void;
  onAnalyzePage: (withScreenshot?: boolean) => void;
  onToggleVoice: () => void;
  onToggleWakeStandby?: () => void;
  onStopSpeaking?: () => void;
  onConfirmSensitiveAction: (executeAutomatically: boolean) => void;
  onRetryTask: () => void;
  onStopTask: () => void;
  onOpenSettings: () => void;
  onSpeakText: (text: string) => void;
  onHighlightElementManual?: (elementId: string, label: string) => void;
}

export function computeJarvisVisualState(params: {
  avatarState: AvatarState;
  micState: MicrophoneState;
  taskState: TaskState;
  isAnalyzing: boolean;
  micPermissionDenied?: boolean;
}): JarvisVisualState {
  const {
    avatarState,
    micState,
    taskState,
    isAnalyzing,
    micPermissionDenied,
  } = params;

  if (
    micPermissionDenied ||
    avatarState === 'error' ||
    taskState.status === 'ERROR' ||
    taskState.status === 'BLOCKED'
  ) {
    return 'ERROR';
  }
  if (micState === 'Speaking' || avatarState === 'speaking') {
    return 'SPEAKING';
  }
  if (
    isAnalyzing ||
    micState === 'Processing' ||
    avatarState === 'thinking' ||
    taskState.status === 'UNDERSTANDING' ||
    taskState.status === 'SEARCHING' ||
    taskState.status === 'ANALYZING' ||
    taskState.status === 'VERIFYING'
  ) {
    return 'THINKING';
  }
  if (micState === 'Listening') {
    return 'LISTENING';
  }
  return 'IDLE';
}

/**
 * Animated Futuristic JARVIS AI Energy Orb (`◉`) with distinct animations for:
 * IDLE | LISTENING | THINKING | SPEAKING | ERROR
 */
const JarvisOrbCore: React.FC<{
  visualState: JarvisVisualState;
  size?: 'sm' | 'md' | 'lg';
}> = ({ visualState, size = 'md' }) => {
  const dim =
    size === 'lg'
      ? 'h-16 w-16'
      : size === 'sm'
      ? 'h-8 w-8'
      : 'h-10 w-10';
  const nucleusDim =
    size === 'lg'
      ? 'h-4.5 w-4.5'
      : size === 'sm'
      ? 'h-2.5 w-2.5'
      : 'h-3.5 w-3.5';

  const outerRingClass =
    visualState === 'LISTENING'
      ? 'border-cyan-400 animate-[spin_2.2s_linear_infinite]'
      : visualState === 'THINKING'
      ? 'border-sky-400 animate-[spin_1.1s_linear_infinite]'
      : visualState === 'SPEAKING'
      ? 'border-emerald-300 animate-[spin_3s_linear_infinite]'
      : visualState === 'ERROR'
      ? 'border-rose-400 animate-[spin_8s_linear_infinite]'
      : 'border-emerald-400/80 animate-[spin_10s_linear_infinite]';

  const innerRingClass =
    visualState === 'LISTENING'
      ? 'border-cyan-300 border-t-transparent border-b-transparent animate-[spin_1.5s_linear_infinite_reverse]'
      : visualState === 'THINKING'
      ? 'border-sky-300 border-t-transparent border-b-transparent animate-[spin_0.9s_linear_infinite_reverse]'
      : visualState === 'SPEAKING'
      ? 'border-emerald-200 border-t-transparent border-b-transparent animate-[spin_2s_linear_infinite_reverse]'
      : visualState === 'ERROR'
      ? 'border-rose-300/80 border-t-transparent border-b-transparent animate-[spin_6s_linear_infinite_reverse]'
      : 'border-emerald-300/60 border-t-transparent border-b-transparent animate-[spin_7s_linear_infinite_reverse]';

  const nucleusClass =
    visualState === 'LISTENING'
      ? 'bg-cyan-300 shadow-[0_0_16px_#22d3ee] animate-ping'
      : visualState === 'THINKING'
      ? 'bg-sky-400 shadow-[0_0_16px_#38bdf8] animate-pulse'
      : visualState === 'SPEAKING'
      ? 'bg-emerald-300 shadow-[0_0_20px_#34d399] scale-110 animate-pulse'
      : visualState === 'ERROR'
      ? 'bg-rose-400 shadow-[0_0_14px_#fb7185]'
      : 'bg-emerald-400 shadow-[0_0_12px_#10b981] animate-pulse';

  const glowShadow =
    visualState === 'LISTENING'
      ? 'shadow-[0_0_28px_rgba(34,211,238,0.5)]'
      : visualState === 'THINKING'
      ? 'shadow-[0_0_28px_rgba(56,189,248,0.45)]'
      : visualState === 'SPEAKING'
      ? 'shadow-[0_0_32px_rgba(52,211,153,0.55)]'
      : visualState === 'ERROR'
      ? 'shadow-[0_0_24px_rgba(251,113,133,0.45)]'
      : 'shadow-[0_0_20px_rgba(16,185,129,0.28)]';

  return (
    <div
      className={`relative flex ${dim} shrink-0 items-center justify-center rounded-full bg-slate-950/95 ${glowShadow}`}
    >
      <div
        className={`absolute inset-0.5 rounded-full border border-dashed ${outerRingClass}`}
      />
      <div
        className={`absolute inset-1.5 rounded-full border ${innerRingClass}`}
      />
      <div className={`${nucleusDim} rounded-full ${nucleusClass}`} />
    </div>
  );
};

/**
 * Voice-First JARVIS-Style Moroccan Darija AI Browser Companion
 * - Collapsed state: Compact animated M3ak orb (◉ M3ak) + state label + subtle glow + microphone button
 * - Expanded state: Voice-First Futuristic HUD with reactive AI Core Stage, live voice transcript,
 *   "Salam Jarvis" continuous wake-word toggle, spoken response HUD card, and secondary keyboard fallback
 */
export const FloatingInPageAssistant: React.FC<
  FloatingInPageAssistantProps
> = ({
  isVisible,
  isMinimized,
  onMinimize,
  onExpand,
  onHide,
  messages,
  taskState,
  avatarState,
  micState,
  wakeStandbyActive = true,
  liveTranscript = '',
  micPermissionDenied = false,
  pageContext,
  isAnalyzing,
  onSendMessage,
  onAnalyzePage,
  onToggleVoice,
  onToggleWakeStandby,
  onStopSpeaking,
  onConfirmSensitiveAction,
  onRetryTask,
  onStopTask,
  onOpenSettings,
  onSpeakText,
  onHighlightElementManual,
}) => {
  const [inputText, setInputText] = useState('');
  const [pos, setPos] = useState({ right: 24, bottom: 24 });
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startRight: 24,
    startBottom: 24,
  });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragRef.current.moved = true;
      }

      const maxRight = Math.max(16, window.innerWidth - 140);
      const maxBottom = Math.max(16, window.innerHeight - 90);

      setPos({
        right: Math.max(
          16,
          Math.min(maxRight, dragRef.current.startRight - dx)
        ),
        bottom: Math.max(
          16,
          Math.min(maxBottom, dragRef.current.startBottom - dy)
        ),
      });
    };

    const handlePointerUp = () => {
      dragRef.current.active = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  const startDrag = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input') || target?.closest('button')) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startBottom: pos.bottom,
    };
  };

  const visualState = computeJarvisVisualState({
    avatarState,
    micState,
    taskState,
    isAnalyzing,
    micPermissionDenied,
  });

  const isListening = visualState === 'LISTENING';
  const isSpeaking = visualState === 'SPEAKING';
  const isFailedOrBlocked =
    taskState.status === 'ERROR' || taskState.status === 'BLOCKED';

  const statusLabelDarija =
    visualState === 'LISTENING'
      ? 'كنسمعك دابا...'
      : visualState === 'SPEAKING'
      ? 'كنهضر معاك'
      : taskState.status === 'SEARCHING'
      ? 'كنقلب فـ الويب والمصادر الموثوقة...'
      : taskState.status === 'ANALYZING'
      ? 'كنفحص الصفحات وكنقارن المعلومات...'
      : visualState === 'THINKING'
      ? 'كنحلل الطلب...'
      : visualState === 'ERROR'
      ? 'تنبيه'
      : wakeStandbyActive
      ? 'قل "Salam Jarvis" أو هضر مباشرة'
      : 'أنا معاك · واجد';

  const stateColorText =
    visualState === 'LISTENING'
      ? 'text-cyan-400'
      : visualState === 'THINKING'
      ? 'text-sky-400'
      : visualState === 'SPEAKING'
      ? 'text-emerald-300'
      : visualState === 'ERROR'
      ? 'text-rose-400'
      : 'text-emerald-400';

  const stateBorderColor =
    visualState === 'LISTENING'
      ? 'border-cyan-400/70'
      : visualState === 'THINKING'
      ? 'border-sky-400/70'
      : visualState === 'SPEAKING'
      ? 'border-emerald-400/80'
      : visualState === 'ERROR'
      ? 'border-rose-500/70'
      : 'border-emerald-500/45';

  // COLLAPSED STATE: Compact Floating Energy Orb + State Badge + Microphone Button
  if (isMinimized) {
    return (
      <div
        data-m3ak-overlay="true"
        style={{ right: `${pos.right}px`, bottom: `${pos.bottom}px` }}
        className="fixed z-50 select-none"
      >
        <div
          onPointerDown={startDrag}
          className={`flex cursor-grab items-center gap-2.5 rounded-full border ${stateBorderColor} bg-slate-950/92 py-1.5 pr-2.5 pl-2 text-slate-100 shadow-[0_14px_36px_rgba(0,0,0,0.7),0_0_24px_rgba(16,185,129,0.28)] backdrop-blur-xl hover:border-cyan-400/80 transition-all active:cursor-grabbing`}
          title={`M3ak Voice Companion (${visualState}) · قل "Salam Jarvis" أو إضغط`}
        >
          <button
            type="button"
            onClick={() => {
              if (!dragRef.current.moved) {
                onExpand();
              }
            }}
            className="flex items-center gap-2 text-left focus:outline-none"
          >
            <JarvisOrbCore visualState={visualState} size="md" />
            <div className="flex flex-col items-start">
              <span className="text-xs font-bold tracking-wide text-white">
                {AI_NAME}
              </span>
              <span className={`text-[9.5px] font-semibold ${stateColorText}`}>
                {visualState}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!dragRef.current.moved) {
                onToggleVoice();
              }
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
              isListening
                ? 'border-cyan-400 bg-cyan-500/25 text-cyan-300'
                : isSpeaking
                ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                : 'border-slate-700/80 bg-slate-900/80 text-slate-300 hover:border-cyan-400/70 hover:text-white'
            }`}
            title={
              isSpeaking
                ? 'حبس الصوت'
                : isListening
                ? 'حبس الاستماع'
                : 'هضر بالدارجة مع M3ak'
            }
            aria-label="Voice input"
          >
            {isSpeaking ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    );
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAnalyzing) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const latestAiMsg =
    [...messages].reverse().find((m) => m.sender === 'ai') ||
    messages[messages.length - 1];
  const recentCommands = messages.slice(-4);
  const activePlan =
    taskState.browserAgentPlan || latestAiMsg?.actionResponse?.browserAgentPlan;
  const activeProgressStage =
    taskState.researchProgress || activePlan?.progressStage || null;
  const progressStages: Array<'UNDERSTANDING' | 'SEARCHING' | 'ANALYZING' | 'READY'> = [
    'UNDERSTANDING',
    'SEARCHING',
    'ANALYZING',
    'READY',
  ];
  const activeStageIndex = activeProgressStage
    ? progressStages.indexOf(activeProgressStage)
    : -1;

  return (
    <div
      data-m3ak-overlay="true"
      style={{ right: `${pos.right}px`, bottom: `${pos.bottom}px` }}
      className={`fixed z-50 flex w-[372px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[22px] border ${stateBorderColor} bg-slate-950/90 text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.78),0_0_36px_rgba(16,185,129,0.18)] backdrop-blur-2xl`}
    >
      {/* 1. Draggable JARVIS Voice Companion Header */}
      <div
        onPointerDown={startDrag}
        className="flex cursor-grab items-center justify-between border-b border-slate-800/80 bg-slate-950/85 px-3.5 py-2.5 select-none active:cursor-grabbing"
        title="اسحب لتحريك M3ak في أي مكان"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold tracking-tight text-white">
            {AI_NAME}
          </span>
          <span className="text-[11px] text-slate-500">
            ({AI_NAME_ARABIC})
          </span>
          <span aria-hidden="true" className="text-slate-700">
            ·
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider ${stateColorText}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
            <span>{visualState}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleWakeStandby && (
            <button
              type="button"
              onClick={onToggleWakeStandby}
              className={`rounded-lg border px-2 py-1 text-[10.5px] font-semibold transition-colors ${
                wakeStandbyActive
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title="تفعيل أو إيقاف الاستماع التلقائي لـ Salam Jarvis"
            >
              {wakeStandbyActive ? 'Salam Jarvis: ON' : 'Wake: OFF'}
            </button>
          )}
          <button
            type="button"
            onClick={onMinimize}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-white transition-colors"
            title="تصغير إلى أيقونة M3ak العائمة (Orb)"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onHide}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-rose-400 transition-colors"
            title="إخفاء"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Microphone Permission Denied Visible Fallback */}
      {micPermissionDenied && (
        <div
          className="mx-3.5 mt-2.5 rounded-xl border border-rose-500/50 bg-rose-950/40 p-2.5 text-[11.5px] leading-relaxed text-rose-200 font-darija"
          dir="rtl"
        >
          <div className="font-semibold text-rose-300">
            صلاحية الميكروفون مقفولة فهاد الصفحة:
          </div>
          <div>
            باش تهضر مع M3ak بـ &quot;Salam Jarvis&quot;، كليكي على أيقونة القفل
            حدا الرابط الفوق فالمتصفح وفعل <strong>Microphone (Allow)</strong>،
            من بعد كليكي على الكرة الضوئية لتحت.
          </div>
        </div>
      )}

      {/* 2. Central Voice-First Reactive AI Core Stage */}
      <div className="flex flex-col items-center px-4 pt-3.5 pb-2.5 text-center">
        <button
          type="button"
          onClick={onToggleVoice}
          className="group relative flex items-center justify-center rounded-full focus:outline-none transition-transform hover:scale-105"
          title={
            isSpeaking
              ? 'إضغط لإيقاف الصوت'
              : isListening
              ? 'إضغط لإيقاف الاستماع'
              : 'إضغط للتحدث أو قول Salam Jarvis'
          }
        >
          <JarvisOrbCore visualState={visualState} size="lg" />
        </button>

        {/* Reactive Audio Waveform Bars when LISTENING or SPEAKING */}
        {(isListening || isSpeaking) && (
          <div className="mt-2 flex h-4 items-center justify-center gap-1">
            <span className="h-2.5 w-1 animate-bounce rounded-full bg-cyan-400 [animation-delay:0ms]" />
            <span className="h-4 w-1 animate-bounce rounded-full bg-emerald-400 [animation-delay:120ms]" />
            <span className="h-3 w-1 animate-bounce rounded-full bg-cyan-300 [animation-delay:240ms]" />
            <span className="h-4 w-1 animate-bounce rounded-full bg-emerald-400 [animation-delay:90ms]" />
            <span className="h-2 w-1 animate-bounce rounded-full bg-cyan-400 [animation-delay:180ms]" />
          </div>
        )}

        <div
          className={`mt-1.5 text-xs font-semibold font-darija ${stateColorText}`}
          dir="auto"
        >
          {statusLabelDarija}
        </div>

        {/* Live Voice Speech Transcript */}
        {liveTranscript && (
          <div
            className="mt-1.5 max-w-full rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-100 font-darija"
            dir="auto"
          >
            &ldquo;{liveTranscript}&rdquo;
          </div>
        )}

        {/* Primary Voice Controls */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={onToggleVoice}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              isListening
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-400/70 hover:text-white'
            }`}
          >
            <Mic className="h-3 w-3 text-cyan-400" />
            <span>{isListening ? 'حبس الاستماع' : 'هضر دابا'}</span>
          </button>

          {isSpeaking ? (
            <button
              type="button"
              onClick={() => (onStopSpeaking ? onStopSpeaking() : onToggleVoice())}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/60 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors"
            >
              <VolumeX className="h-3 w-3" />
              <span>حبس الصوت</span>
            </button>
          ) : (
            latestAiMsg && (
              <button
                type="button"
                onClick={() => onSpeakText(latestAiMsg.text)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:border-emerald-500/60 transition-colors"
              >
                <Volume2 className="h-3 w-3" />
                <span>عاود سمع</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onAnalyzePage(false)}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-emerald-500/60 hover:text-white disabled:opacity-50 transition-colors"
          >
            <Search className="h-3 w-3 text-emerald-400" />
            <span>شنو هنا؟</span>
          </button>
        </div>
      </div>

      {/* Subtle Task-Progress State: UNDERSTANDING -> SEARCHING -> ANALYZING -> READY */}
      {activeProgressStage && (
        <div className="mx-3.5 mb-2 flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-900/60 px-2.5 py-1.5 text-[10px]">
          {progressStages.map((stage, idx) => {
            const isCurrent = stage === activeProgressStage;
            const isPassed = activeStageIndex >= idx;
            return (
              <React.Fragment key={stage}>
                <span
                  className={`font-mono-tabular tracking-tight transition-colors ${
                    isCurrent
                      ? 'font-bold text-cyan-300'
                      : isPassed
                      ? 'font-medium text-emerald-400/90'
                      : 'text-slate-600'
                  }`}
                >
                  {stage}
                </span>
                {idx < progressStages.length - 1 && (
                  <span aria-hidden="true" className="text-slate-700">
                    →
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* 3. Active Spoken Response HUD Card */}
      {latestAiMsg && (
        <div className="mx-3.5 mb-2 rounded-xl border border-slate-800 border-l-2 border-l-emerald-400 bg-slate-900/75 px-3 py-2.5 text-xs">
          <div
            className="whitespace-pre-line font-darija text-[12.5px] leading-relaxed text-slate-100"
            dir="auto"
          >
            {latestAiMsg.text}
          </div>

          {/* Multi-Step Browser Agent Plan & Verified Sources */}
          {activePlan &&
            (activePlan.steps.length > 0 || activePlan.sources.length > 0) && (
              <div className="mt-2.5 space-y-2 border-t border-slate-800/80 pt-2">
                {activePlan.steps.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Browser Agent Steps</span>
                      {typeof activePlan.adsFilteredCount === 'number' &&
                        activePlan.adsFilteredCount > 0 && (
                          <span className="text-emerald-400/90">
                            Filtered {activePlan.adsFilteredCount} sponsored ads
                          </span>
                        )}
                    </div>
                    <div className="max-h-20 space-y-1 overflow-y-auto pr-1">
                      {activePlan.steps.map((st) => (
                        <div
                          key={st.stepNumber}
                          className="flex items-baseline gap-1.5 text-[10.5px] text-slate-300"
                          dir="auto"
                        >
                          <span className="font-mono-tabular text-[10px] text-emerald-400 shrink-0">
                            0{st.stepNumber}.
                          </span>
                          <span className="truncate">{st.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePlan.sources.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-400">
                      Inspected Sources ({activePlan.sources.length})
                    </div>
                    <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                      {activePlan.sources.map((src) => (
                        <button
                          key={src.url}
                          type="button"
                          onClick={() =>
                            dispatchBrowserAgentPlan({
                              browserAction: 'open_search_result',
                              safetyTier: 'SAFE_AUTOMATIC',
                              targetUrl: src.url,
                              searchQuery: activePlan.searchQuery,
                              progressStage: 'READY',
                              steps: activePlan.steps,
                              sources: activePlan.sources,
                            })
                          }
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-950/70 px-2 py-1 text-left text-[10.5px] text-slate-200 hover:border-cyan-400/60 hover:text-white transition-colors"
                          title={src.snippet}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-emerald-300">
                              {src.title}
                            </div>
                            <div className="truncate text-[9.5px] text-slate-500">
                              {src.domain}
                              {src.isOfficial ? ' · Official Source' : ''}
                              {src.freshnessNote ? ` · ${src.freshnessNote}` : ''}
                            </div>
                          </div>
                          <ArrowUpRight className="h-3 w-3 shrink-0 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activePlan.uncertaintyNote && (
                  <div
                    className="text-[10px] leading-snug text-slate-400 font-darija"
                    dir="auto"
                  >
                    ملاحظة دقة: {activePlan.uncertaintyNote}
                  </div>
                )}
              </div>
            )}

          {taskState.requiresConfirmation && (
            <div className="mt-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
              <div className="flex items-start gap-1.5" dir="rtl">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <div className="text-[11px] font-darija text-amber-100">
                  هادي خطوة حساسة، بغيتي نأكدها ليك ولا تكليكي نتا؟
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onConfirmSensitiveAction(true)}
                  className="flex-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  أه، كمل
                </button>
                <button
                  type="button"
                  onClick={() => onConfirmSensitiveAction(false)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  أنا غنديرها
                </button>
              </div>
            </div>
          )}

          {latestAiMsg.pageAnalysis &&
            latestAiMsg.pageAnalysis.keyElements.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-800/80 pt-2">
                {latestAiMsg.pageAnalysis.keyElements.slice(0, 3).map((ke) => (
                  <button
                    key={ke.id}
                    type="button"
                    onClick={() =>
                      onHighlightElementManual?.(ke.id, ke.purposeDarija)
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-[10.5px] text-emerald-300 hover:border-emerald-500/50 transition-colors"
                  >
                    <Target className="h-2.5 w-2.5" />
                    <span>{ke.label}</span>
                  </button>
                ))}
              </div>
            )}

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
            <span>
              {latestAiMsg.actionResponse?.skillLabel
                ? `${latestAiMsg.actionResponse.skillLabel}${
                    latestAiMsg.actionResponse.explanationDepth
                      ? ` · ${latestAiMsg.actionResponse.explanationDepth}`
                      : ''
                  }`
                : pageContext
                ? `${pageContext.pageTitle.slice(0, 28)} · ${pageContext.elements.length} عناصر`
                : formatTimeShort(latestAiMsg.timestamp)}
            </span>
            <div className="flex items-center gap-2">
              {taskState.targetElement && (
                <span className="font-mono-tabular text-cyan-400">
                  Target: #{taskState.targetElement}
                </span>
              )}
              {taskState.status !== 'IDLE' && (
                <button
                  type="button"
                  onClick={onStopTask}
                  className="inline-flex items-center gap-0.5 text-slate-400 hover:text-rose-400"
                >
                  <XCircle className="h-3 w-3" />
                  <span>إلغاء</span>
                </button>
              )}
              {isFailedOrBlocked && (
                <button
                  type="button"
                  onClick={onRetryTask}
                  className="inline-flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>عاود</span>
                </button>
              )}
              {latestAiMsg.actionResponse?.taskCompleted && (
                <span className="inline-flex items-center gap-0.5 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>تم</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Minimal Recent Voice/Command Log */}
      <div className="mx-3.5 mb-2 max-h-24 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/60 px-2.5 py-1.5 space-y-1 text-[11px]">
        {recentCommands.map((m) => (
          <div
            key={m.id}
            className="flex items-baseline gap-1.5 truncate text-slate-400"
            dir="auto"
          >
            <span
              className={`font-semibold shrink-0 ${
                m.sender === 'user' ? 'text-cyan-400' : 'text-emerald-400'
              }`}
            >
              {m.sender === 'user' ? 'نتا:' : 'M3ak:'}
            </span>
            <span className="truncate">{m.text}</span>
          </div>
        ))}
      </div>

      {/* 5. Quick Voice/Tap Prompts Bar */}
      <div className="border-t border-slate-800/80 bg-slate-950/60 px-3 py-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {DARIJA_QUICK_PROMPTS.map((item) => (
            <button
              key={item.text}
              type="button"
              disabled={isAnalyzing}
              onClick={() => onSendMessage(item.text)}
              className="shrink-0 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-[11px] text-slate-300 font-darija hover:border-emerald-500/60 hover:text-emerald-300 disabled:opacity-40 transition-colors whitespace-nowrap"
              dir="auto"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Secondary Keyboard Fallback Input & Vision/Settings */}
      <form
        onSubmit={handleFormSubmit}
        className="border-t border-slate-800/80 bg-slate-950/90 px-3 py-2"
      >
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-2.5 py-1 focus-within:border-emerald-500/70">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isAnalyzing}
            dir="auto"
            placeholder="أو كتب الأمر ديالك هنا (مثال: fin kayn login?)..."
            className="w-full bg-transparent text-[11.5px] text-white placeholder-slate-500 focus:outline-none disabled:opacity-50 font-darija"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isAnalyzing}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="h-3 w-3" />
            <span>أمر</span>
          </button>

          <button
            type="button"
            onClick={() => onAnalyzePage(true)}
            disabled={isAnalyzing}
            className="rounded-lg p-1 text-slate-400 hover:text-sky-400 disabled:opacity-40 transition-colors"
            title="Analyze visible webpage screenshot with Gemini Vision"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-lg p-1 text-slate-400 hover:text-white transition-colors"
            title="Voice & Privacy Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
