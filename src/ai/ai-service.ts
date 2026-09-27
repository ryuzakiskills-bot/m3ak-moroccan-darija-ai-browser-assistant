import {
  AIActionResponse,
  CompletedStepRecord,
  PageAnalysisResponse,
  PageContext,
  PageElement,
  VerificationResponse,
} from '../shared/types';
import {
  validateAIActionResponse,
  validatePageAnalysisResponse,
  validateVerificationResponse,
} from './schemas';
import { isSensitiveElement } from '../shared/utils';
import { describeSpatialLocation } from '../content/element-highlighter';
import { intentRouter } from '../intent-router/intent-router';
import { conversationMemory } from '../memory/conversation-memory';
import {
  contextEngine,
  GatheredCompanionContext,
} from '../context-engine/context-engine';
import { skillRegistry } from '../skills';
import {
  buildBrowserControlExecution,
  buildWebResearchExecution,
  classifyBrowserActionSafety,
  dispatchBrowserAgentPlan,
  generateConciseSearchQuery,
} from '../browser-agent/browser-agent';

const CLIENT_TIMEOUT_MS = 14000;

/**
 * Clean AI Service Abstraction (ai-service.ts)
 * Communicates with our secure backend (/api/ai/*) where @google/genai runs server-side.
 * Handles HTTP 200, 400, 401, 403, 404, 429, 500, timeout, and network offline states,
 * and includes a deterministic DOM-grounded Darija planner fallback.
 */
class AIService {
  private apiBase = '/api/ai';

  private async postJsonWithTimeout(
    endpoint: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      console.error('AI request failed: network offline');
      throw new Error('NETWORK_OFFLINE');
    }

    // When running as an injected content script on an external webpage,
    // proxy the AI request via the background service worker to avoid CORS/CSP blocks.
    const chromeGlobal = (globalThis as Record<string, any>).chrome;
    const isContentScriptOnExternalOrigin =
      typeof window !== 'undefined' &&
      Boolean(chromeGlobal?.runtime?.sendMessage) &&
      !document.getElementById('m3ak-sandbox-viewport') &&
      window.location.protocol.startsWith('http') &&
      !window.location.host.includes('localhost:3000');

