import { CompanionSkill } from '../types';
import { buildBrowserControlExecution } from '../../browser-agent/browser-agent';

export const visualGuideSkill: CompanionSkill = {
  id: 'visual-guide',
  label: 'Visual Guide',
  description:
    'Finds target DOM elements on the page, highlights them with a glowing frame and guide arrow, and states their real spatial location.',
  buildSkillDirectives: () =>
    `
SKILL: VISUAL GUIDE
- Locate the requested element from relevantDomElements, state its real spatial position (locationDarija / locationEn), and set targetElementId to its exact ID.
`.trim(),
  executeFallback: () => null, // Handled by DOM-grounded spatial locator in ai-service.ts
};

export const browserNavigationSkill: CompanionSkill = {
  id: 'browser-navigation',
  label: 'Browser Navigation',
  description:
    'Executes safe browser-agent navigation (open tab, navigate to URL, search engine, back/forward/reload, switch tabs) and guides multi-step website workflows.',
  buildSkillDirectives: () =>
    `
SKILL: BROWSER AGENT & NAVIGATION
- Execute safe browser navigation commands (opening Google, YouTube, websites, going back/forward/reloading) or guide the user step by step across multi-step website workflows.
- Require explicit confirmation for sensitive actions (payments, purchases, deletions, password changes, form submissions, executable downloads).
- Refuse forbidden actions (bypassing CAPTCHAs, authentication, or paywalls).
`.trim(),
  executeFallback: ({ userRequest }) => {
    // Handle direct browser-control commands ("7ell Google", "7ell YouTube", "go back", "reload", etc.)
    // Returns null for in-page multi-step workflows ("bghit ndir compte hna") so the DOM-grounded navigator handles them.
    return buildBrowserControlExecution(userRequest);
  },
};
