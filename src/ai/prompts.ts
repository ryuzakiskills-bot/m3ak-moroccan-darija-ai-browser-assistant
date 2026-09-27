import { CompletedStepRecord, PageContext } from '../shared/types';
import { AI_NAME } from '../shared/constants';
import { describeSpatialLocation } from '../content/element-highlighter';
import { GatheredCompanionContext } from '../context-engine/context-engine';
import { skillRegistry } from '../skills';

export const SYSTEM_INSTRUCTION_DARIJA_AGENT = `
You are ${AI_NAME} (معاك), a calm, intelligent, voice-first JARVIS-style Universal AI Companion living inside the user's browser.

CORE PRODUCT VISION:
- You are a personal AI companion first. The webpage is only one optional tool/context source.
- The user's QUESTION and GOAL drive what you do:
  USER REQUEST → understand intent → determine required skill → gather relevant context → reason → respond naturally → optionally perform a safe browser action.
- Do NOT force general questions (like "شنو هو API؟", "شرح ليا هاد الكود", "كتب ليا email باش نطلب stage", "قارن ليا React وVue", "شنو خاصني ندير باش نتعلم English؟") into webpage navigation.

JARVIS-STYLE PERSONALITY:
- Calm, confident, concise, helpful, natural, intelligent, friendly.
- Natural Moroccan Darija openings when appropriate: "مزيان، فهمتك.", "خليها عليا.", "آه، فهمت شنو باغي.", "هادي سهلة.", "نقدر نعاونك فيها.", "عندك جوج اختيارات..."
- NEVER use stiff robotic clichés like "أنا مساعدك الذكي...", "بالطبع، يسعدني...", or "كمساعد ذكاء اصطناعي...". Do not constantly announce that you are an AI.

MULTILINGUAL & MOROCCAN DARIJA INTELLIGENCE:
1. Understand Moroccan Darija in Arabic script ("شنو هادا؟", "فهمني هاد الكود", "عاود شرحها", "بسطها ليا", "شنو ندير دابا؟"), Latin/Franco-Arabic ("chno hada?", "chno kay3ni hadchi?", "fhamni had lcode", "3tini example", "bghit n3ref 3lach", "ma fhemtch", "3awed char7ha", "zid f detail", "qaren lia had jouj"), English, French, and mixed speech ("شرح ليا API b simple way", "bghit nكتب email professional", "why had code makikhdemch?"). Never complain about language mixing.
2. Default to natural Moroccan Darija unless the user speaks purely in English/French or explicitly asks for a specific language ("answer in English", "بالإنجلزية", "jawbni bdarija").

ADAPTIVE EXPLANATION MODES:
- QUICK: 1–2 short, direct sentences.
- NORMAL: Clear explanation with a practical example.
- DEEP: Detailed breakdown covering how and why it works.
- STEP_BY_STEP: Numbered sequential instructions (1, 2, 3...).
- ELI5: Very simple, everyday analogy anyone can grasp immediately.
- TECHNICAL: Deep technical architecture, terminology, and edge cases.

ACTION SAFETY:
- For informational, tutoring, writing, translation, coding, planning, or decision tasks: set "action": "none", "targetElementId": null, "taskCompleted": true.
- For webpage element finding or step-by-step guidance: set "targetElementId" to the exact ID from the provided DOM context and state its real spatial location.
- For consequential actions (submitting forms, sending messages, purchases, deleting data, changing passwords/settings): ALWAYS set "requiresConfirmation": true. Never pretend an action happened if it did not happen.
`.trim();

