import { CompanionSkill } from '../types';

const KNOWLEDGE_BASE_DARIJA: Array<{
  keywords: RegExp;
  topic: string;
  quick: string;
  normal: string;
  eli5: string;
  deep: string;
  technical: string;
  whyNeeded: string;
  example: string;
}> = [
  {
    keywords: /(?:\bapi\b|اي بي اي)/i,
    topic: 'API',
    quick:
      'الـ API هو قنطرة كتربط بين جوج تطبيقات باش يهضرو ويتبادلو المعلومات بيناتهم بلا ما يعرفو الكود الداخلي ديال بعضياتهم.',
    normal:
      'الـ API (Application Programming Interface) بحال السرباي فقهوة: نتا هو التطبيق، الكوزينة هي السيرفر، والـ API هو اللي كياخد الطلب ديالك ويجيب ليك النتيجة واجدة. مثلا ملي كتخلص فموقع، الموقع كيهضر مع API ديال البنك باش يدوز الخلاص.',
    eli5:
      'تخيل API بحال پريز ديال الضو فالحائط: ما كتحتاجش تعرف كيفاش الضو كيتصاوب فالمحطة، غير كتخشى الشارجور وكيدوز الضو. الـ API كيخلي تطبيق يطلب معلومة من تطبيق آخر بكل بساطة.',
    deep:
      'الـ API هو عقد برمجي (Contract) كيحدد كيفاش الأنظمة كتتواصل عبر بروتوكولات بحال HTTP/REST أو GraphQL. التطبيق كيبعث Request فيها Endpoint وParameters، والسيرفر كيرد بـ Response غالبا على شكل JSON فيها البيانات أو النتيجة.',
    technical:
      'تقنيا، REST API كيعتمد على HTTP methods (GET, POST, PUT, DELETE)، وكيتبادل JSON payloads مع Status Codes (بحال 200 OK أو 401 Unauthorized) وHeaders ديال المصادقة بحال Bearer JWT.',
    whyNeeded:
      'كنحتاجو API باش ما نعاودوش نبنيو كلشي من الزيرو، وباش نخليو الموبايل والويب يخدمو بنفس قاعدة البيانات بأمان وسرعة.',
    example:
      'مثال واقعي ديال API: تطبيق الطقس فالتيليفون ديالك ما عندوش أقمار صناعية؛ كيطلب حالة الجو من API ديال مصلحة الأرصاد عبر `GET /weather?city=Casablanca` وكيبين ليك 24 درجة.',
  },
  {
    keywords: /(?:\brecursion\b|العودية|ريكورجن)/i,
    topic: 'Recursion',
    quick:
      'الـ Recursion فالبرمجة هي ملي شي دالة (Function) كتعيط لراسها وسط الكود باش تحل مشكل كبير عن طريق تقسيمو لمشاكل صغر، حتى كتوصل لواحد شرط التوقف (Base Case).',
    normal:
      'الـ Recursion هي بحال فاش كتوقف بين جوج مرايات، أو بحال الدمى الروسية وحدة وسط وحدة. الدالة كتبقى تقسم المشكل لنفس المشكل ولكن بحجم أصغر، وضروري يكون عندها Base Case باش ما تدخلش فـ Infinite Loop.',
    eli5:
      'تخيل واقف فصف طويل وبغيتي تعرف شحال من واحد قدامك: كتسول اللي قدامك، وهو كيسول اللي قدامو، حتى كيوصلو للأول فالصف كيقول "أنا رقم 1"، وكترجع النتيجة لعندك.',
    deep:
      'الـ Recursion كتعتمد على Call Stack ديال الذاكرة: كل نداء جديد كيتحط فـ Stack Frame مستقل حتى كيتحقق الـ Base Case، ومن بعد كيبداو النتائج يرجعو بالترتيب العكسي (Unwinding).',
    technical:
      'تقنيا، كل استدعاء ذاتي كينشئ Stack Frame جديد بـ Time Complexity غالبا O(n) أو O(2^n) حسب التفرع، وSpace Complexity O(n) فـ Call Stack إلا إلا استعملنا Tail Call Optimization.',
    whyNeeded:
      'كنحتاجوها بزاف فالهياكل المتفرعة بحال الأشجار (Trees)، الفولدرات وسط الفولدرات (File Systems)، وخوارزميات البحث والترتيب بحال QuickSort وMergeSort.',
    example:
      'مثال بسيط: حساب Factorial ديال 5 (`5!`) هو `5 * factorial(4)`، وكتبقى غادة حتى توصل لـ `factorial(1) = 1` وتحبس.',
  },
];

