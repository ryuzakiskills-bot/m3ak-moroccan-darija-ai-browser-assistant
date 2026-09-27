import React, { useState } from 'react';
import { Mic, ShieldCheck, Sparkles, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { AssistantAvatar } from '../components/AssistantAvatar';
import { AI_NAME, AI_NAME_ARABIC } from '../../shared/constants';
import { AvatarState } from '../../shared/types';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface OnboardingStep {
  stepNumber: number;
  avatarState: AvatarState;
  titleDarija: string;
  subtitleDarija: string;
  englishNote: string;
  exampleList?: string[];
  permissionsList?: { name: string; descDarija: string }[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    stepNumber: 1,
    avatarState: 'speaking',
    titleDarija: `سلام 👋 أنا ${AI_NAME} (${AI_NAME_ARABIC}).`,
    subtitleDarija:
      'المساعد الشخصي ديالك وسط المتصفح Google Chrome. ديما حاضر معاك باش يسهّل عليك الانترنيت بالدارجة المغربية.',
    englishNote: 'Step 1 of 5 · Welcome to your personal Moroccan Darija AI Browser Assistant',
  },
  {
    stepNumber: 2,
    avatarState: 'idle',
    titleDarija: 'نقدر نعاونك تفهم وتستعمل المواقع خطوة بخطوة.',
    subtitleDarija:
      'ما غاديش نعطيك 10 ديال التعليمات دقة وحدة وندوخك. كنشوف الصفحة لي قدامك، وكنضوي ليك على البلاصة الصحيحة خطوة بخطوة حتى تكمل الغرض ديالك.',
    englishNote: 'Step 2 of 5 · Visual step-by-step guidance without overwhelming you',
  },
  {
    stepNumber: 3,
    avatarState: 'waiting',
    titleDarija: 'قول ليا غير شنو بغيتي تدير.',
    subtitleDarija:
      'كتب أو هضر معايا بالدارجة (بالعربية أو بالحروف اللاتينية)، بالفرنسية أو بالإنجليزية:',
    englishNote: 'Step 3 of 5 · Natural Darija, Franco-Arabic, French & English support',
    exampleList: [
      '"bghit ndir compte hna"',
      '"bghit n9leb 3la login"',
      '"bghit n3ammar had formulaire"',
      '"bghit n9leb 3la stage"',
      '"bghit nchri had produit"',
    ],
  },
  {
    stepNumber: 4,
    avatarState: 'thinking',
    titleDarija: 'صلاحيات الميكروفون وحماية الخصوصية ديالك 🔒',
    subtitleDarija:
      'كنحترمو الخصوصية ديالك 100%. ما كنراقبوش المواقع فالخلفية، وما كنخبيوش نهائياً كلمات السر (Passwords).',
    englishNote: 'Step 4 of 5 · Microphone & Manifest V3 Privacy-First Permissions',
    permissionsList: [
      {
        name: 'Microphone (اختياري 🎤)',
        descDarija: 'باش تضغط على زر الميكروفون وتهضر معايا بالدارجة وقتما بغيتي.',
      },
      {
        name: 'activeTab & scripting',
        descDarija: 'كنحلل الصفحة الحالية غير ملي كتطلب مني نعاونك فيها.',
      },
      {
        name: 'Sensitive Action Confirmation',
        descDarija: 'قبل أي خلاص، شراء، أو إرسال إستمارة مهمة، كنسولك ديما واش موافق.',
      },
    ],
  },
  {
    stepNumber: 5,
    avatarState: 'success',
    titleDarija: 'واجدين باش نبداو! 🚀',
    subtitleDarija:
      'جرب دابا تقولي "bghit n9leb 3la login" أو "bghit ndir compte hna" وشوف كيفاش غادي نقودك خطوة بخطوة.',
    englishNote: 'Step 5 of 5 · Ready to assist you on any webpage',
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const [stepIdx, setStepIdx] = useState(0);

  if (!isOpen) return null;

  const current = ONBOARDING_STEPS[stepIdx];
  const isLast = stepIdx === ONBOARDING_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* Top Progress Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-mono-tabular text-emerald-400">
              0{current.stepNumber} / 0{ONBOARDING_STEPS.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>{current.englishNote}</span>
          </div>
          <button
            onClick={onComplete}
            className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap"
          >
            تخطي (Skip)
          </button>
        </div>

        {/* Main Content */}
        <div className="py-6 text-center">
          <div className="mx-auto mb-5 flex justify-center">
            <AssistantAvatar
              state={current.avatarState}
              size="xl"
              showStatusDot
            />
          </div>

          <h2
            className="text-xl font-bold text-white font-darija leading-snug"
            dir="rtl"
          >
            {current.titleDarija}
          </h2>

          <p
            className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300 font-darija"
            dir="rtl"
          >
            {current.subtitleDarija}
          </p>

          {current.exampleList && (
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 text-left">
              {current.exampleList.map((ex) => (
                <div
                  key={ex}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-mono-tabular text-emerald-300"
                >
                  {ex}
                </div>
              ))}
            </div>
          )}

          {current.permissionsList && (
            <div className="mt-5 space-y-2.5 text-right" dir="rtl">
              {current.permissionsList.map((perm) => (
                <div
                  key={perm.name}
                  className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {perm.name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400 font-darija">
                      {perm.descDarija}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLast && (
            <div className="mt-5 inline-flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>جميع الأنظمة واجدة · All browser assistant modules ready</span>
            </div>
          )}
        </div>

        {/* Stepper Controls */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setStepIdx((prev) => Math.max(0, prev - 1))}
            disabled={stepIdx === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>السابق</span>
          </button>

          <div className="flex items-center gap-1.5">
            {ONBOARDING_STEPS.map((s, idx) => (
              <button
                key={s.stepNumber}
                onClick={() => setStepIdx(idx)}
                aria-label={`Go to onboarding step ${s.stepNumber}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === stepIdx
                    ? 'w-6 bg-emerald-500'
                    : 'w-1.5 bg-slate-700 hover:bg-slate-600'
                }`}
              />
            ))}
          </div>

          {!isLast ? (
            <button
              onClick={() => setStepIdx((prev) => prev + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
            >
              <span className="font-darija">التالي</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="font-darija">بدا دابا (Start)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
