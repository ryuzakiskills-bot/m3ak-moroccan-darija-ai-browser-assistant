import { CompanionSkill } from '../types';

export const codingAssistantSkill: CompanionSkill = {
  id: 'coding-assistant',
  label: 'Coding Assistant',
  description:
    'Explains code step by step, debugs errors, suggests fixes, and generates clean code snippets.',
  buildSkillDirectives: (depth) =>
    `
SKILL: CODING ASSISTANT
- Explain code logic, diagnose errors/bugs, suggest concrete fixes, or provide concise code snippets.
- Adapt explanation to ${depth} mode.
- Keep spoken message natural so TTS reads the explanation smoothly without reading raw punctuation symbols aloud.
`.trim(),
  executeFallback: ({ userRequest, gatheredContext }) => {
    const lower = userRequest.toLowerCase();
    const { intent, explanationDepth, preferredLanguage } =
      gatheredContext.routedIntent;

    const codeSample =
      gatheredContext.selectedText ||
      gatheredContext.visibleCodeSnippets?.[0] ||
      '';

    if (intent === 'DEBUGGING' || /\b(error|bug|makikhdemch|ما كيخدمش|مشكل)\b/i.test(lower)) {
      const msg =
        preferredLanguage === 'en'
          ? `To fix this code error: check if a variable or prop is undefined before accessing it, verify async/await promises are handled, and confirm imports match exports.${
              codeSample ? ` Inspecting: ${codeSample.slice(0, 90)}` : ''
            }`
          : `هاد المشكل فالكود غالبا كيجي من متغير باقي undefined، أو Promise ما درتيش ليها await، أو اسم الدالة ما مطابقش فـ import.${
              codeSample
                ? ` فهاد الجزء ("${codeSample.slice(0, 80)}")، تأكد أولا أن القيم كاينة قبل ما تستعملها.`
                : ' وري ليا السطر اللي عاطيك الخطأ أو سيلكسيونيه ونصلحو ليك فالبلاصة.'
            }`;

      return {
        message: msg,
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        intent: 'DEBUGGING',
        skillId: 'coding-assistant',
        skillLabel: 'Coding Assistant',
        explanationDepth,
        topic: 'Code Debugging',
      };
    }

    const msg =
      preferredLanguage === 'en'
        ? `Let's break this code down step by step: first it reads the input parameters, then processes the logic, and finally returns the result.${
            codeSample ? ` Focusing on: ${codeSample.slice(0, 90)}` : ''
          }`
        : `هادي سهلة، نشرح ليك الكود خطوة بخطوة: أولا كياخد المعطيات (Inputs)، من بعد كيطبق عليهم المنطق البرمجي وسط الدالة، وفالأخير كيرجع النتيجة (Return).${
            codeSample
              ? ` فهاد الكود اللي قدامنا ("${codeSample.slice(0, 80)}")، كل سطر مكلف بمرحلة واضحة.`
              : ' سيلكسيوني أي كود فـ الصفحة أو حطو ليا هنا ونفصلو ليك سطر بسطر.'
          }`;

    return {
      message: msg,
      action: 'none',
      targetElementId: null,
      requiresConfirmation: false,
      taskCompleted: true,
      intent: 'CODING',
      skillId: 'coding-assistant',
      skillLabel: 'Coding Assistant',
      explanationDepth,
      topic: 'Code Explanation',
    };
  },
};