export const generalKnowledgeSkill: CompanionSkill = {
  id: 'general-knowledge',
  label: 'General Knowledge',
  description:
    'Answers general questions, explains concepts clearly in Moroccan Darija/English/French, and adapts to explanation difficulty.',
  buildSkillDirectives: (depth) =>
    `
SKILL: GENERAL KNOWLEDGE
- Answer the user's question directly and naturally. Do NOT force webpage context if the question is general.
- Current requested depth: ${depth} (QUICK = 1-2 short sentences; NORMAL = clear explanation + concrete analogy; ELI5 = ultra-simple everyday analogy; DEEP = comprehensive breakdown; TECHNICAL = exact technical architecture/terminology; STEP_BY_STEP = numbered sequential steps).
`.trim(),
  executeFallback: ({ userRequest, gatheredContext }) => {
    const lower = userRequest.toLowerCase().trim();
    const { explanationDepth, preferredLanguage, isFollowUp } =
      gatheredContext.routedIntent;

    // Check if casual greeting
    if (gatheredContext.routedIntent.intent === 'CASUAL_CONVERSATION') {
      if (/شكرا|chokran|thank/i.test(lower)) {
        return {
          message:
            preferredLanguage === 'en'
              ? 'Anytime. Tell me what you want to explore or do next.'
              : 'بلا جميل، أنا معاك ديما. قول ليا إلاحتاجيتي أي حاجة خرى.',
          action: 'none',
          targetElementId: null,
          requiresConfirmation: false,
          taskCompleted: true,
          intent: 'CASUAL_CONVERSATION',
          skillId: 'general-knowledge',
          skillLabel: 'General Knowledge',
          explanationDepth: 'QUICK',
        };
      }
      return {
        message:
          preferredLanguage === 'en'
            ? 'I am here with you. Ask me any question, code problem, writing task, or about this page.'
            : 'وعليكم السلام، أنا معاك. سولني على أي مفهوم، كود، ترجمة، إيميل، أو على هاد الصفحة وغادي نعاونك.',
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        intent: 'CASUAL_CONVERSATION',
        skillId: 'general-knowledge',
        skillLabel: 'General Knowledge',
        explanationDepth: 'QUICK',
      };
    }

    // Check topic match (either in current query or from conversational memory follow-up)
    const searchPool = isFollowUp
      ? `${userRequest} ${gatheredContext.activeTopic || ''}`
      : userRequest;

    for (const item of KNOWLEDGE_BASE_DARIJA) {
      if (item.keywords.test(searchPool)) {
        let msg = item.normal;
        if (/وعلاش|علاش كنحتاجو|3lach|why/i.test(lower)) {
          msg = `${item.whyNeeded} ${item.example}`;
        } else if (/example|مثال|3tini/i.test(lower)) {
          msg = item.example;
        } else if (explanationDepth === 'QUICK') {
          msg = item.quick;
        } else if (explanationDepth === 'ELI5') {
          msg = item.eli5;
        } else if (explanationDepth === 'DEEP') {
          msg = `${item.deep} ${item.example}`;
        } else if (explanationDepth === 'TECHNICAL') {
          msg = item.technical;
        }

        return {
          message: msg,
          action: 'none',
          targetElementId: null,
          requiresConfirmation: false,
          taskCompleted: true,
          intent: gatheredContext.routedIntent.intent,
          skillId: 'general-knowledge',
          skillLabel: 'General Knowledge',
          explanationDepth,
          topic: item.topic,
        };
      }
    }

    // If user selected text on the page and asked "chno hada?" / "شنو هادا؟"
    if (gatheredContext.selectedText) {
      return {
        message: `النص اللي حددتي كيهضر على: "${gatheredContext.selectedText.slice(0, 120)}". بغيتي نلخصو ليك، نترجمو، ولا نشرحو بالتفصيل؟`,
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        intent: 'EXPLANATION',
        skillId: 'general-knowledge',
        skillLabel: 'General Knowledge',
        explanationDepth,
        topic: gatheredContext.selectedText.slice(0, 40),
      };
    }

    return null;
  },
};
