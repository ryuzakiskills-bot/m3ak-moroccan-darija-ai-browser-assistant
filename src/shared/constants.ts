import { TaskState, UserSettings } from './types';

export const AI_NAME = 'M3ak';
export const AI_NAME_ARABIC = 'معاك';
export const AVATAR_ASSET_PATH = '/assistant-avatar.png';

export const DEFAULT_SETTINGS: UserSettings = {
  voiceEnabled: true,
  autoReadResponses: true,
  saveHistory: true,
  confirmSensitiveActions: true,
  visionFallbackEnabled: true,
  speechLang: 'ar-MA',
};

export const INITIAL_TASK_STATE: TaskState = {
  id: 'task_idle',
  goal: '',
  currentStep: 0,
  totalEstimatedSteps: 0,
  status: 'IDLE',
  targetElement: null,
  currentInstruction: '',
  requiresConfirmation: false,
  actionType: 'none',
  completedSteps: [],
  lastUpdated: Date.now(),
};

export const DARIJA_QUICK_PROMPTS = [
  {
    text: '9leb lia 3la AI courses f Morocco',
    label: 'بحث: AI Courses فالمغرب',
    category: 'Research',
  },
  {
    text: '9leb lia 3la 3 universities f Spain li 3andhom bachelor marketing',
    label: 'بحث: جامعات فـ إسبانيا Marketing',
    category: 'Research',
  },
  {
    text: 'qleb lia 3la chi laptop gaming mzyan',
    label: 'بحث: Laptop Gaming مزيان',
    category: 'Research',
  },
  {
    text: '7ell YouTube',
    label: 'حل YouTube',
    category: 'Browser Agent',
  },
  {
    text: '7ell Google',
    label: 'حل Google',
    category: 'Browser Agent',
  },
  {
    text: 'شنو هو API؟',
    label: 'شنو هو API؟',
    category: 'Knowledge',
  },
  {
    text: 'كتب ليا email باش نطلب stage',
    label: 'كتب ليا email لـ Stage',
    category: 'Writer',
  },
  {
    text: 'قارن ليا React وVue',
    label: 'قارن React وVue',
    category: 'Decision',
  },
  {
    text: 'شنو خاصني ندير باش نتعلم English؟',
    label: 'خطة تعلم English',
    category: 'Planner',
  },
  {
    text: 'فين login؟',
    label: 'فين login؟',
    category: 'Visual Guide',
  },
];

export const SENSITIVE_KEYWORDS = [
  'pay',
  'payment',
  'checkout',
  'purchase',
  'buy now',
  'commander',
  'payer',
  'acheter',
  'delete',
  'remove',
  'supprimer',
  'cancel account',
  'submit application',
  'confirm transfer',
  'password',
  'mot de passe',
  'carte bancaire',
  'credit card',
  'cvv',
  'iban',
  'خلاص',
  'شراء',
  'حذف',
  'تأكيد الطلب',
  'إرسال الوثيقة',
];

export const FRIENDLY_DARIJA_ERROR =
  'وقع مشكل صغير 😅 جرب نعاود نحلل الصفحة.';
