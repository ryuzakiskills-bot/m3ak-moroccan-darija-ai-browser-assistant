import { CompanionSkill } from '../types';
import { generalKnowledgeSkill } from '../general';

export const tutorSkill: CompanionSkill = {
  id: 'tutor',
  label: 'Teacher / Tutor',
  description:
    'Explains concepts step by step, adapts from beginner (ELI5) to advanced technical level, and provides clear examples.',
  buildSkillDirectives: (depth) =>
    `
SKILL: TEACHER / TUTOR
- Act as a patient, sharp Moroccan Darija tutor.
- Break complex subjects into digestible parts and give a concrete example.
- Requested explanation mode: ${depth}.
  * If ELI5: Use an everyday Moroccan life analogy with zero jargon.
  * If STEP_BY_STEP: Walk through 1, 2, 3 sequentially.
  * If TECHNICAL / DEEP: Provide architecture-level detail and edge cases.
- Respect conversational continuity: if the user says "ما فهمتش" or "بسطها ليا" or "عطيني example", build directly on the previous topic in memory.
`.trim(),
  executeFallback: (params) => {
    const fromGeneral = generalKnowledgeSkill.executeFallback(params);
    if (fromGeneral) {
      return {
        ...fromGeneral,
        skillId: 'tutor',
        skillLabel: 'Teacher / Tutor',
      };
    }

    const topic =
      params.gatheredContext.activeTopic || params.userRequest.trim();
    const depth = params.gatheredContext.routedIntent.explanationDepth;

    const msg =
      depth === 'ELI5'
        ? `مزيان، نبسطو "${topic}" بزاف: الفكرة الأساسية هي تقسم الحاجة الكبيرة لخطوات صغار ومفهومين باش تتحكم فكل جزء بوحدو. قول ليا فين بالضبط بغيتي نزيدو نوضحو؟`
        : `آه، فهمت شنو باغي تعرف على "${topic}". نبداو بالفكرة الأساسية، ومن بعد نشوفو كيفاش كتطبق بمثال عملي خطوة بخطوة.`;

    return {
      message: msg,
      action: 'none',
      targetElementId: null,
      requiresConfirmation: false,
      taskCompleted: true,
      intent: params.gatheredContext.routedIntent.intent,
      skillId: 'tutor',
      skillLabel: 'Teacher / Tutor',
      explanationDepth: depth,
      topic,
    };
  },
};