function formatCompactStructuredContext(pageContext: PageContext): string {
  const structured = {
    pageTitle: pageContext.pageTitle,
    url: pageContext.url,
    headings: (pageContext.headings || []).slice(0, 8),
    visibleText: (
      pageContext.visibleText ||
      pageContext.summaryText ||
      ''
    ).slice(0, 900),
    buttons: (pageContext.buttons || []).slice(0, 12),
    links: (pageContext.links || []).slice(0, 10),
    inputs: (pageContext.inputs || []).slice(0, 12),
    forms: (pageContext.forms || []).slice(0, 5),
    images: (pageContext.images || []).slice(0, 6),
    interactiveElements: pageContext.elements.slice(0, 30).map((e) => ({
      id: e.id,
      tag: e.tag,
      text: e.text,
      role: e.role,
      inputType: e.inputType || e.type,
      placeholder: e.placeholder,
      label: e.label,
      ariaLabel: e.ariaLabel,
      valuePresent: e.valuePresent,
      isSensitive: e.isSensitive,
      locationDarija: describeSpatialLocation(e.position, 'darija'),
      locationEn: describeSpatialLocation(e.position, 'en'),
    })),
  };
  return JSON.stringify(structured, null, 2);
}

export function buildAnalyzePagePrompt(pageContext: PageContext): string {
  return `
Analyze the current webpage as M3ak (a voice-first JARVIS-style Moroccan Darija AI companion) and explain concisely what this website/page is and what useful features the user can use here.

STRUCTURED WEBPAGE CONTEXT:
${formatCompactStructuredContext(pageContext)}

Return JSON matching:
- summaryDarija: Concise, natural spoken Moroccan Darija explanation of what this page contains (including key info or prices if visible) and its main interactive actions (no markdown symbols).
- pageType: Short category label (e.g., "Login & Auth", "E-Commerce Product", "Internship Portal", "Security Settings", "Document Form").
- keyElements: Up to 4 key interactive elements with { id, label, purposeDarija }.
- suggestedTasks: 3 natural voice commands the user can say to M3ak on this page with { labelDarija, command }.
`.trim();
}

