import { PageContext, TaskState } from '../shared/types';
import { ConversationMemorySnapshot } from '../memory/conversation-memory';
import { RoutedIntentResult } from '../intent-router/intent-router';
import { describeSpatialLocation } from '../content/element-highlighter';

export interface GatheredCompanionContext {
  userRequest: string;
  routedIntent: RoutedIntentResult;
  activeTopic: string | null;
  recentConversation: Array<{ role: 'user' | 'ai'; text: string }>;
  selectedText?: string;
  visibleCodeSnippets?: string[];
  webpageSummary?: {
    pageTitle: string;
    url: string;
    headings: string[];
    visibleTextExcerpt: string;
  };
  relevantDomElements?: Array<{
    id: string;
    tag: string;
    text: string;
    role: string;
    label?: string;
    placeholder?: string;
    inputType?: string;
    isSensitive?: boolean;
    locationDarija: string;
    locationEn: string;
  }>;
  activeTaskGoal?: string;
}

/**
 * Intelligent Context Engine
 * Combines ONLY the context sources relevant to the user's actual question:
 * - Does NOT send webpage DOM bloat when the user asks a general question ("شنو هو API؟", "شنو هو recursion؟").
 * - Includes selected text or visible code blocks when explaining/translating/debugging.
 * - Includes bounded webpage summary when summarizing or analyzing the page.
 * - Includes interactive DOM elements with spatial locations when locating elements or guiding forms.
 */
export class ContextEngine {
  /**
   * Reads any currently highlighted/selected text in the browser window.
   */
  public getSelectedText(): string {
    if (typeof window === 'undefined' || !window.getSelection) return '';
    try {
      return (window.getSelection()?.toString() || '').trim().slice(0, 1500);
    } catch {
      return '';
    }
  }

  /**
   * Extracts visible `<pre>`, `<code>`, or developer error blocks from the page when needed for CODING/DEBUGGING.
   */
  public extractVisibleCodeSnippets(root?: HTMLElement | null): string[] {
    if (typeof document === 'undefined') return [];
    const scope = root || document.body;
    if (!scope) return [];

    try {
      const codeNodes = Array.from(
        scope.querySelectorAll('pre, code, [data-code], .code, .error-message')
      );
      const snippets: string[] = [];
      for (const node of codeNodes) {
        const text = (node.textContent || '').trim();
        if (text.length > 12 && !snippets.includes(text)) {
          snippets.push(text.slice(0, 600));
        }
        if (snippets.length >= 3) break;
      }
      return snippets;
    } catch {
      return [];
    }
  }

  public gatherContext(params: {
    userRequest: string;
    routedIntent: RoutedIntentResult;
    memory: ConversationMemorySnapshot;
    pageContext?: PageContext | null;
    taskState?: TaskState | null;
    rootElement?: HTMLElement | null;
  }): GatheredCompanionContext {
    const {
      userRequest,
      routedIntent,
      memory,
      pageContext,
      taskState,
      rootElement,
    } = params;

    const reqType = routedIntent.contextRequirement;
    const liveSelection =
      this.getSelectedText() || memory.lastSelectedText || undefined;

    const gathered: GatheredCompanionContext = {
      userRequest,
      routedIntent,
      activeTopic: routedIntent.inferredTopic || memory.activeTopic,
      recentConversation: memory.recentTurns.slice(-6).map((t) => ({
        role: t.role,
        text: t.text,
      })),
    };

    if (taskState?.goal && taskState.status !== 'IDLE') {
      gathered.activeTaskGoal = taskState.goal;
    }

    // 1. If contextRequirement is 'none' (e.g., "شنو هو API؟", "شنو هو recursion؟", "قارن ليا React وVue"),
    // DO NOT attach webpage context!
    if (reqType === 'none') {
      return gathered;
    }

    // 2. Selection only (e.g. "ترجم ليا هاد النص", "لخص هاد الفقرة")
    if (reqType === 'selection_only') {
      if (liveSelection) {
        gathered.selectedText = liveSelection;
      } else if (pageContext) {
        gathered.webpageSummary = {
          pageTitle: pageContext.pageTitle,
          url: pageContext.url,
          headings: (pageContext.headings || []).slice(0, 5),
          visibleTextExcerpt: (
            pageContext.visibleText ||
            pageContext.summaryText ||
            ''
          ).slice(0, 600),
        };
      }
      return gathered;
    }

    // 3. Code or selection (e.g. "شرح ليا هاد الكود", "علاش هاد code فيه error؟")
    if (reqType === 'code_or_selection') {
      if (liveSelection) {
        gathered.selectedText = liveSelection;
      }
      const codeSnippets = this.extractVisibleCodeSnippets(rootElement);
      if (codeSnippets.length > 0) {
        gathered.visibleCodeSnippets = codeSnippets;
      } else if (pageContext && !liveSelection) {
        gathered.webpageSummary = {
          pageTitle: pageContext.pageTitle,
          url: pageContext.url,
          headings: (pageContext.headings || []).slice(0, 5),
          visibleTextExcerpt: (
            pageContext.visibleText ||
            pageContext.summaryText ||
            ''
          ).slice(0, 600),
        };
      }
      return gathered;
    }

    // 4. Bounded page context (e.g. "لخص ليا هاد الصفحة", "شنو هاد الوثيقة؟")
    if (reqType === 'bounded_page' && pageContext) {
      if (liveSelection) {
        gathered.selectedText = liveSelection;
      }
      gathered.webpageSummary = {
        pageTitle: pageContext.pageTitle,
        url: pageContext.url,
        headings: (pageContext.headings || []).slice(0, 8),
        visibleTextExcerpt: (
          pageContext.visibleText ||
          pageContext.summaryText ||
          ''
        ).slice(0, 900),
      };
      return gathered;
    }

    // 5. Elements or Full Page context (PAGE_ANALYSIS, ELEMENT_FINDING, NAVIGATION, FORM_HELP)
    if (pageContext) {
      if (liveSelection) {
        gathered.selectedText = liveSelection;
      }
      gathered.webpageSummary = {
        pageTitle: pageContext.pageTitle,
        url: pageContext.url,
        headings: (pageContext.headings || []).slice(0, 8),
        visibleTextExcerpt: (
          pageContext.visibleText ||
          pageContext.summaryText ||
          ''
        ).slice(0, 900),
      };
      gathered.relevantDomElements = pageContext.elements
        .slice(0, 28)
        .map((e) => ({
          id: e.id,
          tag: e.tag,
          text: e.text,
          role: e.role,
          label: e.label,
          placeholder: e.placeholder,
          inputType: e.inputType || e.type,
          isSensitive: e.isSensitive,
          locationDarija: describeSpatialLocation(e.position, 'darija'),
          locationEn: describeSpatialLocation(e.position, 'en'),
        }));
    }

    return gathered;
  }
}

export const contextEngine = new ContextEngine();
