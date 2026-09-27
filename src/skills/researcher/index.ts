import { CompanionSkill } from '../types';
import { buildWebResearchExecution } from '../../browser-agent/browser-agent';

export const researchAssistantSkill: CompanionSkill = {
  id: 'research-assistant',
  label: 'Research Assistant',
  description:
    'Performs multi-step web research, inspects authoritative sources, filters out sponsored ads, compares findings, and cites verified pages.',
  buildSkillDirectives: () =>
    `
SKILL: WEB RESEARCH ASSISTANT & BROWSER AGENT
- Follow the 9-step Research Workflow:
  1. Understand the user's objective.
  2. Generate a concise search query.
  3. Search the web / inspect authoritative results.
  4. Prefer official websites and distinguish advertisements from organic results.
  5. Extract only relevant information.
  6. Compare conflicting information when present.
  7. Mention uncertainty or freshness notes when necessary.
  8. Summarize findings naturally in Moroccan Darija (or requested language).
  9. Tell the user where the information came from. Never fabricate a source or claim a page was visited if it was not inspected.
`.trim(),
  executeFallback: ({ userRequest, pageContext }) => {
    return buildWebResearchExecution({
      userRequest,
      pageContext,
    });
  },
};

export const decisionSupportSkill: CompanionSkill = {
  id: 'decision-support',
  label: 'Decision Support',
  description:
    'Identifies options, explains trade-offs, organizes pros and cons, and helps the user make informed decisions without choosing blindly for them.',
  buildSkillDirectives: () =>
    `
SKILL: DECISION SUPPORT & COMPARISON
- Do NOT blindly choose for the user.
- Identify the options clearly, explain the trade-offs (pros and cons of each), highlight the decision criteria, and help the user decide based on their goal.
`.trim(),
  executeFallback: ({ userRequest, gatheredContext }) => {
    const lower = userRequest.toLowerCase();

    if (/\b(react)\b/i.test(lower) && /\b(vue)\b/i.test(lower)) {
      return {
        message:
          'المقارنة بين React وVue: 1) React مطلوبة بزاف فسوق الشغل وعندها Ecosystem كبير بزاف، ولكن كتحتاج تختار المكتبات بيدك. 2) Vue ساهلة فالتعلم ومنظمة من اللول، وممتازة للمشاريع السريعة. إلا هدفك خدمة فالشركات الكبار ختار React، وإلا بغيتي تبني مشروعك بسرعة وبساطة ختار Vue.',
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        intent: 'COMPARISON',
        skillId: 'decision-support',
        skillLabel: 'Decision Support',
        explanationDepth: gatheredContext.routedIntent.explanationDepth,
        topic: 'React vs Vue',
      };
    }

    return {
      message:
        'باش تاخد القرار الصحيح وما نختارش فبلاصتك عشوائيا: عندك جوج اختيارات؛ الخيار اللول كيتميز بالسرعة والبساطة فالبداية، والخيار التاني كيعطيك تحكم وقوة كبر على المدى البعيد. قول ليا شنو أهم معيار عندك دابا (الوقت، الثمن، ولا السهولة) باش نوضح ليك شكون أنسب ليك.',
      action: 'none',
      targetElementId: null,
      requiresConfirmation: false,
      taskCompleted: true,
      intent: gatheredContext.routedIntent.intent,
      skillId: 'decision-support',
      skillLabel: 'Decision Support',
      explanationDepth: gatheredContext.routedIntent.explanationDepth,
      topic: gatheredContext.activeTopic || 'Decision Analysis',
    };
  },
};
