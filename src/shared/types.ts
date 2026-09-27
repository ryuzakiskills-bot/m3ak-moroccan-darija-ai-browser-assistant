export type AvatarState =
  | 'idle'
  | 'thinking'
  | 'speaking'
  | 'success'
  | 'error'
  | 'waiting';

export type MicrophoneState =
  | 'Idle'
  | 'Listening'
  | 'Processing'
  | 'Speaking';

export type TaskStatus =
  | 'IDLE'
  | 'UNDERSTANDING'
  | 'SEARCHING'
  | 'ANALYZING'
  | 'READY'
  | 'GUIDING'
  | 'WAITING_FOR_USER'
  | 'VERIFYING'
  | 'NEXT_STEP'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'ERROR';

export type ResearchProgressStage =
  | 'UNDERSTANDING'
  | 'SEARCHING'
  | 'ANALYZING'
  | 'READY';

export type BrowserAgentActionType =
  | 'open_tab'
  | 'navigate_url'
  | 'open_search_engine'
  | 'search_query'
  | 'open_search_result'
  | 'go_back'
  | 'go_forward'
  | 'reload'
  | 'switch_tab'
  | 'focus_page'
  | 'locate_element'
  | 'click_safe_element'
  | 'read_page_content'
  | 'none';

export type BrowserActionSafetyTier =
  | 'SAFE_AUTOMATIC'
  | 'SENSITIVE_CONFIRMATION'
  | 'FORBIDDEN';

export interface ResearchSourceItem {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  isOfficial: boolean;
  inspected: boolean;
  freshnessNote?: string;
}

export interface ResearchStepItem {
  stepNumber: number;
  title: string;
  status: 'completed' | 'active' | 'pending';
  detail?: string;
}

export interface BrowserAgentExecutionPlan {
  browserAction: BrowserAgentActionType;
  safetyTier: BrowserActionSafetyTier;
  safetyReason?: string;
  targetUrl?: string;
  searchQuery?: string;
  progressStage: ResearchProgressStage;
  steps: ResearchStepItem[];
  sources: ResearchSourceItem[];
  adsFilteredCount?: number;
  uncertaintyNote?: string;
}

export type ActionType =
  | 'click'
  | 'focus'
  | 'type'
  | 'input'
  | 'select'
  | 'scroll'
  | 'none';

export type UniversalIntentCategory =
  | 'GENERAL_QUESTION'
  | 'EXPLANATION'
  | 'TEACHING'
  | 'SUMMARIZATION'
  | 'TRANSLATION'
  | 'WRITING'
  | 'CODING'
  | 'DEBUGGING'
  | 'PLANNING'
  | 'RESEARCH'
  | 'PAGE_ANALYSIS'
  | 'ELEMENT_FINDING'
  | 'NAVIGATION'
  | 'FORM_HELP'
  | 'PROBLEM_SOLVING'
  | 'COMPARISON'
  | 'DECISION_SUPPORT'
  | 'CASUAL_CONVERSATION'
  | 'UNKNOWN';

export type ExplanationDepth =
  | 'QUICK'
  | 'NORMAL'
  | 'DEEP'
  | 'STEP_BY_STEP'
  | 'ELI5'
  | 'TECHNICAL';

export type SkillId =
  | 'general-knowledge'
  | 'tutor'
  | 'webpage-analyzer'
  | 'visual-guide'
  | 'writer'
  | 'translator'
  | 'summarizer'
  | 'coding-assistant'
  | 'problem-solver'
  | 'planner'
  | 'research-assistant'
  | 'document-assistant'
  | 'form-assistant'
  | 'browser-navigation'
  | 'decision-support';

export interface ElementPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PageElement {
  id: string; // e.g. "element_1", "element_23"
  tag: string;
  text: string;
  role: string;
  type?: string;
  inputType?: string;
  placeholder?: string;
  ariaLabel?: string;
  label?: string;
  name?: string;
  valuePresent?: boolean;
  href?: string;
  visible: boolean;
  disabled?: boolean;
  isSensitive?: boolean;
  selector: string;
  position: ElementPosition;
}

export interface PageButtonSummary {
  id: string;
  text: string;
  ariaLabel?: string;
}

export interface PageLinkSummary {
  id: string;
  text: string;
  href?: string;
}

export interface PageInputSummary {
  id: string;
  label?: string;
  placeholder?: string;
  type?: string;
  name?: string;
  valuePresent?: boolean;
}

export interface PageFormSummary {
  id: string;
  name?: string;
  action?: string;
  fieldCount: number;
}

export interface PageImageSummary {
  alt: string;
  src?: string;
}

