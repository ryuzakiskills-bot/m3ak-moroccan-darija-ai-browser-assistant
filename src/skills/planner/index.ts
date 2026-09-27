import { CompanionSkill } from '../types';

export const plannerSkill: CompanionSkill = {
  id: 'planner',
  label: 'Planner',
  description:
    'Builds practical study plans, learning roadmaps, project plans, and step-by-step task breakdowns.',
  buildSkillDirectives: () =>
    `
SKILL: PLANNER
- Create a practical, actionable roadmap or step-by-step plan tailored to the user's goal.
- Group the plan into clear, realistic phases so the user can start immediately today.
`.trim(),
  executeFallback: ({ userRequest, gatheredContext }) => {
    const lower = userRequest.toLowerCase();
    const isEnglishPlan = /(?:إنجليزية|انجليزية|لونغلي|\benglish\b)/i.test(
      lower
    );

    if (isEnglishPlan) {
      return {
        message:
          'خطة عملية باش تتعلم English خطوة بخطوة: 1) كل نهار سمع 15 دقيقة ديال محتوى ساهل وعاود الجمل بصوتك. 2) حفظ 5 ديال العبارات اليومية فبلاصة كلمات معزولين. 3) هضر معايا هنا بـ English كل نهار 10 دقايق وغادي نصحح ليك بطريقة طبيعية.',
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        intent: 'PLANNING',
        skillId: 'planner',
        skillLabel: 'Planner',
        explanationDepth: 'STEP_BY_STEP',
        topic: 'English Learning Plan',
      };
    }

    return {
      message: `خليها عليا، ها هي خطة عملية مقسمة لـ 3 مراحل: المرحلة اللولة تفهم الأساسيات فـ أسبوع، المرحلة التانية تطبق بتمارين ومشاريع صغار، والمرحلة التالتة تراجع وتثبت المهارة. بغيتي نفصل ليك البرنامج اليومي؟`,
      action: 'none',
      targetElementId: null,
      requiresConfirmation: false,
      taskCompleted: true,
      intent: 'PLANNING',
      skillId: 'planner',
      skillLabel: 'Planner',
      explanationDepth: 'STEP_BY_STEP',
      topic: gatheredContext.activeTopic || userRequest.slice(0, 50),
    };
  },
};
