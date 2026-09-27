import { CompanionSkill } from '../types';

export const webpageAnalyzerSkill: CompanionSkill = {
  id: 'webpage-analyzer',
  label: 'Webpage Analyzer',
  description:
    'Understands the current webpage, explains what the website does, and identifies key sections, buttons, links, and forms.',
  buildSkillDirectives: () =>
    `
SKILL: WEBPAGE ANALYZER
- Explain what the current webpage is about, what features it offers, and highlight the most useful action if relevant.
- Never fabricate elements that do not exist in the provided webpage context.
`.trim(),
  executeFallback: ({ pageContext, gatheredContext }) => {
    if (!pageContext) return null;
    const lang = gatheredContext.routedIntent.preferredLanguage;
    const topHeading = pageContext.headings?.[0] || pageContext.pageTitle;
    const textPool = `${pageContext.visibleText || ''} ${pageContext.summaryText || ''}`;
    const priceMatch = textPool.match(
      /(\d[\d\s.,]*\s*(?:DH|MAD|درهم|€|\$|DHS))/i
    );
    const buttons = (pageContext.buttons || [])
      .slice(0, 3)
      .map((b) => b.text)
      .filter(Boolean)
      .join('، ');
    const inputs = (pageContext.inputs || [])
      .slice(0, 3)
      .map((i) => i.label)
      .filter(Boolean)
      .join('، ');
    const firstEl = pageContext.elements.find((e) => e.visible && !e.disabled);

    const msg =
      lang === 'en'
        ? `This website is "${topHeading}".${
            priceMatch ? ` It displays a price of ${priceMatch[1].trim()}.` : ''
          }${buttons ? ` Main actions available: ${buttons}.` : ''}${
            inputs ? ` Input fields: ${inputs}.` : ''
          } Tell me what you want to do here and I will guide you.`
        : `مزيان، هاد الموقع هو "${topHeading}".${
            priceMatch ? ` كيعرض الثمن (${priceMatch[1].trim()}).` : ''
          }${buttons ? ` تقدر تستعمل فيه أزرار بحال: ${buttons}.` : ''}${
            inputs ? ` وفيه خانات ديال: ${inputs}.` : ''
          } قول ليا شنو بغيتي تدير بالضبط ونمشيو خطوة بخطوة.`;

    return {
      message: msg,
      action: firstEl ? 'focus' : 'none',
      targetElementId: firstEl ? firstEl.id : null,
      requiresConfirmation: false,
      taskCompleted: true,
      intent: 'PAGE_ANALYSIS',
      skillId: 'webpage-analyzer',
      skillLabel: 'Webpage Analyzer',
      explanationDepth: gatheredContext.routedIntent.explanationDepth,
      topic: pageContext.pageTitle,
    };
  },
};

export const formAssistantSkill: CompanionSkill = {
  id: 'form-assistant',
  label: 'Form Assistant',
  description:
    'Explains form fields step-by-step, tells the user what information belongs in each field, never invents personal data, and requires confirmation before submitting.',
  buildSkillDirectives: () =>
    `
SKILL: FORM ASSISTANT
- Guide the user through the form one field at a time, explaining what information belongs in the highlighted input.
- Never invent sensitive personal information.
- Always set requiresConfirmation: true before submitting a form.
`.trim(),
  executeFallback: () => null, // Handled by DOM-grounded sequential form planner in ai-service.ts
};