    if (isContentScriptOnExternalOrigin) {
      return await new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('REQUEST_TIMEOUT')),
          CLIENT_TIMEOUT_MS
        );
        try {
          chromeGlobal.runtime.sendMessage(
            {
              type: 'AI_API_REQUEST',
              payload: { endpoint, body: payload },
            },
            (res: { ok?: boolean; data?: unknown; error?: string }) => {
              clearTimeout(timer);
              if (chromeGlobal.runtime?.lastError || !res?.ok) {
                reject(
                  new Error(
                    res?.error ||
                      chromeGlobal.runtime?.lastError?.message ||
                      'EXTENSION_AI_PROXY_FAILED'
                  )
                );
              } else {
                resolve(res.data);
              }
            }
          );
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.status !== 200) {
        console.error(`AI request failed: ${response.status}`);
        throw new Error(`HTTP_${response.status}`);
      }

      return await response.json();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.error('AI request failed: timeout');
        throw new Error('REQUEST_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 1. Analyze current webpage and explain its structure & purpose in Moroccan Darija
   */
  async analyzePage(
    pageContext: PageContext,
    screenshotDataUrl?: string
  ): Promise<PageAnalysisResponse> {
    try {
      const data = await this.postJsonWithTimeout('/analyze-page', {
        pageContext,
        screenshotDataUrl,
      });
      return validatePageAnalysisResponse(data);
    } catch {
      // If Vision screenshot or API fails, fallback cleanly to DOM analysis
      return this.localAnalyzePageFallback(pageContext);
    }
  }

  /**
   * Detects the preferred response language based on the user's speech/text:
   * - Explicit overrides ("answer in English", "بالإنجلزية", "jawbni bdarija") take priority.
   * - Pure English queries respond in English.
   * - Default and mixed Darija+English/French queries respond in natural Moroccan Darija.
   */
  detectPreferredResponseLanguage(rawInput: string): 'darija' | 'en' | 'fr' {
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
      lower.includes('بالانجليزية')
    ) {
      return 'en';
    }

    // Check for Darija Franco or Arabic markers
    const hasArabicScript = /[\u0600-\u06FF]/.test(lower);
    const hasDarijaFranco =
      /\b(salam|chno|achno|kayn|fhad|had|lpage|fin|bghit|n9leb|n3ref|taman|ndir|n3ammar|nsift|nbdl|3la|lia|dyal|hna|kifach|wach)\b/.test(
        lower
      );

    if (hasArabicScript || hasDarijaFranco) {
      return 'darija';
    }

    // Check for pure English phrases
    if (
      /\b(find|what|where|open|explain|show|how|can you|login button|pricing|button|contact form|page|hey jarvis|hello jarvis)\b/.test(
        lower
      )
    ) {
      return 'en';
    }

    return 'darija';
  }

  /**
   * 2. Understand user intent (supports Arabic Darija, Latin Darija / Franco, French, English, and Mixed speech)
   */
  understandUserIntent(rawInput: string): {
    normalizedGoal: string;
    intentCategory:
      | 'greeting'
      | 'overview'
      | 'price'
      | 'download'
      | 'login'
      | 'signup'
      | 'form'
      | 'shop'
      | 'password'
      | 'internship'
      | 'upload'
      | 'button_explain'
      | 'general';
  } {
    const lower = rawInput.toLowerCase().trim();

    if (
      /^(?:salam|slm|hey|hi|hello|yo|ya|سلام|اهلا|مرحبا)?\s*(?:jarvis|m3ak|maak|جارفيس|معاك)[!.؟?,\s]*$/i.test(
        lower
      )
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'greeting' };
    }

    if (
      lower.includes('what does this button do') ||
      lower.includes('chno kaydir had') ||
      lower.includes('شنو كيدير هاد الزر')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'button_explain' };
    }

    if (
      lower.includes('شنو كاين') ||
      lower.includes('اشنو كاين') ||
      lower.includes('شنو هاد الموقع') ||
      lower.includes('شنو كيدير هاد الموقع') ||
      lower.includes('chno kayn') ||
      lower.includes('achno kayn') ||
      lower.includes('شرح ليا') ||
      lower.includes('chrah lia') ||
      lower.includes('explain had') ||
      lower.includes('explain this page') ||
      lower.includes('what is on this page') ||
      lower.includes('what does this')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'overview' };
    }
    if (
      lower.includes('ثمن') ||
      lower.includes('الثمن') ||
      lower.includes('بشحال') ||
      lower.includes('taman') ||
      lower.includes('bch7al') ||
      lower.includes('prix') ||
      lower.includes('price') ||
      lower.includes('pricing')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'price' };
    }
    if (
      lower.includes('نحمل') ||
      lower.includes('تحميل') ||
      lower.includes('تيليشارج') ||
      lower.includes('telecharg') ||
      lower.includes('download') ||
      lower.includes('فيديو') ||
      lower.includes('فين نقدر نحمل')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'download' };
    }
    if (
      lower.includes('compte') ||
      lower.includes('inscription') ||
      lower.includes('sign up') ||
      lower.includes('register') ||
      lower.includes('حساب') ||
      lower.includes('نسجل') ||
      lower.includes('تسجيل جديد')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'signup' };
    }
    if (
      lower.includes('login') ||
      lower.includes('log in') ||
      lower.includes('sign in') ||
      lower.includes('connexion') ||
      lower.includes('connecter') ||
      lower.includes('دخول')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'login' };
    }
    if (
      lower.includes('stage') ||
      lower.includes('emploi') ||
      lower.includes('khedma') ||
      lower.includes('سطاج') ||
      lower.includes('خدمة')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'internship' };
    }
    if (
      lower.includes('chri') ||
      lower.includes('produit') ||
      lower.includes('panier') ||
      lower.includes('buy') ||
      lower.includes('نشري') ||
      lower.includes('منتوج')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'shop' };
    }
    if (
      lower.includes('password') ||
      lower.includes('mot de passe') ||
      lower.includes('nbdl') ||
      lower.includes('كلمة السر') ||
      lower.includes('باسوورد')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'password' };
    }
    if (
      lower.includes('document') ||
      lower.includes('nsift') ||
      lower.includes('upload') ||
      lower.includes('fichier') ||
      lower.includes('وثيقة') ||
      lower.includes('ملف')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'upload' };
    }
    if (
      lower.includes('formulaire') ||
      lower.includes('n3ammar') ||
      lower.includes('hadchi') ||
      lower.includes('contact form') ||
      lower.includes('form') ||
      lower.includes('إستمارة') ||
      lower.includes('نعمر')
    ) {
      return { normalizedGoal: rawInput, intentCategory: 'form' };
    }

    return { normalizedGoal: rawInput, intentCategory: 'general' };
  }

  /**
   * 3. Universal Companion Router + Context Engine + Skill Execution
   * Routes user intent -> gathers ONLY relevant context -> invokes Gemini or modular skill -> records conversational memory.
   */
  async getNextAction(params: {
    userGoal: string;
    pageContext: PageContext;
    currentStep: number;
    completedSteps: CompletedStepRecord[];
    userFollowUp?: string;
    screenshotDataUrl?: string;
  }): Promise<AIActionResponse> {
    const selectedText = contextEngine.getSelectedText();
    const memorySnapshot = conversationMemory.getSnapshot();
    const routedIntent = intentRouter.route(
      params.userGoal,
      memorySnapshot,
      Boolean(selectedText)
    );
    const gatheredContext = contextEngine.gatherContext({
      userRequest: params.userGoal,
      routedIntent,
      memory: memorySnapshot,
      pageContext: params.pageContext,
    });

    conversationMemory.recordUserTurn({
      text: params.userGoal,
      topic: routedIntent.inferredTopic,
      intent: routedIntent.intent,
      skillId: routedIntent.skillId,
      depth: routedIntent.explanationDepth,
      selectedText,
    });

    const finalizeResponse = (res: AIActionResponse): AIActionResponse => {
      const enriched: AIActionResponse = {
        ...res,
        intent: res.intent || routedIntent.intent,
        skillId: res.skillId || routedIntent.skillId,
        skillLabel: res.skillLabel || routedIntent.skillLabel,
        explanationDepth: res.explanationDepth || routedIntent.explanationDepth,
        topic: res.topic || routedIntent.inferredTopic,
      };
      if (enriched.browserAgentPlan) {
        dispatchBrowserAgentPlan(enriched.browserAgentPlan);
      }
      conversationMemory.recordAITurn({
        text: enriched.message,
        topic: enriched.topic,
        intent: enriched.intent,
        skillId: enriched.skillId,
        targetElementId: enriched.targetElementId,
      });
      return enriched;
    };

    // 0. Check for FORBIDDEN or direct BROWSER CONTROL commands ("7ell Google", "7ell YouTube", "go back", "reload")
    const directBrowserCmd = buildBrowserControlExecution(params.userGoal);
    if (directBrowserCmd) {
      return finalizeResponse(directBrowserCmd);
    }

    // 1. Dedicated WEB RESEARCH workflow (Search Grounding + Multi-Source Inspection)
    if (routedIntent.intent === 'RESEARCH') {
      const safety = classifyBrowserActionSafety(params.userGoal);
      if (safety.tier === 'FORBIDDEN') {
        return finalizeResponse(
          buildWebResearchExecution({
            userRequest: params.userGoal,
            pageContext: params.pageContext,
          })
        );
      }

      const searchQuery = generateConciseSearchQuery(params.userGoal);
      // Immediately dispatch search navigation so the browser/sandbox opens the search view
      dispatchBrowserAgentPlan({
        browserAction: 'search_query',
        safetyTier: safety.tier,
        targetUrl: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
        searchQuery,
        progressStage: 'SEARCHING',
        steps: [],
        sources: [],
      });

      try {
        const researchData = (await this.postJsonWithTimeout('/web-research', {
          userGoal: params.userGoal,
          searchQuery,
          preferredLanguage: routedIntent.preferredLanguage,
        })) as {
          answer?: string;
          searchQuery?: string;
          sources?: Array<{
            title: string;
            url: string;
            snippet?: string;
            isOfficial?: boolean;
          }>;
        };

        // Merge live search grounding with structured multi-page verification
        const fallbackStructured = buildWebResearchExecution({
          userRequest: params.userGoal,
          pageContext: params.pageContext,
        });

        const mergedResult = buildWebResearchExecution({
          userRequest: params.userGoal,
          pageContext: params.pageContext,
          serverResearchData: {
            answer: researchData?.answer || fallbackStructured.message,
            searchQuery: researchData?.searchQuery || searchQuery,
            sources:
              researchData?.sources && researchData.sources.length > 0
                ? researchData.sources
                : fallbackStructured.browserAgentPlan?.sources,
            steps: fallbackStructured.browserAgentPlan?.steps.map(
              (s) => s.title
            ),
            uncertaintyNote:
              fallbackStructured.browserAgentPlan?.uncertaintyNote,
          },
        });
        return finalizeResponse(mergedResult);
      } catch {
        return finalizeResponse(
          buildWebResearchExecution({
            userRequest: params.userGoal,
            pageContext: params.pageContext,
          })
        );
      }
    }

    try {
      // Only send pageContext to the server if ContextEngine determined it is relevant!
      const payloadForServer: Record<string, unknown> = {
        userGoal: params.userGoal,
        gatheredContext,
        currentStep: params.currentStep,
        completedSteps: params.completedSteps,
        userFollowUp: params.userFollowUp,
        screenshotDataUrl: params.screenshotDataUrl,
      };
      if (routedIntent.contextRequirement !== 'none') {
        payloadForServer.pageContext = params.pageContext;
      }

      const data = await this.postJsonWithTimeout(
        '/next-action',
        payloadForServer
      );
      const validated = validateAIActionResponse(data);

      // Ensure targetElementId actually exists in current PageContext when an element is targeted
      if (
        validated.targetElementId &&
        !params.pageContext.elements.some(
          (e) => e.id === validated.targetElementId
        )
      ) {
        return finalizeResponse(
          this.localNextActionFallback({
            ...params,
            gatheredContext,
          })
        );
      }

      return finalizeResponse(validated);
    } catch {
      return finalizeResponse(
        this.localNextActionFallback({
          ...params,
          gatheredContext,
        })
      );
    }
  }

  /**
   * 4. Verify user action on the page and transition to the next step
   */
  async verifyAction(params: {
    userGoal: string;
    previousInstruction: string;
    previousTargetId: string | null;
    interactionDescription: string;
    updatedPageContext: PageContext;
    currentStep: number;
    completedSteps: CompletedStepRecord[];
  }): Promise<VerificationResponse> {
    try {
      const data = await this.postJsonWithTimeout('/verify-action', params);
      const validated = validateVerificationResponse(data);

      if (
        validated.nextAction?.targetElementId &&
        !params.updatedPageContext.elements.some(
          (e) => e.id === validated.nextAction?.targetElementId
        )
      ) {
        const localNext = this.localNextActionFallback({
          userGoal: params.userGoal,
          pageContext: params.updatedPageContext,
          currentStep: params.currentStep + 1,
          completedSteps: params.completedSteps,
        });
        return {
          verified: true,
          messageDarija: localNext.message,
          taskCompleted: localNext.taskCompleted,
          nextAction: localNext,
        };
      }

      return validated;
    } catch {
      const nextStep = this.localNextActionFallback({
        userGoal: params.userGoal,
        pageContext: params.updatedPageContext,
        currentStep: params.currentStep + 1,
        completedSteps: params.completedSteps,
      });
      return {
        verified: true,
        messageDarija: nextStep.message,
        taskCompleted: nextStep.taskCompleted,
        nextAction: nextStep,
      };
    }
  }

  /**
   * 5. Generate natural Darija conversational response
   */
  async generateDarijaResponse(
    userMessage: string,
    pageContext: PageContext
  ): Promise<AIActionResponse> {
    return this.getNextAction({
      userGoal: userMessage,
      pageContext,
      currentStep: 1,
      completedSteps: [],
    });
  }

  /**
   * Deterministic DOM-grounded fallback for Page Analysis
   */
  private localAnalyzePageFallback(
    pageContext: PageContext
  ): PageAnalysisResponse {
    const inputs = pageContext.elements.filter(
      (e) => e.tag === 'input' || e.tag === 'textarea' || e.tag === 'select'
    );
    const buttons = pageContext.elements.filter(
      (e) => e.tag === 'button' || e.role === 'button' || e.tag === 'a'
    );

    const inputNames = inputs
      .slice(0, 3)
      .map(
        (i) => i.label || i.placeholder || i.name || i.inputType || 'خانة'
      )
      .join('، ');
    const btnNames = buttons
      .slice(0, 3)
      .map((b) => b.text || b.ariaLabel || 'زر')
      .join(' و ');

    const summaryDarija = `هاد الصفحة هي "${pageContext.pageTitle}". ${
      inputs.length > 0
        ? `فيها ${inputs.length} خانات (${inputNames})`
        : 'فيها معلومات وعناصر تفاعلية'
    }${
      btnNames ? `، وأزرار بحال ${btnNames}.` : '.'
    } إلا بغيتي نقدر نشرح ليك التفاصيل أو نوريك فين تكليكي.`;

    return {
      summaryDarija,
      pageType: pageContext.pageTitle,
      keyElements: pageContext.elements.slice(0, 4).map((el) => ({
        id: el.id,
        label: el.text || el.label || el.placeholder || el.tag,
        purposeDarija:
          el.tag === 'input' || el.tag === 'textarea'
            ? `خانة باش تدخل ${el.label || el.placeholder || 'المعلومات'}`
            : `زر باش تكليكي على ${el.text || el.ariaLabel || 'هاد العنصر'}`,
      })),
      suggestedTasks: [
        {
          labelDarija: 'شنو كاين هنا؟',
          command: 'شنو كاين هنا؟',
        },
        {
          labelDarija: 'قلب ليا على الثمن',
          command: 'قلب ليا على الثمن',
        },
        {
          labelDarija: 'بغيت نقلب على Login',
          command: 'bghit n9leb 3la login',
        },
      ],
    };
  }

  /**
   * Deterministic DOM-grounded step-by-step planner in Moroccan Darija.
   * Covers JARVIS conversational queries (Page Overview, Price Lookup, Download/Button Locating)
   * and all 6 functional test scenarios (Login, Sign Up, Formulaire,
   * Password Change, Product Purchase, Document Upload) + general pages.
   */
  private localNextActionFallback(params: {
    userGoal: string;
    pageContext: PageContext;
    currentStep: number;
    completedSteps: CompletedStepRecord[];
    gatheredContext?: GatheredCompanionContext;
  }): AIActionResponse {
    const { userGoal, pageContext, currentStep, completedSteps } = params;

    // 0. First run the Universal Skill System if this is not a webpage-specific navigation/element task
    const memorySnapshot = conversationMemory.getSnapshot();
    const effectiveGathered =
      params.gatheredContext ||
      contextEngine.gatherContext({
        userRequest: userGoal,
        routedIntent: intentRouter.route(
          userGoal,
          memorySnapshot,
          Boolean(contextEngine.getSelectedText())
        ),
        memory: memorySnapshot,
        pageContext,
      });

    const routedSkill = skillRegistry.getSkill(
      effectiveGathered.routedIntent.skillId
    );
    const skillResult = routedSkill.executeFallback({
      userRequest: userGoal,
      gatheredContext: effectiveGathered,
      pageContext,
      currentStep,
      completedSteps,
    });

    if (skillResult) {
      return skillResult;
    }

    const { intentCategory } = this.understandUserIntent(userGoal);
    const replyLang = this.detectPreferredResponseLanguage(userGoal);
    const doneIds = new Set(
      completedSteps.map((s) => s.elementId).filter(Boolean) as string[]
    );

    const elements = pageContext.elements.filter(
      (e) => e.visible && !e.disabled
    );

    // JARVIS Wake Greeting: "Salam Jarvis" / "Salam M3ak" / "Hey Jarvis"
    if (intentCategory === 'greeting') {
      return {
        message:
          replyLang === 'en'
            ? 'At your service. What would you like me to do on this page?'
            : 'وعليكم السلام، أنا معاك. شنو بغيتي ندير ليك فهاد الصفحة؟',
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        currentStepNumber: 1,
        estimatedTotalSteps: 1,
        stepTitle: replyLang === 'en' ? 'Ready' : 'أنا معاك',
      };
    }

    // JARVIS Intent: "what does this button do?" / "شنو كيدير هاد الزر؟"
    if (intentCategory === 'button_explain') {
      const btnEl =
        elements.find((e) => e.tag === 'button' || e.role === 'button') ||
        elements[0];
      if (btnEl) {
        const loc = describeSpatialLocation(btnEl.position, replyLang);
        const btnLabel = btnEl.text || btnEl.ariaLabel || btnEl.label || 'Button';
        return {
          message:
            replyLang === 'en'
              ? `The "${btnLabel}" button ${loc} triggers the primary action for this section on "${pageContext.pageTitle}". I have highlighted it for you.`
              : `هاد الزر "${btnLabel}" اللي كاين ${loc} كيسمح ليك تنفذ هاد العملية فـ "${pageContext.pageTitle}". ها هو مضوي قدامك.`,
          action: 'focus',
          targetElementId: btnEl.id,
          requiresConfirmation: false,
          taskCompleted: true,
          currentStepNumber: 1,
          estimatedTotalSteps: 1,
          stepTitle: replyLang === 'en' ? 'Button Purpose' : 'دور هاد الزر',
        };
      }
    }

    // JARVIS Intent A: "شنو كاين هنا؟" / "chno kayn f had page?" / "can you explain had lpage?" / "شرح ليا هاد الصفحة بالإنجليزية"
    if (intentCategory === 'overview') {
      const textPool = `${pageContext.visibleText || ''} ${pageContext.summaryText || ''}`;
      const priceMatch = textPool.match(
        /(\d[\d\s.,]*\s*(?:DH|MAD|درهم|€|\$|DHS))/i
      );
      const topHeading = pageContext.headings?.[0] || pageContext.pageTitle;
      const firstAction = elements[0];

      const overviewMsg =
        replyLang === 'en'
          ? priceMatch
            ? `This page is "${topHeading}" and displays a price of ${priceMatch[1].trim()}. There are ${elements.length} interactive elements available.`
            : `This page is "${topHeading}" with ${elements.length} interactive elements. Tell me what you want to find or click.`
          : priceMatch
          ? `هاد الصفحة فيها معلومات على "${topHeading}" والثمن ديالو (${priceMatch[1].trim()}). إلا بغيتي نقدر نشرح ليك التفاصيل أو نعاونك تكمل الطلب.`
          : `هاد الصفحة ديال "${topHeading}". فيها ${elements.length} عناصر تفاعلية. إلا بغيتي نقدر نشرح ليك التفاصيل أو نوريك فين تكليكي.`;

      return {
        message: overviewMsg,
        action: firstAction ? 'focus' : 'none',
        targetElementId: firstAction ? firstAction.id : null,
        requiresConfirmation: false,
        taskCompleted: true,
        currentStepNumber: 1,
        estimatedTotalSteps: 1,
        stepTitle:
          replyLang === 'en' ? 'Page Overview' : 'نظرة عامة على الصفحة',
      };
    }

    // JARVIS Intent B: "قلب ليا على الثمن" / "bghit n3ref taman" / "open the pricing section"
    if (intentCategory === 'price') {
      const textPool = `${pageContext.visibleText || ''} ${pageContext.summaryText || ''} ${(pageContext.headings || []).join(' ')}`;
      const priceMatch = textPool.match(
        /(\d[\d\s.,]*\s*(?:DH|MAD|درهم|€|\$|DHS))/i
      );
      const buyBtn = elements.find((el) =>
        /panier|commander|payer|buy|price|pricing|tarif|شراء|سلة|ثمن/i.test(
          `${el.text} ${el.ariaLabel || ''}`
        )
      );

      if (priceMatch) {
        const loc = buyBtn
          ? describeSpatialLocation(buyBtn.position, replyLang)
          : '';
        return {
          message:
            replyLang === 'en'
              ? `The price on this page is ${priceMatch[1].trim()}.${
                  buyBtn ? ` The action button is ${loc}.` : ''
                }`
              : `الثمن اللي لقيت فهاد الصفحة هو ${priceMatch[1].trim()}.${
                  buyBtn ? ` ها هو الزر ديال الشراء ${loc}.` : ''
                }`,
          action: buyBtn ? 'click' : 'none',
          targetElementId: buyBtn ? buyBtn.id : null,
          requiresConfirmation: false,
          taskCompleted: !buyBtn,
          currentStepNumber: 1,
          estimatedTotalSteps: buyBtn ? 2 : 1,
          stepTitle: replyLang === 'en' ? 'Price Lookup' : 'الثمن فهاد الصفحة',
        };
      }

      return {
        message:
          replyLang === 'en'
            ? 'I scanned this page and did not find a visible price listed here.'
            : 'قلبت فهاد الصفحة وما بانش ليا شي ثمن مكتوب بوضوح هنا. إلا كنتي فصفحة ديال منتوج، جرب نفتحو صفحة المنتوج.',
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        currentStepNumber: 1,
        estimatedTotalSteps: 1,
        stepTitle: replyLang === 'en' ? 'Price Lookup' : 'البحث على الثمن',
      };
    }

    // JARVIS Intent C: "فين نقدر نحمل هاد الفيديو / الوثيقة؟" (Download / Action Locator)
    if (intentCategory === 'download') {
      const downloadEl =
        elements.find((el) =>
          /download|télécharg|حمل|تحميل|وثيقة|document|fichier|pdf|فيديو|video/i.test(
            `${el.text} ${el.label || ''} ${el.ariaLabel || ''} ${el.href || ''}`
          )
        ) ||
        elements.find((el) => el.tag === 'button' || el.tag === 'a');

      if (downloadEl) {
        const loc = describeSpatialLocation(downloadEl.position, replyLang);
        return {
          message:
            replyLang === 'en'
              ? `Here is the "${
                  downloadEl.text || downloadEl.label || 'Download'
                }" button ${loc}. I have highlighted it for you.`
              : `ها هو الزر ديال "${
                  downloadEl.text || downloadEl.label || 'التحميل'
                }" ${loc}، غادي نوريه ليك دابا.`,
          action: 'click',
          targetElementId: downloadEl.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: 1,
          estimatedTotalSteps: 1,
          stepTitle:
            replyLang === 'en' ? 'Download Button' : 'تحديد زر التحميل',
        };
      }
    }

    // Check if the page already shows a completion banner in summaryText
    if (
      completedSteps.length > 0 &&
      (pageContext.summaryText.includes('SUCCESS_BANNER:') ||
        pageContext.summaryText.includes('تم بنجاح') ||
        pageContext.summaryText.includes('Compte créé') ||
        pageContext.summaryText.includes('Candidature envoyée') ||
        pageContext.summaryText.includes('Commande confirmée') ||
        pageContext.summaryText.includes('Mot de passe mis à jour') ||
        pageContext.summaryText.includes('Document transmis'))
    ) {
      return {
        message: 'مزيان بزاف 🎉 سالينا المهمة بنجاح! كلشي داز هو هداك.',
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        currentStepNumber: currentStep,
        estimatedTotalSteps: currentStep,
        stepTitle: 'المهمة كملات',
      };
    }

    const findUnused = (predicate: (el: PageElement) => boolean) =>
      elements.find((el) => !doneIds.has(el.id) && predicate(el));

    const matchText = (el: PageElement, keywords: string[]) => {
      const blob = [
        el.text,
        el.label,
        el.placeholder,
        el.ariaLabel,
        el.name,
        el.inputType,
        el.type,
      ]
        .join(' ')
        .toLowerCase();
      return keywords.some((k) => blob.includes(k.toLowerCase()));
    };

    // TEST 1: Intent Login ("bghit n9leb 3la login")
    if (intentCategory === 'login') {
      const navLoginBtn = findUnused(
        (el) =>
          (el.tag === 'button' || el.tag === 'a') &&
          matchText(el, ['se connecter', 'login', 'sign in', 'تسجيل الدخول']) &&
          !elements.some((inp) => (inp.inputType || inp.type) === 'password')
      );
      if (navLoginBtn) {
        const loc = describeSpatialLocation(navLoginBtn.position, replyLang);
        return {
          message:
            replyLang === 'en'
              ? `The "${navLoginBtn.text || 'Login'}" button is ${loc}. I have highlighted it for you.`
              : `كاين login ${loc}. ها هو زر "${navLoginBtn.text || 'Login'}" مضوي قدامك.`,
          action: 'click',
          targetElementId: navLoginBtn.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 4,
          stepTitle:
            replyLang === 'en' ? 'Locate Login Button' : 'فتح صفحة تسجيل الدخول',
        };
      }

      const emailInput = findUnused(
        (el) =>
          el.tag === 'input' &&
          !el.valuePresent &&
          matchText(el, ['email', 'إيميل', 'بريد', 'identifiant'])
      );
      if (emailInput) {
        return {
          message: `مزيان ✅ دابا وصلنا لصفحة Login.\nدخل الإيميل ديالك فهاد الخانة (${emailInput.label || emailInput.placeholder || 'Email'}).`,
          action: 'focus',
          targetElementId: emailInput.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 4,
          stepTitle: 'إدخال البريد الإلكتروني',
        };
      }

      const passInput = findUnused(
        (el) =>
          el.tag === 'input' &&
          !el.valuePresent &&
          ((el.inputType || el.type) === 'password' ||
            matchText(el, ['password', 'mot de passe', 'كلمة السر']))
      );
      if (passInput) {
        return {
          message: 'مزيان 👌 دابا دخل كلمة السر (Password) ديالك فهاد الخانة.',
          action: 'focus',
          targetElementId: passInput.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 4,
          stepTitle: 'إدخال كلمة السر',
        };
      }

      const submitLogin = findUnused(
        (el) =>
          (el.tag === 'button' || el.role === 'button') &&
          matchText(el, ['login', 'se connecter', 'دخول', 'sign in', 'valider'])
      );
      if (submitLogin) {
        return {
          message: `دابا كلشي واجد ✅ كليكي على زر "${submitLogin.text}" باش تدخل للحساب ديالك.`,
          action: 'click',
          targetElementId: submitLogin.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 4,
          stepTitle: 'تأكيد الدخول',
        };
      }
    }

    // TEST 2: Intent Sign Up ("bghit ndir compte hna")
    if (intentCategory === 'signup') {
      const signUpNav = findUnused(
        (el) =>
          (el.tag === 'button' || el.tag === 'a') &&
          matchText(el, [
            'sign up',
            'créer un compte',
            'inscription',
            'حساب جديد',
            'register',
          ]) &&
          elements.filter((i) => i.tag === 'input').length < 3
      );
      if (signUpNav) {
        return {
          message: `واخا 👋 دابا شوف الفوق على اليمين.\nكاين زر "${signUpNav.text}". كليكي عليه.`,
          action: 'click',
          targetElementId: signUpNav.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 5,
          stepTitle: 'الضغط على زر Sign Up',
        };
      }
    }

    // Internship search ("bghit n9leb 3la stage")
    if (intentCategory === 'internship') {
      const stageTab = findUnused(
        (el) =>
          (el.tag === 'button' || el.tag === 'a') &&
          matchText(el, [
            'offres de stage',
            'stages',
            'سطاج',
            'internships',
            'chercher un stage',
          ]) &&
          elements.filter((i) => i.tag === 'input' || i.tag === 'select').length === 0
      );
      if (stageTab) {
        return {
          message: `واخا 👋 باش نقلبو على سطاج، كليكي أولا على "${stageTab.text}".`,
          action: 'click',
          targetElementId: stageTab.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 4,
          stepTitle: 'فتح قسم السطاج (Stages)',
        };
      }

      const searchInput = findUnused(
        (el) =>
          el.tag === 'input' &&
          !el.valuePresent &&
          matchText(el, [
            'search',
            'recherche',
            'stage',
            'ميدان',
            'تخصص',
            'domaine',
            'spécialité',
          ])
      );
      if (searchInput) {
        return {
          message: `مزيان ✅ دابا كتب التخصص أو الميدان لي كتقلب فيه على سطاج فهاد الخانة (${searchInput.label || searchInput.placeholder || 'Domaine'}).`,
          action: 'focus',
          targetElementId: searchInput.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 4,
          stepTitle: 'كتابة تخصص السطاج',
        };
      }

      const citySelect = findUnused(
        (el) => el.tag === 'select' && !el.valuePresent
      );
      if (citySelect) {
        return {
          message: `مزيان 👌 دابا ختار المدينة لي بغيتي تدير فيها السطاج من هاد القائمة (${citySelect.label || 'Ville'}).`,
          action: 'select',
          targetElementId: citySelect.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 4,
          stepTitle: 'اختيار المدينة',
        };
      }

      const applyBtn = findUnused(
        (el) =>
          el.tag === 'button' &&
          matchText(el, [
            'postuler',
            'apply',
            'submit application',
            'تقديم',
            'إرسال الطلب',
          ])
      );
      if (applyBtn) {
        return {
          message: `وجدنا كلشي ✅ باقي غير تكليكي على "${applyBtn.text}" باش تصيفط طلب السطاج. بغيتي نديرها ليك؟`,
          action: 'click',
          targetElementId: applyBtn.id,
          requiresConfirmation: true,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 4,
          stepTitle: 'تأكيد طلب السطاج',
        };
      }
    }

    // TEST 5: Intent Shopping ("bghit nchri had produit")
    if (intentCategory === 'shop') {
      const selectOption = findUnused(
        (el) => el.tag === 'select' && !el.valuePresent
      );
      if (selectOption) {
        return {
          message: `واخا 👋 أولا ختار اللون أو الموديل ديال المنتوج من هاد القائمة (${selectOption.label || 'Options'}).`,
          action: 'select',
          targetElementId: selectOption.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 3,
          stepTitle: 'اختيار مواصفات المنتوج',
        };
      }

      const phoneOrAddressInput = findUnused(
        (el) => el.tag === 'input' && !el.valuePresent
      );
      if (phoneOrAddressInput) {
        return {
          message: `مزيان ✅ دابا دخل رقم الهاتف والمدينة ديال التوصيل فهاد الخانة (${phoneOrAddressInput.label || 'Téléphone'}).`,
          action: 'focus',
          targetElementId: phoneOrAddressInput.id,
          requiresConfirmation: false,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 3,
          stepTitle: 'معلومات التوصيل',
        };
      }

      const shopBtn = findUnused(
        (el) =>
          el.tag === 'button' &&
          matchText(el, [
            'add to cart',
            'ajouter au panier',
            'شراء',
            'سلة',
            'commander',
            'payer',
          ])
      );
      if (shopBtn) {
        const sensitive =
          isSensitiveElement(shopBtn) ||
          matchText(shopBtn, ['commander', 'payer', 'تأكيد الشراء']);
        return {
          message: sensitive
            ? `وجدنا الطلبية ✅ هادي خطوة ديال الخلاص والشراء ("${shopBtn.text}"). بغيتي نأكدها ليك؟`
            : `مزيان 👌 دابا كليكي على زر "${shopBtn.text}" باش تزيد المنتوج فالسلة.`,
          action: 'click',
          targetElementId: shopBtn.id,
          requiresConfirmation: sensitive,
          taskCompleted: false,
          currentStepNumber: currentStep,
          estimatedTotalSteps: 3,
          stepTitle: sensitive ? 'تأكيد الشراء والخلاص' : 'إضافة للسلة',
        };
      }
    }

    // TEST 3, TEST 4, TEST 6 & Generic Form Sequential Guidance:
    // Find the next empty input, textarea, or select on the current page
    const nextEmptyInput = findUnused(
      (el) =>
        (el.tag === 'input' || el.tag === 'textarea' || el.tag === 'select') &&
        !el.valuePresent
    );

    if (nextEmptyInput) {
      const fieldLabel =
        nextEmptyInput.label ||
        nextEmptyInput.placeholder ||
        nextEmptyInput.ariaLabel ||
        nextEmptyInput.name ||
        'هاد الخانة';
      return {
        message:
          currentStep === 1
            ? `واخا 👋 نبداو بالخطوة اللولة.\nعمر "${fieldLabel}" فهاد الخانة لي ضويت ليك عليها.`
            : `مزيان ✅ دابا وصلنا للخطوة ${currentStep}.\nدخل "${fieldLabel}" هنا.`,
        action: nextEmptyInput.tag === 'select' ? 'select' : 'focus',
        targetElementId: nextEmptyInput.id,
        requiresConfirmation: false,
        taskCompleted: false,
        currentStepNumber: currentStep,
        estimatedTotalSteps: Math.max(currentStep + 1, 4),
        stepTitle: `تعمار: ${fieldLabel}`,
      };
    }

    // Check for file upload attachment button (TEST 6: "bghit nsift had document")
    const uploadAttachmentBtn = findUnused(
      (el) =>
        el.tag === 'button' &&
        matchText(el, ['choisir un fichier', 'upload document', 'تزيد الوثيقة']) &&
        !el.text.includes('Fichier joint:')
    );
    if (uploadAttachmentBtn) {
      return {
        message: `مزيان ✅ دابا كليكي على هاد الزر باش تزيد الوثيقة (PDF / Document) ديالك.`,
        action: 'click',
        targetElementId: uploadAttachmentBtn.id,
        requiresConfirmation: false,
        taskCompleted: false,
        currentStepNumber: currentStep,
        estimatedTotalSteps: currentStep + 1,
        stepTitle: 'إرفاق الوثيقة',
      };
    }

    // Look for primary submit / action button
    const primaryButton = findUnused(
      (el) =>
        (el.tag === 'button' ||
          el.role === 'button' ||
          (el.tag === 'input' &&
            (el.inputType === 'submit' || el.type === 'submit'))) &&
        !el.text.includes('Fichier joint:')
    );

    if (primaryButton) {
      const sensitive =
        isSensitiveElement(primaryButton) ||
        intentCategory === 'password' ||
        intentCategory === 'upload' ||
        intentCategory === 'form';
      return {
        message: sensitive
          ? `وجدنا كلشي ✅\nباقي غير "${primaryButton.text || 'Submit'}".\nبغيتي نديرها ليك؟`
          : `مزيان 👌 دابا كليكي على زر "${primaryButton.text || primaryButton.ariaLabel || 'تابِع'}" باش نكملو.`,
        action: 'click',
        targetElementId: primaryButton.id,
        requiresConfirmation: sensitive,
        taskCompleted: false,
        currentStepNumber: currentStep,
        estimatedTotalSteps: currentStep,
        stepTitle: `الضغط على ${primaryButton.text || 'الزر'}`,
      };
    }

    return {
      message:
        'مزيان بزاف 🎉 سالينا المهمة! إلا بغيتي نديرو شي حاجة خرى فهاد الصفحة قولها ليا.',
      action: 'none',
      targetElementId: null,
      requiresConfirmation: false,
      taskCompleted: true,
      currentStepNumber: currentStep,
      estimatedTotalSteps: currentStep,
      stepTitle: 'المهمة كملات',
    };
  }
}

export const aiService = new AIService();
export default aiService;
