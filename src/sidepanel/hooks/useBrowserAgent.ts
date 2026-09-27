import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AIActionResponse,
  AvatarState,
  ChatMessage,
  CompletedStepRecord,
  ExtensionMessage,
  ExtensionMessageResponse,
  MicrophoneState,
  PageContext,
  TaskState,
  TaskStatus,
  UserSettings,
} from '../../shared/types';
import {
  DEFAULT_SETTINGS,
  FRIENDLY_DARIJA_ERROR,
  INITIAL_TASK_STATE,
} from '../../shared/constants';
import { generateId } from '../../shared/utils';
import { domAnalyzer } from '../../content/dom-analyzer';
import {
  pageObserver,
  UserInteractionEvent,
} from '../../content/page-observer';
import aiService from '../../ai/ai-service';
import { conversationMemory } from '../../memory/conversation-memory';
import { intentRouter } from '../../intent-router/intent-router';
import { speechToText } from '../../voice/speech-to-text';
import { textToSpeech } from '../../voice/text-to-speech';

interface UseBrowserAgentOptions {
  webpageContainerRef: React.RefObject<HTMLDivElement | null>;
  virtualMeta: { title: string; url: string };
  onEnsureScenarioForGoal?: (goal: string) => Promise<void>;
}

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  IDLE: ['IDLE', 'UNDERSTANDING', 'SEARCHING', 'ANALYZING', 'READY'],
  UNDERSTANDING: [
    'UNDERSTANDING',
    'SEARCHING',
    'ANALYZING',
    'READY',
    'GUIDING',
    'WAITING_FOR_USER',
    'COMPLETED',
    'BLOCKED',
    'ERROR',
    'IDLE',
  ],
  SEARCHING: [
    'SEARCHING',
    'ANALYZING',
    'READY',
    'GUIDING',
    'WAITING_FOR_USER',
    'COMPLETED',
    'BLOCKED',
    'ERROR',
    'IDLE',
  ],
  ANALYZING: [
    'ANALYZING',
    'READY',
    'GUIDING',
    'WAITING_FOR_USER',
    'COMPLETED',
    'BLOCKED',
    'ERROR',
    'IDLE',
  ],
  READY: [
    'READY',
    'UNDERSTANDING',
    'SEARCHING',
    'ANALYZING',
    'GUIDING',
    'WAITING_FOR_USER',
    'COMPLETED',
    'BLOCKED',
    'ERROR',
    'IDLE',
  ],
  GUIDING: [
    'GUIDING',
    'SEARCHING',
    'ANALYZING',
    'READY',
    'WAITING_FOR_USER',
    'COMPLETED',
    'BLOCKED',
    'ERROR',
    'IDLE',
  ],
  WAITING_FOR_USER: [
    'WAITING_FOR_USER',
    'VERIFYING',
    'UNDERSTANDING',
    'SEARCHING',
    'ANALYZING',
    'READY',
    'GUIDING',
    'BLOCKED',
    'ERROR',
    'IDLE',
  ],
  VERIFYING: [
    'VERIFYING',
    'NEXT_STEP',
    'WAITING_FOR_USER',
    'COMPLETED',
    'BLOCKED',
    'ERROR',
    'IDLE',
  ],
  NEXT_STEP: [
    'NEXT_STEP',
    'GUIDING',
    'WAITING_FOR_USER',
    'COMPLETED',
    'BLOCKED',
    'ERROR',
    'IDLE',
  ],
  COMPLETED: [
    'COMPLETED',
    'READY',
    'IDLE',
    'UNDERSTANDING',
    'SEARCHING',
    'ANALYZING',
  ],
  BLOCKED: [
    'BLOCKED',
    'UNDERSTANDING',
    'SEARCHING',
    'ANALYZING',
    'READY',
    'GUIDING',
    'WAITING_FOR_USER',
    'ERROR',
    'IDLE',
  ],
  ERROR: [
    'ERROR',
    'UNDERSTANDING',
    'SEARCHING',
    'ANALYZING',
    'READY',
    'GUIDING',
    'WAITING_FOR_USER',
    'BLOCKED',
    'IDLE',
  ],
};

