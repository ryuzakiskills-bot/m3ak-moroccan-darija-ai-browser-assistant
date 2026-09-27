import {
  ExplanationDepth,
  SkillId,
  UniversalIntentCategory,
} from '../shared/types';
import { ConversationMemorySnapshot } from '../memory/conversation-memory';

export type ContextRequirement =
  | 'none'
  | 'selection_only'
  | 'code_or_selection'
  | 'elements_only'
  | 'bounded_page'
  | 'full_page';

export interface RoutedIntentResult {
  intent: UniversalIntentCategory;
  skillId: SkillId;
  skillLabel: string;
  explanationDepth: ExplanationDepth;
  contextRequirement: ContextRequirement;
  inferredTopic: string;
  isFollowUp: boolean;
  preferredLanguage: 'darija' | 'en' | 'fr';
}

export const SKILL_LABELS: Record<SkillId, string> = {
  'general-knowledge': 'General Knowledge',
  tutor: 'Teacher / Tutor',
  'webpage-analyzer': 'Webpage Analyzer',
  'visual-guide': 'Visual Guide',
  writer: 'Writer',
  translator: 'Translator',
  summarizer: 'Summarizer',
  'coding-assistant': 'Coding Assistant',
  'problem-solver': 'Problem Solver',
  planner: 'Planner',
  'research-assistant': 'Research Assistant',
  'document-assistant': 'Document Assistant',
  'form-assistant': 'Form Assistant',
  'browser-navigation': 'Browser Navigation',
  'decision-support': 'Decision Support',
};

/**
 * Detects desired explanation depth from the user's phrasing:
 * QUICK | NORMAL | DEEP | STEP_BY_STEP | ELI5 | TECHNICAL
 */
export function detectExplanationDepth(
  rawInput: string,
  fallbackDepth: ExplanationDepth = 'NORMAL'
): { depth: ExplanationDepth; explicitlyRequested: boolean } {
  const lower = rawInput.toLowerCase().trim();

  if (
    lower.includes('ببساطة') ||
    lower.includes('بسطها') ||
    lower.includes('بسط ليا') ||
    lower.includes('b simple way') ||
    lower.includes('simple way') ||
    lower.includes('simplify') ||
    lower.includes('eli5') ||
    lower.includes('ما فهمتش') ||
    lower.includes('ma fhemtch') ||
    lower.includes('عاود شرحها') ||
    lower.includes('3awed char7ha')
  ) {
    return { depth: 'ELI5', explicitlyRequested: true };
  }

  if (
    lower.includes('technical explanation') ||
    lower.includes('technical detail') ||
    lower.includes('تقنيا') ||
    lower.includes('بالتفصيل التقني') ||
    lower.includes('techniquement')
  ) {
    return { depth: 'TECHNICAL', explicitlyRequested: true };
  }

  if (
    lower.includes('step by step') ||
    lower.includes('خطوة بخطوة') ||
    lower.includes('مرحلة بمرحلة') ||
    lower.includes('étape par étape') ||
    lower.includes('kifach نبدا')
  ) {
    return { depth: 'STEP_BY_STEP', explicitlyRequested: true };
  }

  if (
    lower.includes('بالتفصيل') ||
    lower.includes('zid f detail') ||
    lower.includes('زيد فالتفاصيل') ||
    lower.includes('in detail') ||
    lower.includes('deep dive') ||
    lower.includes('اكثر تفصيل')
  ) {
    return { depth: 'DEEP', explicitlyRequested: true };
  }

  if (
    lower.includes('باختصار') ||
    lower.includes('f kelma') ||
    lower.includes('بزربة') ||
    lower.includes('quickly') ||
    lower.includes('short answer') ||
    lower.includes('briefly')
  ) {
    return { depth: 'QUICK', explicitlyRequested: true };
  }

  return { depth: fallbackDepth, explicitlyRequested: false };
}

/**
 * Detects preferred response language ('darija' | 'en' | 'fr')
 */
