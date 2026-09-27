import React from 'react';
import { X, Trash2, Shield, Volume2, Eye, RotateCcw } from 'lucide-react';
import { UserSettings } from '../../shared/types';
import { AssistantAvatar } from './AssistantAvatar';
import { AI_NAME } from '../../shared/constants';

interface SettingsModalProps {
  isOpen: boolean;
  settings: UserSettings;
  onUpdateSettings: (partial: Partial<UserSettings>) => void;
  onClearHistory: () => void;
  onReplayOnboarding: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClearHistory,
  onReplayOnboarding,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <AssistantAvatar state="idle" size="sm" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                إعدادات {AI_NAME} · Settings & Privacy
              </h3>
              <p className="text-xs text-slate-400">
                Privacy-first Chrome Extension configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Settings Options */}
        <div className="mt-4 space-y-3.5">
          {/* Voice Interaction */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-950/50 p-3">
            <div className="pr-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>تفعيل الصوت والميكروفون (Voice Mode)</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                التحدث بالدارجة وقراءة الأجوبة بصوت مسموع
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.voiceEnabled}
              onChange={(e) =>
                onUpdateSettings({ voiceEnabled: e.target.checked })
              }
              className="h-4 w-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* Auto TTS */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-950/50 p-3">
            <div className="pr-3">
              <div className="text-xs font-semibold text-slate-200">
                قراءة الخطوات تلقائياً (Auto Text-to-Speech)
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                ينطق المساعد كل خطوة جديدة تلقائياً
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoReadResponses}
              onChange={(e) =>
                onUpdateSettings({ autoReadResponses: e.target.checked })
              }
              className="h-4 w-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* Speech Recognition Language */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-950/50 p-3">
            <div className="pr-3">
              <div className="text-xs font-semibold text-slate-200">
                لغة الميكروفون (Speech Input Locale)
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Darija Arabic, French, or English
              </p>
            </div>
            <select
              value={settings.speechLang}
              onChange={(e) =>
                onUpdateSettings({
                  speechLang: e.target.value as UserSettings['speechLang'],
                })
              }
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ar-MA">العربية / الدارجة (ar-MA)</option>
              <option value="fr-FR">Français / الدارجة (fr-FR)</option>
              <option value="en-US">English (en-US)</option>
            </select>
          </div>

          {/* Sensitive Action Guard */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-950/50 p-3">
            <div className="pr-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                <span>تأكيد العمليات الحساسة (Safety Confirmation)</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                طلب الإذن دائماً قبل الشراء، تغيير كلمة السر، أو إرسال الوثائق
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.confirmSensitiveActions}
              onChange={(e) =>
                onUpdateSettings({ confirmSensitiveActions: e.target.checked })
              }
              className="h-4 w-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* Vision / Screenshot Mode */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-950/50 p-3">
            <div className="pr-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Eye className="h-3.5 w-3.5 text-sky-400" />
                <span>تحليل لقطة الشاشة (Vision Mode Fallback)</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                استعمال Vision فقط عند الحاجة لتحليل العناصر المعقدة
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.visionFallbackEnabled}
              onChange={(e) =>
                onUpdateSettings({ visionFallbackEnabled: e.target.checked })
              }
              className="h-4 w-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* Save Conversation History */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-950/50 p-3">
            <div className="pr-3">
              <div className="text-xs font-semibold text-slate-200">
                حفظ المحادثة محلياً (Save Local History)
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                تخزين المحادثة فالمتصفح ديالك فقط
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.saveHistory}
              onChange={(e) =>
                onUpdateSettings({ saveHistory: e.target.checked })
              }
              className="h-4 w-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Actions Footer */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClearHistory();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>مسح المحادثة</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onReplayOnboarding();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>جولة الترحيب</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
          >
            حفظ وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
