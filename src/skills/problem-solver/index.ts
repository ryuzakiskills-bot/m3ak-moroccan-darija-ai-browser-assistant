import { CompanionSkill } from '../types';

export const problemSolverSkill: CompanionSkill = {
  id: 'problem-solver',
  label: 'Problem Solver',
  description:
    'Solves logical, mathematical, and practical problems with structured reasoning and trade-off analysis.',
  buildSkillDirectives: () =>
    `
SKILL: PROBLEM SOLVER
- Break the problem down into clear logical steps, compute any calculations accurately, and compare possible solutions.
`.trim(),
  executeFallback: ({ userRequest, gatheredContext }) => {
    return {
      message: `مزيان، نحللو هاد المشكل بطريقة منطقية: أولا نحددو المعطيات الأساسية، ثانيا نقارنو الحلول الممكنة، وثالثا نختارو الحل الأسرع والأقل تكلفة. قول ليا التفاصيل أو الأرقام اللي عندك ونحسبوها مجموعين.`,
      action: 'none',
      targetElementId: null,
      requiresConfirmation: false,
      taskCompleted: true,
      intent: 'PROBLEM_SOLVING',
      skillId: 'problem-solver',
      skillLabel: 'Problem Solver',
      explanationDepth: gatheredContext.routedIntent.explanationDepth,
      topic: userRequest.slice(0, 50),
    };
  },
};