export function detectResponseLanguage(
  rawInput: string
): 'darija' | 'en' | 'fr' {
  const lower = rawInput.toLowerCase().trim();

  if (
    lower.includes('jawbni bdarija') ||
    lower.includes('b darija') ||
    lower.includes('bdarija') ||
    lower.includes('بالدارجة')
  ) {
    return 'darija';
  }
  if (
    lower.includes('answer in english') ||
    lower.includes('answer me in english') ||
    lower.includes('in english') ||
    lower.includes('بالإنجلزية') ||
    lower.includes('بالانجليزية') ||
    lower.includes('للإنجليزية') ||
    lower.includes('to english')
  ) {
    return 'en';
  }
  if (
    lower.includes('en français') ||
    lower.includes('بالفرنسية') ||
    lower.includes('in french')
  ) {
    return 'fr';
  }

  const hasArabicScript = /[\u0600-\u06FF]/.test(lower);
  const hasDarijaFranco =
    /\b(salam|chno|achno|kayn|fhad|had|lpage|fin|bghit|n9leb|9leb|qleb|7ell|7el|chof|mzyan|3andhom|n3ref|taman|ndir|n3ammar|nsift|nbdl|3la|lia|dyal|hna|kifach|wach|wash|3lach|fhamni|3tini|3awed|char7ha|qaren|jouj|makikhdemch|hadchi)\b/.test(
      lower
    );

  if (hasArabicScript || hasDarijaFranco) {
    return 'darija';
  }

  if (
    /\b(what|where|how|why|explain|find|open|show|compare|which|write|translate|summarize|debug|hey jarvis|hello jarvis)\b/.test(
      lower
    )
  ) {
    return 'en';
  }

  return 'darija';
}

/**
 * Extracts the core subject/topic from the user's query so conversational memory can track it.
 */
function extractTopic(rawInput: string, fallbackTopic: string | null): string {
  const cleaned = rawInput
    .replace(
      /^(?:salam|hey|hi|hello|سلام|اهلا)\s*(?:jarvis|m3ak|جارفيس|معاك)[،,\s:-]*/i,
      ''
    )
    .trim();

  const topicMatch =
    cleaned.match(
      /(?:شنو هو|شنو هي|اشنو هو|شرح ليا|فهمني|علاش كنحتاجو|what is|explain|how to learn|نتعلم)\s+([^؟?.!]+?)(?:\s+b\s+simple\s+way|\s+ببساطة|\s+بالتفصيل|[؟?.!]|$)/i
    ) ||
    cleaned.match(
      /(?:قارن ليا|قارن بين|qaren lia|compare)\s+([^؟?.!]+)/i
    );

  if (topicMatch && topicMatch[1]) {
    const candidate = topicMatch[1].trim();
    if (
      !/^(هاد الصفحة|هاد الموقع|had lpage|had page|هادشي|hadchi|هادا|hada)$/i.test(
        candidate
      )
    ) {
      return candidate;
    }
  }

  return fallbackTopic || cleaned.slice(0, 60);
}

/**
 * Universal Intent Router
 * Routes ANY user request to the appropriate Intent Category, Modular Skill, Explanation Depth,
 * and Context Requirement without forcing non-page conversations into PAGE_ANALYSIS.
 */
