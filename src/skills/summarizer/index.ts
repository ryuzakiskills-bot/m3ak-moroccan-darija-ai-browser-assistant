import { CompanionSkill } from '../types';

export const summarizerSkill: CompanionSkill = {
  id: 'summarizer',
  label: 'Summarizer',
  description:
    'Summarizes webpages, selected text, articles, and long passages concisely in Moroccan Darija, English, or French.',
  buildSkillDirectives: (depth) =>
    `
SKILL: SUMMARIZER
- Summarize the selected text or bounded webpage content clearly and concisely.
- Focus on the core message, key takeaways, and any actionable items.
- Requested depth: ${depth}.
`.trim(),
  executeFallback: ({ gatheredContext, pageContext }) => {
    const { preferredLanguage, explanationDepth } =
      gatheredContext.routedIntent;

    if (gatheredContext.selectedText) {
      const snippet = gatheredContext.selectedText.slice(0, 180);
      return {
        message:
          preferredLanguage === 'en'
            ? `Here is a concise summary of the selected text: "${snippet}..."`
            : `الخلاصة ديال هاد النص اللي حددتي: كيركز أساسا على "${snippet}..." بأسلوب مباشر.`,
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        intent: 'SUMMARIZATION',
        skillId: 'summarizer',
        skillLabel: 'Summarizer',
        explanationDepth,
        topic: 'Text Summary',
      };
    }

    const title =
      gatheredContext.webpageSummary?.pageTitle ||
      pageContext?.pageTitle ||
      'هاد الصفحة';
    const headings =
      gatheredContext.webpageSummary?.headings || pageContext?.headings || [];
    const topSections = headings.slice(0, 3).join('، ');
    const elemCount = pageContext?.elements.length || 0;

    const msg =
      preferredLanguage === 'en'
        ? `Summary of "${title}": ${
            topSections
              ? `Main sections include ${topSections}. `
              : ''
          }It provides ${elemCount} interactive controls for completing your task.`
        : `الخلاصة ديال هاد الصفحة ("${title}"): ${
            topSections ? `أهم الأقسام اللي فيها هي ${topSections}. ` : ''
          }وفيها ${elemCount} عناصر تفاعلية باش تقضي الغرض ديالك بسهولة.`;

    return {
      message: msg,
      action: 'none',
      targetElementId: null,
      requiresConfirmation: false,
      taskCompleted: true,
      intent: 'SUMMARIZATION',
      skillId: 'summarizer',
      skillLabel: 'Summarizer',
      explanationDepth,
      topic: title,
    };
  },
};

export const documentAssistantSkill: CompanionSkill = {
  id: 'document-assistant',
  label: 'Document Assistant',
  description:
    'Summarizes, explains, extracts key points, and answers questions about accessible documents and articles.',
  buildSkillDirectives: () =>
    `
SKILL: DOCUMENT ASSISTANT
- Extract key points, requirements, and main sections from the accessible document or page text.
- Answer the user's question about the document clearly.
`.trim(),
  executeFallback: (params) => {
    const base = summarizerSkill.executeFallback(params);
    if (!base) return null;
    return {
      ...base,
      skillId: 'document-assistant',
      skillLabel: 'Document Assistant',
    };
  },
};