export interface PageContext {
  pageTitle: string;
  url: string;
  headings: string[];
  buttons?: PageButtonSummary[];
  links?: PageLinkSummary[];
  inputs?: PageInputSummary[];
  forms?: PageFormSummary[];
  images?: PageImageSummary[];
  visibleText?: string;
  summaryText: string;
  elements: PageElement[];
  timestamp: number;
}

export interface AIActionResponse {
  message: string;
  action: ActionType;
  targetElementId: string | null;
  requiresConfirmation: boolean;
  taskCompleted: boolean;
  estimatedTotalSteps?: number;
  currentStepNumber?: number;
  stepTitle?: string;
  suggestedInputValue?: string;
  intent?: UniversalIntentCategory;
  skillId?: SkillId;
  skillLabel?: string;
  explanationDepth?: ExplanationDepth;
  topic?: string;
  browserAgentPlan?: BrowserAgentExecutionPlan;
}

export interface PageAnalysisResponse {
  summaryDarija: string;
  pageType: string;
  keyElements: {
    id: string;
    label: string;
    purposeDarija: string;
  }[];
  suggestedTasks: {
    labelDarija: string;
    command: string;
  }[];
}

export interface VerificationResponse {
  verified: boolean;
  messageDarija: string;
  taskCompleted: boolean;
  nextAction?: AIActionResponse;
}

export interface CompletedStepRecord {
  stepNumber: number;
  instruction: string;
  elementId: string | null;
  action: ActionType;
  timestamp: number;
}

export interface TaskState {
  id: string;
  goal: string;
  currentStep: number;
  totalEstimatedSteps: number;
  status: TaskStatus;
  targetElement: string | null;
  currentInstruction: string;
  requiresConfirmation: boolean;
  actionType: ActionType;
  completedSteps: CompletedStepRecord[];
  lastUpdated: number;
  researchProgress?: ResearchProgressStage | null;
  browserAgentPlan?: BrowserAgentExecutionPlan | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
  actionResponse?: AIActionResponse;
  pageAnalysis?: PageAnalysisResponse;
  isVoice?: boolean;
  isError?: boolean;
  hasScreenshot?: boolean;
}

export interface UserSettings {
  voiceEnabled: boolean;
  autoReadResponses: boolean;
  saveHistory: boolean;
  confirmSensitiveActions: boolean;
  visionFallbackEnabled: boolean;
  speechLang: 'ar-MA' | 'fr-FR' | 'en-US';
}

export type ExtensionMessage =
  | { type: 'INSPECT_PAGE' }
  | { type: 'ANALYZE_PAGE'; payload?: { withScreenshot?: boolean } }
  | {
      type: 'HIGHLIGHT_ELEMENT';
      payload: {
        elementId: string;
        instruction: string;
        action: ActionType;
        requiresConfirmation?: boolean;
        stepNumber?: number;
      };
    }
  | { type: 'CLEAR_HIGHLIGHT' }
  | {
      type: 'EXECUTE_ACTION';
      payload: { elementId: string; action: ActionType; value?: string };
    }
  | {
      type: 'VERIFY_ACTION';
      payload: { elementId: string | null; expectedAction: ActionType };
    }
  | {
      type: 'USER_ACTION_DETECTED';
      payload: {
        elementId: string;
        interactionType: 'click' | 'input' | 'change' | 'submit';
        valuePresent?: boolean;
        description: string;
      };
    }
  | { type: 'PAGE_MUTATED'; payload: { url: string; title: string } }
  | { type: 'CAPTURE_SCREENSHOT' }
  | { type: 'OPEN_SIDE_PANEL'; payload?: { goal?: string; analyze?: boolean } }
  | {
      type: 'TOGGLE_M3AK_ASSISTANT';
      payload?: { initialGoal?: string; analyze?: boolean };
    }
  | {
      type: 'SHOW_M3AK_ASSISTANT';
      payload?: { initialGoal?: string; analyze?: boolean };
    }
  | { type: 'HIDE_M3AK_ASSISTANT' }
  | {
      type: 'AI_API_REQUEST';
      payload: { endpoint: string; body: Record<string, unknown> };
    }
  | {
      type: 'BROWSER_AGENT_ACTION';
      payload: {
        browserAction: BrowserAgentActionType;
        url?: string;
        query?: string;
        tabId?: number;
      };
    };

export interface ExtensionMessageResponse {
  ok: boolean;
  error?: string;
  pageContext?: PageContext;
  screenshotDataUrl?: string;
  resolvedElementId?: string | null;
  visible?: boolean;
  minimized?: boolean;
  data?: unknown;
}