export class IntentRouter {
  public route(
    rawInput: string,
    memory: ConversationMemorySnapshot,
    hasSelectedText = false
  ): RoutedIntentResult {
    const cleaned = rawInput.trim();
    const lower = cleaned.toLowerCase();
    const preferredLanguage = detectResponseLanguage(cleaned);
    const { depth, explicitlyRequested } = detectExplanationDepth(
      cleaned,
      'NORMAL'
    );

    const mentionsCurrentPage =
      /(?:هاد الصفحة|هاد الموقع|فهاد الصفحة|فهاد الموقع|بهاد الموقع|had lpage|had page|f had page|this page|this website|this site|هاد الاستمارة|هاد الإستمارة|had formulaire)/i.test(
        lower
      );

    const mentionsElementOrLocation =
      /(?:فين|هاد الزر|هاد البوطون|تسجيل الدخول|نسجل|\bfin\b|\bwhere is\b|\bfind me the\b|\bfind the\b|\bhad button\b|\bthis button\b|\blogin\b|\bsign up\b|\bsignup\b|\binscription\b|\bconnexion\b)/i.test(
        lower
      );

    // 0. Check if this is a conversational follow-up referring to the previous topic in memory
    // e.g. "وعلاش كنحتاجوه؟", "عطيني example", "3tini example", "ما فهمتش", "عاود شرحها", "بسطها ليا", "زيد فـ detail"
    const isFollowUpPhrase =
      /^(?:وعلاش|علاش كنحتاجوه|علاش كيصلح|عطيني\s*example|عطيني مثال|3tini\s*example|bghit\s*n3ref\s*3lach|ما فهمتش|ma\s*fhemtch|عاود شرحها|3awed\s*char7ha|بسطها ليا|شرحها ليا ببساطة|بالتفصيل|zid\s*f\s*detail|step by step|give me the technical explanation|كيفاش كيخدم|و من بعد)/i.test(
        lower
      );

    if (isFollowUpPhrase && memory.activeTopic && !mentionsCurrentPage) {
      const activeSkill = memory.activeSkillId || 'tutor';
      const activeIntent: UniversalIntentCategory =
        explicitlyRequested && (depth === 'ELI5' || depth === 'STEP_BY_STEP')
          ? 'TEACHING'
          : memory.activeIntent || 'EXPLANATION';

      return {
        intent: activeIntent,
        skillId: activeSkill,
        skillLabel: SKILL_LABELS[activeSkill],
        explanationDepth: depth,
        contextRequirement: 'none',
        inferredTopic: memory.activeTopic,
        isFollowUp: true,
        preferredLanguage,
      };
    }

    // 1. CASUAL_CONVERSATION (Greetings, "Salam Jarvis", "wash t9der t3awni?", "شكرا")
    if (
      /^(?:salam|slm|hey|hi|hello|yo|ya|سلام|اهلا|مرحبا)?\s*(?:jarvis|m3ak|maak|جارفيس|معاك)?[!.؟?,\s]*$/i.test(
        lower
      ) ||
      /^(?:wash t9der t3awni|واش تقدر تعاوني|شكرا|chokran|thank you|thanks|كيف داير|لاباس)[!.؟?,\s]*$/i.test(
        lower
      )
    ) {
      return {
        intent: 'CASUAL_CONVERSATION',
        skillId: 'general-knowledge',
        skillLabel: SKILL_LABELS['general-knowledge'],
        explanationDepth: 'QUICK',
        contextRequirement: 'none',
        inferredTopic: memory.activeTopic || 'Greeting',
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 2. TRANSLATION ("ترجم ليا هاد النص للإنجليزية", "translate this to English/French/Darija")
    if (/(?:ترجم|ترجمة|\btarjim\b|\btranslate\b|\btradui|\btraduction\b)/i.test(lower)) {
      return {
        intent: 'TRANSLATION',
        skillId: 'translator',
        skillLabel: SKILL_LABELS.translator,
        explanationDepth: depth,
        contextRequirement: hasSelectedText ? 'selection_only' : 'bounded_page',
        inferredTopic: extractTopic(cleaned, memory.activeTopic),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 3. WRITING ("كتب ليا email باش نطلب stage", "كتب ليا رسالة لصاحبي", "bghit nkteb message", "bghit nكتب email professional", "cover letter", "CV")
    if (
      /(?:كتب ليا|بغيت نكتب|صاوب ليا|قاد ليا|bghit nkteb|bghit nكتب|kteb lia|write me|draft a|rédige)/i.test(
        lower
      ) ||
      /(?:إيميل|رسالة|\bemail\b|\bmessage\b|\bcover letter\b|\blettre de motivation\b|\bproposal\b)/i.test(
        lower
      )
    ) {
      if (!/(?:فين|خانة|\bfin\b|\binput\b)/i.test(lower)) {
        return {
          intent: 'WRITING',
          skillId: 'writer',
          skillLabel: SKILL_LABELS.writer,
          explanationDepth: depth,
          contextRequirement: hasSelectedText ? 'selection_only' : 'none',
          inferredTopic: extractTopic(cleaned, 'Professional Writing'),
          isFollowUp: false,
          preferredLanguage,
        };
      }
    }

    // 4. DEBUGGING & CODING ("علاش هاد code فيه error؟", "why had code makikhdemch?", "شرح ليا هاد الكود", "fhamni had lcode")
    if (
      /(?:ما كيخدمش|فيه مشكل|فيه خطأ|\berror\b|\bbug\b|\bexception\b|\bmakikhdemch\b|\bdebug\b|\bfix\b)/i.test(
        lower
      ) &&
      /(?:كود|هاد الكود|تطبيق|\bcode\b|\blcode\b|\bscript\b|\bfunction\b|\bconsole\b)/i.test(
        lower
      )
    ) {
      return {
        intent: 'DEBUGGING',
        skillId: 'coding-assistant',
        skillLabel: SKILL_LABELS['coding-assistant'],
        explanationDepth: depth,
        contextRequirement: 'code_or_selection',
        inferredTopic: extractTopic(cleaned, 'Code Debugging'),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    if (
      /(?:شرح ليا هاد الكود|شرح ليا الكود|فهمني هاد الكود|fhamni had lcode|explain this code|كتب ليا كود|write code|كود ديال|\bsnippet\b)/i.test(
        lower
      )
    ) {
      return {
        intent: 'CODING',
        skillId: 'coding-assistant',
        skillLabel: SKILL_LABELS['coding-assistant'],
        explanationDepth: depth,
        contextRequirement: 'code_or_selection',
        inferredTopic: extractTopic(cleaned, 'Code Analysis'),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 5. COMPARISON & DECISION_SUPPORT ("قارن ليا React وVue", "qaren lia had jouj", "شنو الفرق؟", "which one should I choose?", "شنو ندير؟")
    if (
      /(?:قارن ليا|قارن بين|qaren lia|\bcompare\b|شنو الفرق|اشنو الفرق|difference between)/i.test(
        lower
      )
    ) {
      return {
        intent: 'COMPARISON',
        skillId: 'decision-support',
        skillLabel: SKILL_LABELS['decision-support'],
        explanationDepth: depth,
        contextRequirement: mentionsCurrentPage ? 'bounded_page' : 'none',
        inferredTopic: extractTopic(cleaned, memory.activeTopic),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    if (
      /(?:which one should i choose|شنو نختار|بمن تنصحني|شنو ندير|chno ndir|what should i do|شكون حسن)/i.test(
        lower
      )
    ) {
      return {
        intent: 'DECISION_SUPPORT',
        skillId: 'decision-support',
        skillLabel: SKILL_LABELS['decision-support'],
        explanationDepth: depth,
        contextRequirement: mentionsCurrentPage ? 'bounded_page' : 'none',
        inferredTopic: extractTopic(cleaned, memory.activeTopic),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 6. PLANNING ("شنو خاصني ندير باش نتعلم English؟", "خطة", "برنامج", "roadmap", "plan", "كيفاش نتعلم")
    if (
      /(?:شنو خاصني ندير باش نتعلم|كيفاش نتعلم|خطة|برنامج|\broadmap\b|study plan|learning path|kifach nt3ellem|how to learn|plan for)/i.test(
        lower
      )
    ) {
      return {
        intent: 'PLANNING',
        skillId: 'planner',
        skillLabel: SKILL_LABELS.planner,
        explanationDepth: 'STEP_BY_STEP',
        contextRequirement: 'none',
        inferredTopic: extractTopic(cleaned, 'Learning & Action Plan'),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 7. SUMMARIZATION ("لخص ليا هاد الصفحة", "لخص ليا هاد النص", "summarize", "خلاصة", "résume")
    if (/(?:لخص|تلخيص|خلاصة|\bsummarize\b|\bsummary\b|\brésume\b|\blakhes\b)/i.test(lower)) {
      const isDoc = /(?:وثيقة|ملف|مقال|\bdocument\b|\bpdf\b|\barticle\b)/i.test(
        lower
      );
      return {
        intent: 'SUMMARIZATION',
        skillId: isDoc ? 'document-assistant' : 'summarizer',
        skillLabel: isDoc
          ? SKILL_LABELS['document-assistant']
          : SKILL_LABELS.summarizer,
        explanationDepth: depth,
        contextRequirement: hasSelectedText ? 'selection_only' : 'bounded_page',
        inferredTopic: extractTopic(cleaned, 'Summary'),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 8. FORM_HELP ("بغيت نعمر هاد الإستمارة", "bghit n3ammar had formulaire", "شنو نكتب فهاد الخانة", "contact form")
    if (
      /(?:إستمارة|استمارة|نعمر|هاد الخانة|بغيت نصيفط هاد الوثيقة|\bformulaire\b|\bn3ammar\b|\bcontact form\b|\bnsift had document\b)/i.test(
        lower
      )
    ) {
      return {
        intent: 'FORM_HELP',
        skillId: 'form-assistant',
        skillLabel: SKILL_LABELS['form-assistant'],
        explanationDepth: 'STEP_BY_STEP',
        contextRequirement: 'full_page',
        inferredTopic: 'Form Guidance',
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 8.5 BROWSER CONTROL (Open new tab / navigate to URL / back / forward / reload / switch tab)
    // Examples: "7ell Google", "7ell YouTube", "حل يوتيوب", "open Google", "رجع للور", "go back", "reload"
    const isDirectBrowserControl =
      /^(?:7ell|7el|hell|hel|ftah|fta7|حل|افتح|فتح|open|launch|go to|sir l|سير ل|مشي ل)\s+(?:lia\s+|لي\s+|ليا\s+)?(?:google|youtube|github|wikipedia|linkedin|جوجل|غوغل|يوتيوب|ويكيبيديا|(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+)/i.test(
        cleaned
      ) ||
      /^(?:go back|back|رجع للور|رجع للصفحة اللي قبل|rja3 llor|go forward|forward|زيد لقدام|reload|refresh|عاود شارجي الصفحة|حدث الصفحة|أعد تحميل الصفحة|switch tab|بدل التاب|بدل الصفحة)$/i.test(
        lower
      );

    if (isDirectBrowserControl) {
      return {
        intent: 'NAVIGATION',
        skillId: 'browser-navigation',
        skillLabel: SKILL_LABELS['browser-navigation'],
        explanationDepth: 'QUICK',
        contextRequirement: 'none',
        inferredTopic: extractTopic(cleaned, 'Browser Navigation'),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 8.6 WEB RESEARCH MODE (External web search, multi-step research, company/product/university lookup)
    // Examples:
    // - "9leb lia 3la AI courses f Morocco"
    // - "qleb lia 3la chi laptop gaming mzyan"
    // - "9leb 3la had company w chof chno katdir"
    // - "9leb lia 3la 3 universities f Spain li 3andhom bachelor marketing"
    // - "search for...", "find me...", "chof lia...", "قلب ليا...", "بغيت نعرف...", "find information about..."
    const isInPageElementLookup =
      /(?:\blogin\b|\bsign\s*up\b|\bsignup\b|\bregister\b|\bpassword\b|\bformulaire\b|\bbutton\b|\bsection\b|تمن فهاد الصفحة|الثمن هنا|هاد الزر|هاد البوطون|تسجيل الدخول)/i.test(
        lower
      ) ||
      (/^(?:bghit n3ref taman|بغيت نعرف الثمن|قلب ليا على الثمن|bghit n9leb 3la stage|بغيت نقلب على سطاج)$/i.test(
        lower
      ));

    const isWebResearchTrigger =
      !isInPageElementLookup &&
      (/(?:9leb\s+lia|qleb\s+lia|9leb\s+3la|qleb\s+3la|n9leb\s+3la|chof\s+lia|شوف\s+ليا|قلب\s+ليا|قلب\s+على|بحث\s+على|جمع\s+ليا\s+معلومات|نبحث\s+على|\bsearch\s+for\b|\bfind\s+information\s+about\b|\bresearch\b|\binvestigate\b)/i.test(
        lower
      ) ||
        (/\bfind\s+me\b/i.test(lower) && !mentionsElementOrLocation) ||
        (/(?:بغيت\s+نعرف|bghit\s+n3ref)/i.test(lower) &&
          !mentionsCurrentPage &&
          !/\b(taman|ثمن|الثمن|3lach|علاش)\b/i.test(lower)) ||
        /(?:bypass\s+captcha|تجاوز\s+الكابتشا|bypass\s+paywall)/i.test(lower));

    if (isWebResearchTrigger) {
      return {
        intent: 'RESEARCH',
        skillId: 'research-assistant',
        skillLabel: SKILL_LABELS['research-assistant'],
        explanationDepth: depth,
        contextRequirement: mentionsCurrentPage ? 'bounded_page' : 'none',
        inferredTopic: extractTopic(cleaned, 'Web Research'),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 9. ELEMENT_FINDING & NAVIGATION ("فين login؟", "fin kayn login?", "find me the login button", "فين نقدر نسجل؟", "bghit ndir compte hna", "bghit nbdl password", "bghit nchri had produit", "bghit n3ref taman")
    if (
      mentionsElementOrLocation ||
      /(?:bghit n9leb 3la|بغيت نقلب على|bghit ndir compte|بغيت ندير حساب|bghit nbdl password|بغيت نبدل كلمة السر|bghit nchri|بغيت نشري|bghit n3ref taman|بغيت نعرف الثمن|قلب ليا على الثمن|open the pricing|فين نقدر نحمل)/i.test(
        lower
      )
    ) {
      const isMultiStepNav =
        /(?:bghit ndir compte|بغيت ندير حساب|bghit nbdl password|بغيت نبدل كلمة السر|bghit nchri|بغيت نشري|bghit n9leb 3la stage|سطاج)/i.test(
          lower
        );
      return {
        intent: isMultiStepNav ? 'NAVIGATION' : 'ELEMENT_FINDING',
        skillId: isMultiStepNav ? 'browser-navigation' : 'visual-guide',
        skillLabel: isMultiStepNav
          ? SKILL_LABELS['browser-navigation']
          : SKILL_LABELS['visual-guide'],
        explanationDepth: depth,
        contextRequirement: 'full_page',
        inferredTopic: extractTopic(cleaned, 'Page Navigation'),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 10. PAGE_ANALYSIS ("شنو كاين فهاد الصفحة؟", "chno kayn f had page?", "شنو نقدر ندير بهاد الموقع؟", "شرح ليا هاد الصفحة", "شنو هاد الموقع؟")
    if (
      mentionsCurrentPage ||
      /(?:شنو كاين هنا|اشنو كاين هنا|chno kayn hna|what is on this page|explain this page)/i.test(
        lower
      )
    ) {
      return {
        intent: 'PAGE_ANALYSIS',
        skillId: 'webpage-analyzer',
        skillLabel: SKILL_LABELS['webpage-analyzer'],
        explanationDepth: depth,
        contextRequirement: 'full_page',
        inferredTopic: 'Current Webpage',
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 11. PROBLEM_SOLVING ("حل ليا هاد المشكل", "حساب", "calculate", "problem", "معادلة", "منطق")
    if (
      /(?:حل ليا|حساب|احسب|معادلة|مشكل منطقي|شحال كتساوي|\bcalculate\b|\bsolve\b)/i.test(
        lower
      )
    ) {
      return {
        intent: 'PROBLEM_SOLVING',
        skillId: 'problem-solver',
        skillLabel: SKILL_LABELS['problem-solver'],
        explanationDepth: depth,
        contextRequirement: 'none',
        inferredTopic: extractTopic(cleaned, 'Problem Solving'),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 12. RESEARCH ("بحث", "research", "جمع ليا معلومات على", "شنو هي المصادر")
    if (/(?:بحث على|جمع ليا معلومات|نبحث على|\bresearch\b|\binvestigate\b)/i.test(lower)) {
      return {
        intent: 'RESEARCH',
        skillId: 'research-assistant',
        skillLabel: SKILL_LABELS['research-assistant'],
        explanationDepth: depth,
        contextRequirement: mentionsCurrentPage ? 'bounded_page' : 'none',
        inferredTopic: extractTopic(cleaned, 'Research Topic'),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // 13. TEACHING / EXPLANATION ("شنو هو API؟", "شرح ليا API", "شنو هو recursion؟", "chno hada?", "chno kay3ni hadchi?")
    if (
      /(?:علمني|درس|بسطها|خطوة بخطوة|\btutor\b|\bteach me\b|\bstep by step\b)/i.test(
        lower
      )
    ) {
      return {
        intent: 'TEACHING',
        skillId: 'tutor',
        skillLabel: SKILL_LABELS.tutor,
        explanationDepth: explicitlyRequested ? depth : 'STEP_BY_STEP',
        contextRequirement: hasSelectedText ? 'selection_only' : 'none',
        inferredTopic: extractTopic(cleaned, memory.activeTopic),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    if (
      /(?:شرح ليا|فهمني|شنو هو|شنو هي|اشنو هو|شنو كيعني|chno hada|chno kay3ni|شنو هادا|\bexplain\b|\bwhat is\b|\bhow does\b)/i.test(
        lower
      )
    ) {
      const needsSelectionOrPage =
        hasSelectedText || /(?:هادا|هادشي|\bhada\b|\bhadchi\b)/i.test(lower);
      return {
        intent: 'EXPLANATION',
        skillId: explicitlyRequested ? 'tutor' : 'general-knowledge',
        skillLabel: explicitlyRequested
          ? SKILL_LABELS.tutor
          : SKILL_LABELS['general-knowledge'],
        explanationDepth: depth,
        contextRequirement: needsSelectionOrPage
          ? hasSelectedText
            ? 'selection_only'
            : 'bounded_page'
          : 'none',
        inferredTopic: extractTopic(cleaned, memory.activeTopic),
        isFollowUp: false,
        preferredLanguage,
      };
    }

    // Default: GENERAL_QUESTION handled by General Knowledge skill without sending unnecessary page bloat
    return {
      intent: 'GENERAL_QUESTION',
      skillId: 'general-knowledge',
      skillLabel: SKILL_LABELS['general-knowledge'],
      explanationDepth: depth,
      contextRequirement: 'none',
      inferredTopic: extractTopic(cleaned, memory.activeTopic),
      isFollowUp: false,
      preferredLanguage,
    };
  }
}

export const intentRouter = new IntentRouter();
