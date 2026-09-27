import {
  ActionType,
  AIActionResponse,
  PageAnalysisResponse,
  VerificationResponse,
} from '../shared/types';

const VALID_ACTIONS: ActionType[] = [
  'click',
  'focus',
  'type',
  'input',
  'select',
  'scroll',
  'none',
];

/**
 * Strictly validates AI action responses.
 * Rejects malformed or inconsistent AI outputs so the caller can invoke
 * deterministic DOM-grounded fallback behavior safely.
 */
export function validateAIActionResponse(raw: unknown): AIActionResponse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid AI response: expected a JSON object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.message !== 'string' || obj.message.trim().length === 0) {
    throw new Error('Invalid AI response: missing or empty "message" string');
  }
  const message = obj.message.trim();

  if (typeof obj.action !== 'string') {
    throw new Error('Invalid AI response: missing "action" string');
  }
  const rawAction = obj.action.trim().toLowerCase() as ActionType;
  if (!VALID_ACTIONS.includes(rawAction)) {
    throw new Error(`Invalid AI response: unsupported action "${obj.action}"`);
  }

  const taskCompleted = Boolean(obj.taskCompleted);
  const requiresConfirmation = Boolean(obj.requiresConfirmation);

  const rawTarget = obj.targetElementId;
  const targetElementId =
    typeof rawTarget === 'string' &&
    rawTarget.trim().length > 0 &&
    rawTarget.trim().toLowerCase() !== 'null' &&
    rawTarget.trim().toLowerCase() !== 'none'
      ? rawTarget.trim()
      : null;

  // Preserve targetElementId if provided so single-step element finding / button explanation can still highlight the element
  const normalizedTarget: string | null = targetElementId;
  const normalizedAction: ActionType =
    taskCompleted && !normalizedTarget ? 'none' : rawAction;

  // If the AI specifies an element-targeted action (click, focus, type, input, select)
  // while task is not completed, targetElementId must be present and match element_N pattern
  if (
    !taskCompleted &&
    normalizedAction !== 'none' &&
    normalizedAction !== 'scroll' &&
    !normalizedTarget
  ) {
    throw new Error(
      `Invalid AI response: action "${normalizedAction}" requires a non-null targetElementId`
    );
  }

  const estimatedTotalSteps =
    typeof obj.estimatedTotalSteps === 'number' &&
    Number.isFinite(obj.estimatedTotalSteps) &&
    obj.estimatedTotalSteps > 0
      ? Math.min(12, Math.max(1, Math.round(obj.estimatedTotalSteps)))
      : undefined;

  const currentStepNumber =
    typeof obj.currentStepNumber === 'number' &&
    Number.isFinite(obj.currentStepNumber) &&
    obj.currentStepNumber > 0
      ? Math.round(obj.currentStepNumber)
      : undefined;

  const stepTitle =
    typeof obj.stepTitle === 'string' && obj.stepTitle.trim().length > 0
      ? obj.stepTitle.trim()
      : undefined;

  const suggestedInputValue =
    typeof obj.suggestedInputValue === 'string'
      ? obj.suggestedInputValue
      : undefined;

  const intent =
    typeof obj.intent === 'string' && obj.intent.trim().length > 0
      ? (obj.intent.trim() as AIActionResponse['intent'])
      : undefined;

  const skillId =
    typeof obj.skillId === 'string' && obj.skillId.trim().length > 0
      ? (obj.skillId.trim() as AIActionResponse['skillId'])
      : undefined;

  const skillLabel =
    typeof obj.skillLabel === 'string' && obj.skillLabel.trim().length > 0
      ? obj.skillLabel.trim()
      : undefined;

  const explanationDepth =
    typeof obj.explanationDepth === 'string' &&
    obj.explanationDepth.trim().length > 0
      ? (obj.explanationDepth.trim() as AIActionResponse['explanationDepth'])
      : undefined;

  const topic =
    typeof obj.topic === 'string' && obj.topic.trim().length > 0
      ? obj.topic.trim()
      : undefined;

  const browserAgentPlan =
    obj.browserAgentPlan &&
    typeof obj.browserAgentPlan === 'object' &&
    !Array.isArray(obj.browserAgentPlan)
      ? (obj.browserAgentPlan as AIActionResponse['browserAgentPlan'])
      : undefined;

  return {
    message,
    action: normalizedAction,
    targetElementId: normalizedTarget,
    requiresConfirmation,
    taskCompleted,
    estimatedTotalSteps,
    currentStepNumber,
    stepTitle,
    suggestedInputValue,
    intent,
    skillId,
    skillLabel,
    explanationDepth,
    topic,
    browserAgentPlan,
  };
}

export function validatePageAnalysisResponse(
  raw: unknown
): PageAnalysisResponse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid Page Analysis JSON: expected object');
  }
  const obj = raw as Record<string, unknown>;

  if (
    typeof obj.summaryDarija !== 'string' ||
    obj.summaryDarija.trim().length === 0
  ) {
    throw new Error('Invalid Page Analysis JSON: missing summaryDarija');
  }

  const summaryDarija = obj.summaryDarija.trim();
  const pageType =
    typeof obj.pageType === 'string' && obj.pageType.trim().length > 0
      ? obj.pageType.trim()
      : 'Webpage';

  const keyElements = Array.isArray(obj.keyElements)
    ? obj.keyElements
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === 'object')
        )
        .map((item) => ({
          id: String(item.id || '').trim(),
          label: String(item.label || '').trim(),
          purposeDarija: String(item.purposeDarija || '').trim(),
        }))
        .filter((item) => item.id.length > 0)
        .slice(0, 6)
    : [];

  const suggestedTasks = Array.isArray(obj.suggestedTasks)
    ? obj.suggestedTasks
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === 'object')
        )
        .map((item) => ({
          labelDarija: String(item.labelDarija || '').trim(),
          command: String(item.command || '').trim(),
        }))
        .filter((item) => item.labelDarija.length > 0 && item.command.length > 0)
        .slice(0, 4)
    : [];

  return {
    summaryDarija,
    pageType,
    keyElements,
    suggestedTasks,
  };
}

export function validateVerificationResponse(
  raw: unknown
): VerificationResponse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid Verification JSON: expected object');
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.verified !== 'boolean') {
    throw new Error('Invalid Verification JSON: missing boolean "verified"');
  }

  const verified = obj.verified;
  const messageDarija =
    typeof obj.messageDarija === 'string' && obj.messageDarija.trim().length > 0
      ? obj.messageDarija.trim()
      : 'مزيان ✅';
  const taskCompleted = Boolean(obj.taskCompleted);

  let nextAction: AIActionResponse | undefined;
  if (obj.nextAction && typeof obj.nextAction === 'object') {
    nextAction = validateAIActionResponse(obj.nextAction);
  }

  return {
    verified,
    messageDarija,
    taskCompleted,
    nextAction,
  };
}