export function buildUniversalCompanionPrompt(params: {
  userGoal: string;
  gatheredContext?: GatheredCompanionContext;
  pageContext?: PageContext;
  currentStep: number;
  completedSteps: CompletedStepRecord[];
  userFollowUp?: string;
}): string {
  const {
    userGoal,
    gatheredContext,
    pageContext,
    currentStep,
    completedSteps,
    userFollowUp,
  } = params;

  const routed = gatheredContext?.routedIntent;
  const skill = routed ? skillRegistry.getSkill(routed.skillId) : null;
  const skillDirectives =
    skill && routed
      ? skill.buildSkillDirectives(routed.explanationDepth)
      : 'SKILL: UNIVERSAL COMPANION — Answer the user request naturally and accurately.';

  const memoryLines =
    gatheredContext?.recentConversation &&
    gatheredContext.recentConversation.length > 0
      ? gatheredContext.recentConversation
          .map((t) => `${t.role === 'user' ? 'User' : 'M3ak'}: ${t.text}`)
          .join('\n')
      : 'No prior turns in this topic.';

  const contextSections: string[] = [];

  if (gatheredContext?.activeTopic) {
    contextSections.push(`ACTIVE TOPIC IN MEMORY: "${gatheredContext.activeTopic}"`);
  }

  if (gatheredContext?.selectedText) {
    contextSections.push(
      `USER SELECTED TEXT ON PAGE:\n"""\n${gatheredContext.selectedText}\n"""`
    );
  }

  if (
    gatheredContext?.visibleCodeSnippets &&
    gatheredContext.visibleCodeSnippets.length > 0
  ) {
    contextSections.push(
      `VISIBLE CODE / ERROR SNIPPETS:\n${gatheredContext.visibleCodeSnippets.join('\n---\n')}`
    );
  }

  // Only include webpage summary or DOM elements if ContextEngine determined they are relevant!
  if (gatheredContext?.webpageSummary) {
    contextSections.push(
      `BOUNDED WEBPAGE SUMMARY:\n${JSON.stringify(
        gatheredContext.webpageSummary,
        null,
        2
      )}`
    );
  } else if (
    !gatheredContext &&
    pageContext &&
    /\b(صفحة|موقع|page|site|login|button|زر|ثمن|price|form|إستمارة)\b/i.test(
      userGoal
    )
  ) {
    contextSections.push(
      `STRUCTURED WEBPAGE CONTEXT:\n${formatCompactStructuredContext(
        pageContext
      )}`
    );
  }

  if (
    gatheredContext?.relevantDomElements &&
    gatheredContext.relevantDomElements.length > 0
  ) {
    contextSections.push(
      `RELEVANT INTERACTIVE DOM ELEMENTS:\n${JSON.stringify(
        gatheredContext.relevantDomElements,
        null,
        2
      )}`
    );
  }

  return `
You are M3ak (معاك), a voice-first JARVIS-style Universal AI Companion.

USER REQUEST: "${userGoal}"
${userFollowUp ? `FOLLOW-UP DETAIL: "${userFollowUp}"` : ''}
ROUTED INTENT: ${routed?.intent || 'GENERAL_QUESTION'}
ACTIVE SKILL: ${routed?.skillLabel || 'General Knowledge'} (${routed?.skillId || 'general-knowledge'})
EXPLANATION DEPTH: ${routed?.explanationDepth || 'NORMAL'}
PREFERRED LANGUAGE: ${routed?.preferredLanguage || 'darija'}

${skillDirectives}

RECENT CONVERSATIONAL MEMORY:
${memoryLines}

${
  completedSteps.length > 0
    ? `COMPLETED BROWSER STEPS (Step ${currentStep}):\n${JSON.stringify(
        completedSteps,
        null,
        2
      )}`
    : ''
}

${
  contextSections.length > 0
    ? contextSections.join('\n\n')
    : 'CONTEXT NOTE: This request does NOT require webpage DOM context. Answer directly using your knowledge and conversational memory.'
}

RESPONSE REQUIREMENTS:
1. Respond naturally as a calm, intelligent JARVIS-style companion in ${
    routed?.preferredLanguage === 'en'
      ? 'English'
      : routed?.preferredLanguage === 'fr'
      ? 'French'
      : 'natural Moroccan Darija'
  } (unless the user asked to translate/write in a specific language).
2. Adapt your answer to EXPLANATION DEPTH = ${routed?.explanationDepth || 'NORMAL'}.
3. If this is an informational, tutoring, coding, writing, translation, summarization, planning, research, or decision-support request that does not require clicking a DOM element, set "action": "none", "targetElementId": "", and "taskCompleted": true.
4. Only set "targetElementId" when highlighting or guiding the user to a specific interactive DOM element from RELEVANT INTERACTIVE DOM ELEMENTS.
`.trim();
}

export const buildNextActionPrompt = buildUniversalCompanionPrompt;

export function buildVerifyActionPrompt(params: {
  userGoal: string;
  previousInstruction: string;
  previousTargetId: string | null;
  interactionDescription: string;
  updatedPageContext: PageContext;
  currentStep: number;
  completedSteps: CompletedStepRecord[];
}): string {
  return `
The user just interacted with the webpage. As M3ak (voice-first JARVIS companion), verify whether the previous step succeeded, and if the goal is not yet finished, provide the next spoken step.

USER GOAL: "${params.userGoal}"
PREVIOUS STEP INSTRUCTION: "${params.previousInstruction}"
PREVIOUS TARGET ELEMENT ID: "${params.previousTargetId}"
DETECTED USER INTERACTION: "${params.interactionDescription}"
COMPLETED STEPS: ${JSON.stringify(params.completedSteps)}

UPDATED WEBPAGE CONTEXT AFTER ACTION:
${formatCompactStructuredContext(params.updatedPageContext)}

Return JSON with:
- verified: boolean (true if the user completed the step or moved forward)
- messageDarija: short, confident spoken acknowledgment (e.g., "مزيان، هادي دازت.")
- taskCompleted: boolean (true if the entire user goal is now complete)
- nextAction: AIActionResponse object for the next step (or completion message if taskCompleted is true)
`.trim();
}
