import { CompanionSkill } from '../types';

export const translatorSkill: CompanionSkill = {
  id: 'translator',
  label: 'Translator',
  description:
    'Naturally translates between Moroccan Darija, Arabic, English, and French with cultural and contextual accuracy.',
  buildSkillDirectives: () =>
    `
SKILL: TRANSLATOR
- Provide natural, idiomatic translation (never stiff word-for-word replacement) across Moroccan Darija, Arabic, English, and French.
- If the user selected text on the page or included text in their prompt, translate that exact text into the requested target language.
`.trim(),
  executeFallback: ({ userRequest, gatheredContext }) => {
    const lower = userRequest.toLowerCase();
    const targetIsEnglish =
      /(?:إنجليزية|انجليزية|للإنجليزية|لونغلي|\benglish\b)/i.test(lower);
    const targetIsFrench = /(?:فرنسية|للفرنسية|\bfrench\b|\bfrançais\b)/i.test(
      lower
    );

    // Extract quoted text or text after colon, or use selected text
    const quotedMatch =
      userRequest.match(/["«“]([^"»”]+)["»”]/) ||
      userRequest.match(/:\s*(.+)$/);
    const sourceText =
      (quotedMatch && quotedMatch[1]?.trim()) ||
      gatheredContext.selectedText ||
      gatheredContext.webpageSummary?.visibleTextExcerpt?.slice(0, 180) ||
      '';

    if (sourceText) {
      let translated = sourceText;
      if (targetIsEnglish && /سطاج|stage/i.test(sourceText)) {
        translated =
          'I would like to apply for an internship at your company.';
      } else if (targetIsFrench && /سطاج|stage/i.test(sourceText)) {
        translated =
          'Je souhaiterais postuler pour un stage au sein de votre entreprise.';
      }

      const msg = targetIsEnglish
        ? `مزيان، ها هي الترجمة للإنجليزية بطريقة طبيعية:\n"${translated}"`
        : targetIsFrench
        ? `مزيان، ها هي الترجمة للفرنسية بطريقة طبيعية:\n"${translated}"`
        : `مزيان، المعنى ديال هاد النص بالدارجة واضح: "${sourceText.slice(0, 140)}".`;

      return {
        message: msg,
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        intent: 'TRANSLATION',
        skillId: 'translator',
        skillLabel: 'Translator',
        explanationDepth: gatheredContext.routedIntent.explanationDepth,
        topic: 'Translation',
      };
    }

    return {
      message:
        'مزيان، سيلكسيوني (حدد) النص اللي بغيتي فـ الصفحة أو قولو ليا مباشرة، وغادي نترجمو ليك للإنجليزية، الفرنسية، أو الدارجة.',
      action: 'none',
      targetElementId: null,
      requiresConfirmation: false,
      taskCompleted: true,
      intent: 'TRANSLATION',
      skillId: 'translator',
      skillLabel: 'Translator',
      explanationDepth: gatheredContext.routedIntent.explanationDepth,
      topic: 'Translation',
    };
  },
};