function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? true;
}

export function useBrowserAgent({
  webpageContainerRef,
  virtualMeta,
  onEnsureScenarioForGoal,
}: UseBrowserAgentOptions) {
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('m3ak_settings');
      return saved
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome_msg',
      sender: 'ai',
      text: 'وعليكم السلام، أنا معاك. قول "Salam Jarvis" أو سولني مباشرة بصوتك على هاد الصفحة.',
      timestamp: Date.now(),
    },
  ]);

  const [taskState, setTaskState] = useState<TaskState>(INITIAL_TASK_STATE);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [micState, setMicState] = useState<MicrophoneState>('Idle');
  const [wakeStandbyActive, setWakeStandbyActive] = useState<boolean>(true);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [micPermissionDenied, setMicPermissionDenied] =
    useState<boolean>(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const taskStateRef = useRef<TaskState>(taskState);
  taskStateRef.current = taskState;

  const settingsRef = useRef<UserSettings>(settings);
  settingsRef.current = settings;

  const virtualMetaRef = useRef(virtualMeta);
  virtualMetaRef.current = virtualMeta;

  const isBusyRef = useRef(false);
  const isVerifyingRef = useRef(false);

  const transitionTaskState = useCallback(
    (updater: (prev: TaskState) => TaskState) => {
      setTaskState((prev) => {
        const next = updater(prev);
        if (!canTransition(prev.status, next.status)) {
          console.warn(
            `[M3ak StateMachine] Prevented invalid transition: ${prev.status} -> ${next.status}`
          );
          return prev;
        }
        return next;
      });
    },
    []
  );

  const updateSettings = useCallback((partial: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('m3ak_settings', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  }, []);

  /**
   * Inspects the active webpage (either the embedded Sandbox container or active Chrome Tab via Content Script)
   */
  const inspectCurrentWebpage = useCallback((): PageContext => {
    const ctx = domAnalyzer.inspectPage(
      webpageContainerRef.current,
      virtualMetaRef.current
    );
    setPageContext(ctx);
    return ctx;
  }, [webpageContainerRef]);

  /**
   * Sends highlight command to Content Script if running inside Chrome Extension runtime
   */
  const notifyExtensionContentScript = useCallback(
    (msg: ExtensionMessage) => {
      const chromeGlobal = (globalThis as Record<string, any>).chrome;
      if (chromeGlobal?.runtime?.sendMessage && !webpageContainerRef.current) {
        try {
          chromeGlobal.runtime.sendMessage(msg, () => {
            void chromeGlobal.runtime?.lastError;
          });
        } catch {
          // ignore if not in extension tab context
        }
      }
    },
    [webpageContainerRef]
  );

  const speakIfEnabled = useCallback(
    (text: string, listenAfter = false) => {
      if (!settingsRef.current.voiceEnabled) {
        return;
      }
      speechToText.pauseForSpeechOutput();
      textToSpeech.speak(text, {
        onStart: () => {
          setAvatarState('speaking');
          setMicState('Speaking');
        },
        onEnd: () => {
          setAvatarState(
            taskStateRef.current.status === 'WAITING_FOR_USER'
              ? 'waiting'
              : 'idle'
          );
          setMicState('Idle');
          speechToText.resumeAfterSpeechOutput(listenAfter);
        },
      });
    },
    []
  );

  const speakMessageManually = useCallback((text: string) => {
    speechToText.pauseForSpeechOutput();
    textToSpeech.speak(text, {
      onStart: () => {
        setAvatarState('speaking');
        setMicState('Speaking');
      },
      onEnd: () => {
        setAvatarState(
          taskStateRef.current.status === 'WAITING_FOR_USER'
            ? 'waiting'
            : 'idle'
        );
        setMicState('Idle');
        speechToText.resumeAfterSpeechOutput(false);
      },
    });
  }, []);

  const handleStopSpeaking = useCallback(() => {
    textToSpeech.stop();
    setMicState('Idle');
    setAvatarState(
      taskStateRef.current.status === 'WAITING_FOR_USER' ? 'waiting' : 'idle'
    );
    speechToText.resumeAfterSpeechOutput(false);
  }, []);

  /**
   * Captures a compact visual snapshot data URL (Vision Mode) when requested.
   * Uses compressed JPEG (0.75 quality) to avoid memory spikes or oversized payloads.
   */
  const captureScreenshotDataUrl = useCallback(async (): Promise<
    string | undefined
  > => {
    if (!settingsRef.current.visionFallbackEnabled) {
      return undefined;
    }

    // 1. Try Chrome Extension visible tab capture if available
    const chromeGlobal = (globalThis as Record<string, any>).chrome;
    if (chromeGlobal?.runtime?.sendMessage && !webpageContainerRef.current) {
      try {
        const res = await new Promise<ExtensionMessageResponse>((resolve) => {
          chromeGlobal.runtime.sendMessage(
            { type: 'CAPTURE_SCREENSHOT' } satisfies ExtensionMessage,
            (response: ExtensionMessageResponse) => {
              if (chromeGlobal.runtime.lastError) {
                resolve({ ok: false });
              } else {
                resolve(response || { ok: false });
              }
            }
          );
        });
        if (res.ok && res.screenshotDataUrl) {
          return res.screenshotDataUrl;
        }
      } catch {
        // Fallback to local canvas snapshot
      }
    }

    // 2. Render compact canvas snapshot of current viewport structure
    try {
      const container = webpageContainerRef.current;
      if (!container) return undefined;
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 340;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(virtualMetaRef.current.title.slice(0, 55), 18, 28);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText(virtualMetaRef.current.url.slice(0, 65), 18, 46);

      const inspected = domAnalyzer.inspectPage(
        container,
        virtualMetaRef.current
      );
      inspected.elements.slice(0, 11).forEach((el, idx) => {
        const y = 70 + idx * 22;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(18, y - 13, 564, 18);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px sans-serif';
        ctx.fillText(
          `[${el.id}] <${el.tag}> ${(el.label || el.text || el.placeholder || el.role).slice(0, 50)}`,
          24,
          y - 1
        );
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      canvas.width = 0;
      canvas.height = 0;
      return dataUrl;
    } catch {
      return undefined;
    }
  }, [webpageContainerRef]);

  /**
   * Analyze the current page and explain it in Moroccan Darija
   */
  const handleAnalyzePage = useCallback(
    async (withScreenshot = false) => {
      if (isBusyRef.current) return;
      isBusyRef.current = true;
      setIsAnalyzing(true);
      setAvatarState('thinking');
      transitionTaskState((prev) => ({ ...prev, status: 'UNDERSTANDING' }));

      const userMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'user',
        text: withScreenshot
          ? '📸 حلل هاد الصفحة بالصورة (Vision Mode)'
          : '🔍 حلل ليا هاد الصفحة (Analyze this page)',
        timestamp: Date.now(),
        hasScreenshot: withScreenshot,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const ctx = inspectCurrentWebpage();
        const screenshotUrl = withScreenshot
          ? await captureScreenshotDataUrl()
          : undefined;
        const analysis = await aiService.analyzePage(ctx, screenshotUrl);

        const aiMsg: ChatMessage = {
          id: generateId('msg'),
          sender: 'ai',
          text: analysis.summaryDarija,
          timestamp: Date.now(),
          pageAnalysis: analysis,
        };

        setMessages((prev) => [...prev, aiMsg]);
        setAvatarState('idle');
        transitionTaskState((prev) => ({ ...prev, status: 'IDLE' }));
        speakIfEnabled(analysis.summaryDarija);
      } catch (err) {
        console.error('[M3ak Analyze Page Error]:', err);
        setAvatarState('error');
        transitionTaskState((prev) => ({ ...prev, status: 'ERROR' }));
        setMessages((prev) => [
          ...prev,
          {
            id: generateId('msg'),
            sender: 'ai',
            text: FRIENDLY_DARIJA_ERROR,
            timestamp: Date.now(),
            isError: true,
          },
        ]);
      } finally {
        isBusyRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [
      inspectCurrentWebpage,
      captureScreenshotDataUrl,
      speakIfEnabled,
      transitionTaskState,
    ]
  );

  /**
   * Apply AI Action Response to the Task State Machine & Highlight Overlay
   */
  const applyStepAction = useCallback(
    (
      goal: string,
      stepNumber: number,
      actionRes: AIActionResponse,
      completedSteps: CompletedStepRecord[]
    ) => {
      if (actionRes.taskCompleted && !actionRes.targetElementId) {
        transitionTaskState(() => ({
          id: generateId('task'),
          goal,
          currentStep: stepNumber,
          totalEstimatedSteps: stepNumber,
          status: actionRes.browserAgentPlan ? 'READY' : 'COMPLETED',
          targetElement: null,
          currentInstruction: actionRes.message,
          requiresConfirmation: actionRes.requiresConfirmation,
          actionType: 'none',
          completedSteps,
          lastUpdated: Date.now(),
          researchProgress: actionRes.browserAgentPlan ? 'READY' : null,
          browserAgentPlan: actionRes.browserAgentPlan || null,
        }));
        setAvatarState('success');
        notifyExtensionContentScript({ type: 'CLEAR_HIGHLIGHT' });
      } else {
        // Verify that targetElementId can actually be resolved on the page
        const resolvedEl = actionRes.targetElementId
          ? domAnalyzer.resolveElement(
              actionRes.targetElementId,
              webpageContainerRef.current
            )
          : null;

        if (actionRes.targetElementId && !resolvedEl) {
          transitionTaskState(() => ({
            id: generateId('task'),
            goal,
            currentStep: stepNumber,
            totalEstimatedSteps:
              actionRes.estimatedTotalSteps || Math.max(stepNumber + 1, 3),
            status: 'BLOCKED',
            targetElement: null,
            currentInstruction:
              'ما لقيتش هاد العنصر فهاد الصفحة دابا 😅 جرب نعاود نحلل الصفحة.',
            requiresConfirmation: false,
            actionType: 'none',
            completedSteps,
            lastUpdated: Date.now(),
          }));
          setAvatarState('error');
          setMessages((prev) => [
            ...prev,
            {
              id: generateId('msg'),
              sender: 'ai',
              text: 'ما لقيتش هاد العنصر فهاد الصفحة دابا 😅 جرب تضغط على "عاود المحاولة" باش نعاود نحلل الصفحة.',
              timestamp: Date.now(),
              isError: true,
            },
          ]);
          return;
        }

        const needsConfirm =
          settingsRef.current.confirmSensitiveActions &&
          actionRes.requiresConfirmation;

        transitionTaskState(() => ({
          id: generateId('task'),
          goal,
          currentStep: actionRes.currentStepNumber || stepNumber,
          totalEstimatedSteps:
            actionRes.estimatedTotalSteps || Math.max(stepNumber + 1, 3),
          status: actionRes.taskCompleted ? 'COMPLETED' : 'WAITING_FOR_USER',
          targetElement: actionRes.targetElementId,
          currentInstruction: actionRes.message,
          requiresConfirmation: needsConfirm,
          actionType: actionRes.action,
          completedSteps,
          lastUpdated: Date.now(),
        }));
        setAvatarState(actionRes.taskCompleted ? 'success' : 'waiting');

        if (actionRes.targetElementId) {
          notifyExtensionContentScript({
            type: 'HIGHLIGHT_ELEMENT',
            payload: {
              elementId: actionRes.targetElementId,
              instruction: actionRes.message,
              action: actionRes.action,
              requiresConfirmation: needsConfirm,
              stepNumber: actionRes.currentStepNumber || stepNumber,
            },
          });
        }
      }

      const aiMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'ai',
        text: actionRes.message,
        timestamp: Date.now(),
        actionResponse: actionRes,
      };
      setMessages((prev) => [...prev, aiMsg]);
      speakIfEnabled(actionRes.message);
    },
    [
      webpageContainerRef,
      notifyExtensionContentScript,
      speakIfEnabled,
      transitionTaskState,
    ]
  );

  /**
   * Start or update a user goal ("bghit ndir compte hna", "bghit n9leb 3la login", etc.)
   */
  const handleStartTask = useCallback(
    async (
      userInput: string,
      options?: { isVoice?: boolean; withScreenshot?: boolean }
    ) => {
      const trimmed = userInput.trim();
      if (!trimmed || isBusyRef.current) return;

      isBusyRef.current = true;
      const userMsg: ChatMessage = {
        id: generateId('msg'),
        sender: 'user',
        text: trimmed,
        timestamp: Date.now(),
        isVoice: options?.isVoice,
        hasScreenshot: options?.withScreenshot,
      };
      setMessages((prev) => [...prev, userMsg]);

      setIsAnalyzing(true);
      setAvatarState('thinking');

      const routedPreview = intentRouter.route(
        trimmed,
        conversationMemory.getSnapshot(),
        false
      );
      const isResearchOrBrowserTask =
        routedPreview.intent === 'RESEARCH' ||
        (routedPreview.intent === 'NAVIGATION' &&
          routedPreview.contextRequirement === 'none');

      transitionTaskState(() => ({
        id: generateId('task'),
        goal: trimmed,
        currentStep: 1,
        totalEstimatedSteps: isResearchOrBrowserTask ? 4 : 3,
        status: 'UNDERSTANDING',
        targetElement: null,
        currentInstruction: isResearchOrBrowserTask
          ? 'كنفهم الطلب وكنحضر خطة البحث...'
          : 'شوية صبر، كنشوف الصفحة...',
        requiresConfirmation: false,
        actionType: 'none',
        completedSteps: [],
        lastUpdated: Date.now(),
        researchProgress: isResearchOrBrowserTask ? 'UNDERSTANDING' : null,
        browserAgentPlan: null,
      }));

      try {
        // Ensure the sandbox switches to the appropriate webpage if the user asked for a specific test scenario
        if (onEnsureScenarioForGoal) {
          await onEnsureScenarioForGoal(trimmed);
        }

        if (isResearchOrBrowserTask) {
          transitionTaskState((prev) => ({
            ...prev,
            status: 'SEARCHING',
            currentInstruction: 'كنقلب فـ الويب والمصادر الموثوقة...',
            researchProgress: 'SEARCHING',
          }));
          await new Promise((r) => setTimeout(r, 180));
        }

        const ctx = inspectCurrentWebpage();

        if (isResearchOrBrowserTask) {
          transitionTaskState((prev) => ({
            ...prev,
            status: 'ANALYZING',
            currentInstruction: 'كنفحص الصفحات وكنقارن المعلومات...',
            researchProgress: 'ANALYZING',
          }));
          await new Promise((r) => setTimeout(r, 180));
        } else {
          transitionTaskState((prev) => ({ ...prev, status: 'GUIDING' }));
        }

        const screenshotDataUrl = options?.withScreenshot
          ? await captureScreenshotDataUrl()
          : undefined;

        const actionRes = await aiService.getNextAction({
          userGoal: trimmed,
          pageContext: ctx,
          currentStep: 1,
          completedSteps: [],
          screenshotDataUrl,
        });

        applyStepAction(trimmed, 1, actionRes, []);
      } catch (err) {
        console.error('[M3ak Start Task Error]:', err);
        setAvatarState('error');
        transitionTaskState((prev) => ({
          ...prev,
          status: 'ERROR',
          currentInstruction: FRIENDLY_DARIJA_ERROR,
        }));
        setMessages((prev) => [
          ...prev,
          {
            id: generateId('msg'),
            sender: 'ai',
            text: FRIENDLY_DARIJA_ERROR,
            timestamp: Date.now(),
            isError: true,
          },
        ]);
      } finally {
        isBusyRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [
      onEnsureScenarioForGoal,
      inspectCurrentWebpage,
      captureScreenshotDataUrl,
      applyStepAction,
      transitionTaskState,
    ]
  );

  /**
   * Verify user interaction on the page and advance the Step-by-Step Agent Loop
   */
  const handleVerifyAndAdvance = useCallback(
    async (interactionEvent: UserInteractionEvent) => {
      const currentTask = taskStateRef.current;
      if (
        currentTask.status !== 'WAITING_FOR_USER' ||
        isVerifyingRef.current ||
        isBusyRef.current ||
        !currentTask.goal
      ) {
        return;
      }

      // Only verify when the user interacts with the highlighted target element
      if (
        currentTask.targetElement &&
        interactionEvent.elementId !== currentTask.targetElement
      ) {
        return;
      }

      isVerifyingRef.current = true;
      setAvatarState('thinking');
      transitionTaskState((prev) => ({
        ...prev,
        status: 'VERIFYING',
        targetElement: null,
        requiresConfirmation: false,
      }));
      notifyExtensionContentScript({ type: 'CLEAR_HIGHLIGHT' });

      // Wait briefly for the webpage DOM to settle after click/input
      await new Promise((r) => setTimeout(r, 240));

      try {
        const updatedCtx = inspectCurrentWebpage();
        const newCompletedRecord: CompletedStepRecord = {
          stepNumber: currentTask.currentStep,
          instruction: currentTask.currentInstruction,
          elementId: currentTask.targetElement,
          action: currentTask.actionType,
          timestamp: Date.now(),
        };
        const updatedCompletedSteps = [
          ...currentTask.completedSteps,
          newCompletedRecord,
        ];
        const nextStepNumber = currentTask.currentStep + 1;

        transitionTaskState((prev) => ({
          ...prev,
          status: 'NEXT_STEP',
          completedSteps: updatedCompletedSteps,
        }));

        const verification = await aiService.verifyAction({
          userGoal: currentTask.goal,
          previousInstruction: currentTask.currentInstruction,
          previousTargetId: currentTask.targetElement,
          interactionDescription: interactionEvent.description,
          updatedPageContext: updatedCtx,
          currentStep: currentTask.currentStep,
          completedSteps: updatedCompletedSteps,
        });

        transitionTaskState((prev) => ({
          ...prev,
          status: 'GUIDING',
        }));

        if (
          verification.taskCompleted ||
          verification.nextAction?.taskCompleted
        ) {
          const finalMsg =
            verification.nextAction?.message ||
            verification.messageDarija ||
            'مزيان بزاف 🎉 سالينا المهمة بنجاح!';
          applyStepAction(
            currentTask.goal,
            nextStepNumber,
            {
              message: finalMsg,
              action: 'none',
              targetElementId: null,
              requiresConfirmation: false,
              taskCompleted: true,
            },
            updatedCompletedSteps
          );
        } else if (verification.nextAction) {
          applyStepAction(
            currentTask.goal,
            nextStepNumber,
            verification.nextAction,
            updatedCompletedSteps
          );
        }
      } catch (err) {
        console.error('[M3ak Verify Action Error]:', err);
        setAvatarState('error');
        transitionTaskState((prev) => ({
          ...prev,
          status: 'ERROR',
          currentInstruction: FRIENDLY_DARIJA_ERROR,
        }));
      } finally {
        isVerifyingRef.current = false;
      }
    },
    [
      inspectCurrentWebpage,
      applyStepAction,
      notifyExtensionContentScript,
      transitionTaskState,
    ]
  );

  /**
   * Retry current task from ERROR or BLOCKED state without corrupting state
   */
  const handleRetryTask = useCallback(async () => {
    const currentTask = taskStateRef.current;
    if (!currentTask.goal || isBusyRef.current) return;

    isBusyRef.current = true;
    setIsAnalyzing(true);
    setAvatarState('thinking');
    transitionTaskState((prev) => ({
      ...prev,
      status: 'UNDERSTANDING',
      currentInstruction: 'كنعاود نحلل الصفحة...',
    }));

    try {
      const ctx = inspectCurrentWebpage();
      transitionTaskState((prev) => ({ ...prev, status: 'GUIDING' }));

      const actionRes = await aiService.getNextAction({
        userGoal: currentTask.goal,
        pageContext: ctx,
        currentStep: Math.max(1, currentTask.currentStep),
        completedSteps: currentTask.completedSteps,
      });

      applyStepAction(
        currentTask.goal,
        Math.max(1, currentTask.currentStep),
        actionRes,
        currentTask.completedSteps
      );
    } catch (err) {
      console.error('[M3ak Retry Task Error]:', err);
      setAvatarState('error');
      transitionTaskState((prev) => ({
        ...prev,
        status: 'ERROR',
        currentInstruction: FRIENDLY_DARIJA_ERROR,
      }));
    } finally {
      isBusyRef.current = false;
      setIsAnalyzing(false);
    }
  }, [inspectCurrentWebpage, applyStepAction, transitionTaskState]);

  /**
   * Sensitive Action Confirmation Handler ("Yes, continue" vs "I'll do it")
   */
  const handleConfirmSensitiveAction = useCallback(
    (executeAutomatically: boolean) => {
      const currentTask = taskStateRef.current;
      if (!currentTask.targetElement) return;

      if (!executeAutomatically) {
        // User chose "I'll do it" — keep highlight active and remove confirmation gate
        transitionTaskState((prev) => ({
          ...prev,
          requiresConfirmation: false,
        }));
        setMessages((prev) => [
          ...prev,
          {
            id: generateId('msg'),
            sender: 'ai',
            text: 'واخا 👌 أنا خليت ليك الزر مضوي، كليكي عليه بيدك ملي تكون واجد.',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // User clicked "Yes, continue" — trigger click on the target DOM element
      const el = domAnalyzer.resolveElement(
        currentTask.targetElement,
        webpageContainerRef.current
      );
      if (el) {
        transitionTaskState((prev) => ({
          ...prev,
          requiresConfirmation: false,
        }));
        el.click();
      } else {
        notifyExtensionContentScript({
          type: 'EXECUTE_ACTION',
          payload: {
            elementId: currentTask.targetElement,
            action: 'click',
          },
        });
      }
    },
    [webpageContainerRef, notifyExtensionContentScript, transitionTaskState]
  );

  /**
   * Cancel / Reset Current Task
   */
  const handleStopTask = useCallback(() => {
    setTaskState(INITIAL_TASK_STATE);
    setAvatarState('idle');
    notifyExtensionContentScript({ type: 'CLEAR_HIGHLIGHT' });
  }, [notifyExtensionContentScript]);

  const createSttCallbacks = useCallback(
    () => ({
      onStateChange: (newState: MicrophoneState) => {
        setMicState(newState);
        if (newState === 'Listening') {
          setAvatarState('waiting');
        } else if (newState === 'Processing') {
          setAvatarState('thinking');
        } else if (newState === 'Idle' && !textToSpeech.getIsSpeaking()) {
          setAvatarState(
            taskStateRef.current.status === 'WAITING_FOR_USER'
              ? 'waiting'
              : 'idle'
          );
        }
      },
      onResult: (transcript: string, isFinal: boolean) => {
        setLiveTranscript(transcript);
        if (isFinal && transcript.trim()) {
          setLiveTranscript('');
          setMicState('Idle');
          void handleStartTask(transcript.trim(), { isVoice: true });
        }
      },
      onWakeWordDetected: (commandRemainder: string) => {
        setLiveTranscript('');
        if (commandRemainder.trim()) {
          void handleStartTask(commandRemainder.trim(), { isVoice: true });
        } else {
          const greeting = 'وعليكم السلام، أنا معاك. شنو بغيتي ندير ليك؟';
          setMessages((prev) => [
            ...prev,
            {
              id: generateId('msg'),
              sender: 'ai',
              text: greeting,
              timestamp: Date.now(),
            },
          ]);
          speakIfEnabled(greeting, true);
        }
      },
      onError: (friendlyError: string, permissionDenied?: boolean) => {
        setMicState('Idle');
        setLiveTranscript('');
        if (permissionDenied) {
          setMicPermissionDenied(true);
          setWakeStandbyActive(false);
        }
        setAvatarState('error');
        setMessages((prev) => [
          ...prev,
          {
            id: generateId('msg'),
            sender: 'ai',
            text: friendlyError,
            timestamp: Date.now(),
            isError: true,
          },
        ]);
      },
    }),
    [handleStartTask, speakIfEnabled]
  );

  /**
   * Voice Microphone Toggle
   */
  const handleToggleVoice = useCallback(() => {
    if (micState === 'Speaking' || textToSpeech.getIsSpeaking()) {
      handleStopSpeaking();
      return;
    }

    if (micState === 'Listening') {
      speechToText.stopListening();
      setMicState('Idle');
      setLiveTranscript('');
      setAvatarState('idle');
      if (wakeStandbyActive && !micPermissionDenied) {
        speechToText.enableWakeWordStandby(
          settings.speechLang,
          createSttCallbacks()
        );
      }
      return;
    }

    setMicPermissionDenied(false);
    setAvatarState('waiting');
    speechToText.startListening(settings.speechLang, createSttCallbacks());
  }, [
    micState,
    settings.speechLang,
    wakeStandbyActive,
    micPermissionDenied,
    handleStopSpeaking,
    createSttCallbacks,
  ]);

  const handleToggleWakeStandby = useCallback(() => {
    setWakeStandbyActive((prev) => {
      const next = !prev;
      if (next) {
        setMicPermissionDenied(false);
        speechToText.enableWakeWordStandby(
          settings.speechLang,
          createSttCallbacks()
        );
      } else {
        speechToText.disableWakeWordStandby();
        setMicState('Idle');
        setLiveTranscript('');
      }
      return next;
    });
  }, [settings.speechLang, createSttCallbacks]);

  // Keep continuous wake-word standby ("Salam Jarvis") active when enabled
  useEffect(() => {
    if (wakeStandbyActive && settings.voiceEnabled && !micPermissionDenied) {
      speechToText.enableWakeWordStandby(
        settings.speechLang,
        createSttCallbacks()
      );
    } else if (!wakeStandbyActive) {
      speechToText.disableWakeWordStandby();
    }
  }, [
    wakeStandbyActive,
    settings.voiceEnabled,
    settings.speechLang,
    micPermissionDenied,
    createSttCallbacks,
  ]);

  const handleClearHistory = useCallback(() => {
    conversationMemory.clear();
    setMessages([
      {
        id: generateId('welcome'),
        sender: 'ai',
        text: 'مسحنا المحادثة 🧹 قول "Salam Jarvis" أو سولني شنو بغيتي نديرو دابا فهاد الصفحة!',
        timestamp: Date.now(),
      },
    ]);
    setTaskState(INITIAL_TASK_STATE);
    setAvatarState('idle');
    notifyExtensionContentScript({ type: 'CLEAR_HIGHLIGHT' });
  }, [notifyExtensionContentScript]);

  // Attach PageObserver to the live webpage container and clean up on unmount
  useEffect(() => {
    const container = webpageContainerRef.current;
    if (!container) return;

    inspectCurrentWebpage();

    pageObserver.attach(container, {
      onUserInteraction: (ev) => {
        handleVerifyAndAdvance(ev);
      },
      onDomMutated: () => {
        inspectCurrentWebpage();
      },
    });

    return () => {
      pageObserver.detach();
    };
  }, [webpageContainerRef, inspectCurrentWebpage, handleVerifyAndAdvance]);

  // Clean up speech recognition & speech synthesis on unmount
  useEffect(() => {
    return () => {
      speechToText.disableWakeWordStandby();
      textToSpeech.stop();
    };
  }, []);

  return {
    settings,
    updateSettings,
    messages,
    taskState,
    avatarState,
    micState,
    wakeStandbyActive,
    liveTranscript,
    micPermissionDenied,
    pageContext,
    isAnalyzing,
    inspectCurrentWebpage,
    handleAnalyzePage,
    handleStartTask,
    handleRetryTask,
    handleConfirmSensitiveAction,
    handleStopTask,
    handleToggleVoice,
    handleToggleWakeStandby,
    handleStopSpeaking,
    handleClearHistory,
    speakMessageManually,
  };
}
