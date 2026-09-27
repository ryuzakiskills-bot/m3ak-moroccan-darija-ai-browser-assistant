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
} from '../shared/types';
import {
  AI_NAME,
  AI_NAME_ARABIC,
  DARIJA_QUICK_PROMPTS,
  FRIENDLY_DARIJA_ERROR,
  INITIAL_TASK_STATE,
} from '../shared/constants';
import { formatTimeShort, generateId } from '../shared/utils';
import { domAnalyzer } from './dom-analyzer';
import { elementHighlighter } from './element-highlighter';
import { UserInteractionEvent } from './page-observer';
import aiService from '../ai/ai-service';
import { intentRouter } from '../intent-router/intent-router';
import { conversationMemory } from '../memory/conversation-memory';
import { dispatchBrowserAgentPlan } from '../browser-agent/browser-agent';
import { speechToText } from '../voice/speech-to-text';
import { textToSpeech } from '../voice/text-to-speech';

const FLOATING_HOST_ID = 'm3ak-floating-assistant-root';

export type JarvisVisualState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'ERROR';

/**
 * Voice-First JARVIS-Style Moroccan Darija AI Browser Companion (Content Script Shadow DOM UI)
 * - Injected directly into any webpage inside an isolated Shadow DOM
 * - Collapsed state: Compact, draggable, animated M3ak AI Orb (◉ M3ak + Mic indicator)
 * - Expanded state: Futuristic transparent HUD with reactive AI core, live voice transcript,
 *   spoken response display, stop-speaking control, wake-phrase standby ("Salam Jarvis"),
 *   minimal command log, and secondary keyboard fallback.
 */
export class FloatingAssistantManager {
  private hostEl: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;

  private isVisible = false;
  private isMinimized = true;
  private isAnalyzing = false;
  private isVerifying = false;

  private avatarState: AvatarState = 'idle';
  private micState: MicrophoneState = 'Idle';
  private wakeStandbyActive = true;
  private micPermissionDenied = false;
  private liveTranscript = '';

  private taskState: TaskState = { ...INITIAL_TASK_STATE };
  private pageContext: PageContext | null = null;
  private inputText = '';

  private posRight = 24;
  private posBottom = 24;
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartRight = 24;
  private dragStartBottom = 24;

  private messages: ChatMessage[] = [
    {
      id: 'welcome_inpage',
      sender: 'ai',
      text: 'وعليكم السلام، أنا معاك. قول "Salam Jarvis" أو سولني مباشرة بصوتك على هاد الصفحة.',
      timestamp: Date.now(),
    },
  ];

  private persistActiveState(active: boolean): void {
    try {
      const chromeGlobal = (globalThis as Record<string, any>).chrome;
      if (chromeGlobal?.storage?.local?.set) {
        chromeGlobal.storage.local.set({ m3ak_companion_active: active });
      }
    } catch {
      // ignore storage errors
    }
  }

  public toggle(options?: { initialGoal?: string; analyze?: boolean }): {
    visible: boolean;
    minimized: boolean;
  } {
    this.ensureMounted();

    if (options?.initialGoal || options?.analyze) {
      this.isVisible = true;
      this.isMinimized = false;
      this.inspectCurrentPage();
      this.syncWakeWordStandby();
    } else if (!this.isVisible) {
      this.isVisible = true;
      this.isMinimized = true;
      this.inspectCurrentPage();
      this.syncWakeWordStandby();
    } else if (this.isMinimized) {
      this.isMinimized = false;
      this.inspectCurrentPage();
      this.syncWakeWordStandby();
    } else {
      this.hide();
      return { visible: this.isVisible, minimized: this.isMinimized };
    }

    this.persistActiveState(this.isVisible);
    this.render();

    if (this.isVisible && !this.isMinimized) {
      if (options?.analyze) {
        void this.handleAnalyzePage(false);
      } else if (options?.initialGoal) {
        void this.handleStartTask(options.initialGoal);
      }
    }

    return { visible: this.isVisible, minimized: this.isMinimized };
  }

  public show(options?: {
    initialGoal?: string;
    analyze?: boolean;
    startAsOrb?: boolean;
  }): {
    visible: boolean;
    minimized: boolean;
  } {
    this.ensureMounted();
    this.isVisible = true;
    this.isMinimized = Boolean(
      options?.startAsOrb && !options?.initialGoal && !options?.analyze
    );
    this.persistActiveState(true);
    this.inspectCurrentPage();
    this.syncWakeWordStandby();
    this.render();

    if (!this.isMinimized) {
      if (options?.analyze) {
        void this.handleAnalyzePage(false);
      } else if (options?.initialGoal) {
        void this.handleStartTask(options.initialGoal);
      }
    }

    return { visible: this.isVisible, minimized: this.isMinimized };
  }

  public hide(): { visible: boolean; minimized: boolean } {
    this.isVisible = false;
    this.persistActiveState(false);
    textToSpeech.stop();
    speechToText.disableWakeWordStandby();
    this.render();
    return { visible: this.isVisible, minimized: this.isMinimized };
  }

  public minimize(): void {
    this.isMinimized = true;
    this.render();
  }

  public expand(): void {
    this.isVisible = true;
    this.isMinimized = false;
    this.inspectCurrentPage();
    this.syncWakeWordStandby();
    this.render();
  }

  /**
   * Computes the 5 required JARVIS visual states:
   * IDLE | LISTENING | THINKING | SPEAKING | ERROR
   */
  public getVisualState(): JarvisVisualState {
    if (
      this.micPermissionDenied ||
      this.avatarState === 'error' ||
      this.taskState.status === 'ERROR' ||
      this.taskState.status === 'BLOCKED'
    ) {
      return 'ERROR';
    }
    if (this.micState === 'Speaking' || textToSpeech.getIsSpeaking()) {
      return 'SPEAKING';
    }
    if (
      this.isAnalyzing ||
      this.isVerifying ||
      this.micState === 'Processing' ||
      this.taskState.status === 'UNDERSTANDING' ||
      this.taskState.status === 'SEARCHING' ||
      this.taskState.status === 'ANALYZING' ||
      this.taskState.status === 'VERIFYING'
    ) {
      return 'THINKING';
    }
    if (this.micState === 'Listening') {
      return 'LISTENING';
    }
    return 'IDLE';
  }

  private getCallbacks() {
    return {
      onStateChange: (newState: MicrophoneState) => {
        this.micState = newState;
        if (newState === 'Listening') {
          this.avatarState = 'waiting';
        } else if (newState === 'Processing') {
          this.avatarState = 'thinking';
        } else if (newState === 'Idle' && !textToSpeech.getIsSpeaking()) {
          this.avatarState =
            this.taskState.status === 'WAITING_FOR_USER' ? 'waiting' : 'idle';
        }
        this.render();
      },
      onResult: (transcript: string, isFinal: boolean) => {
        this.liveTranscript = transcript;
        if (isFinal && transcript.trim()) {
          this.liveTranscript = '';
          this.micState = 'Idle';
          void this.handleStartTask(transcript.trim(), { isVoice: true });
        } else {
          this.render();
        }
      },
      onWakeWordDetected: (commandRemainder: string) => {
        this.liveTranscript = '';
        if (commandRemainder.trim()) {
          void this.handleStartTask(commandRemainder.trim(), { isVoice: true });
        } else {
          // User said "Salam Jarvis" / "Salam M3ak" -> Respond by voice and immediately listen for command
          const greeting = 'وعليكم السلام، أنا معاك. شنو بغيتي ندير ليك؟';
          this.messages.push({
            id: generateId('msg'),
            sender: 'ai',
            text: greeting,
            timestamp: Date.now(),
          });
          this.render();
          this.speakResponse(greeting, true);
        }
      },
      onError: (friendlyError: string, permissionDenied?: boolean) => {
        this.micState = 'Idle';
        this.liveTranscript = '';
        if (permissionDenied) {
          this.micPermissionDenied = true;
          this.wakeStandbyActive = false;
        }
        this.avatarState = 'error';
        this.messages.push({
          id: generateId('msg'),
          sender: 'ai',
          text: friendlyError,
          timestamp: Date.now(),
          isError: true,
        });
        this.render();
      },
    };
  }

  private syncWakeWordStandby(): void {
    if (!this.isVisible || !this.wakeStandbyActive || this.micPermissionDenied) {
      return;
    }
    speechToText.enableWakeWordStandby('ar-MA', this.getCallbacks());
  }

  private speakResponse(text: string, listenImmediatelyAfter = false): void {
    // Never speak while user is actively speaking; cancel previous speech first
    speechToText.pauseForSpeechOutput();

    textToSpeech.speak(text, {
      onStart: () => {
        this.avatarState = 'speaking';
        this.micState = 'Speaking';
        this.render();
      },
      onEnd: () => {
        this.avatarState =
          this.taskState.status === 'WAITING_FOR_USER' ? 'waiting' : 'idle';
        this.micState = 'Idle';
        this.render();
        speechToText.resumeAfterSpeechOutput(listenImmediatelyAfter);
      },
    });
  }

  public handleStopSpeaking(): void {
    textToSpeech.stop();
    this.micState = 'Idle';
    this.avatarState = 'idle';
    this.render();
    speechToText.resumeAfterSpeechOutput(false);
  }

  public handlePageDomMutated(): void {
    if (!this.isVisible) return;
    this.inspectCurrentPage();
  }

  public async handlePageUserInteraction(
    interactionEvent: UserInteractionEvent
  ): Promise<void> {
    if (
      this.taskState.status !== 'WAITING_FOR_USER' ||
      this.isVerifying ||
      this.isAnalyzing ||
      !this.taskState.goal
    ) {
      return;
    }

    if (
      this.taskState.targetElement &&
      interactionEvent.elementId !== this.taskState.targetElement
    ) {
      return;
    }

    this.isVerifying = true;
    this.avatarState = 'thinking';
    this.taskState = {
      ...this.taskState,
      status: 'VERIFYING',
      targetElement: null,
      requiresConfirmation: false,
      lastUpdated: Date.now(),
    };
    elementHighlighter.clearHighlight();
    this.render();

    await new Promise((r) => setTimeout(r, 240));

    try {
      const updatedCtx = this.inspectCurrentPage();
      const newCompletedRecord: CompletedStepRecord = {
        stepNumber: this.taskState.currentStep,
        instruction: this.taskState.currentInstruction,
        elementId: interactionEvent.elementId,
        action: this.taskState.actionType,
        timestamp: Date.now(),
      };
      const updatedCompletedSteps = [
        ...this.taskState.completedSteps,
        newCompletedRecord,
      ];
      const nextStepNumber = this.taskState.currentStep + 1;

      this.taskState = {
        ...this.taskState,
        status: 'NEXT_STEP',
        completedSteps: updatedCompletedSteps,
        lastUpdated: Date.now(),
      };
      this.render();

      const verification = await aiService.verifyAction({
        userGoal: this.taskState.goal,
        previousInstruction: this.taskState.currentInstruction,
        previousTargetId: interactionEvent.elementId,
        interactionDescription: interactionEvent.description,
        updatedPageContext: updatedCtx,
        currentStep: this.taskState.currentStep,
        completedSteps: updatedCompletedSteps,
      });

      if (
        verification.taskCompleted ||
        verification.nextAction?.taskCompleted
      ) {
        const finalMsg =
          verification.nextAction?.message ||
          verification.messageDarija ||
          'مزيان، سالينا المهمة بنجاح.';
        this.applyStepAction(
          this.taskState.goal,
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
        this.applyStepAction(
          this.taskState.goal,
          nextStepNumber,
          verification.nextAction,
          updatedCompletedSteps
        );
      }
    } catch {
      this.avatarState = 'error';
      this.taskState = {
        ...this.taskState,
        status: 'ERROR',
        currentInstruction: FRIENDLY_DARIJA_ERROR,
        lastUpdated: Date.now(),
      };
      this.render();
    } finally {
      this.isVerifying = false;
    }
  }

  private inspectCurrentPage(): PageContext {
    const ctx = domAnalyzer.inspectPage(document.body);
    this.pageContext = ctx;
    return ctx;
  }

  private async captureScreenshot(): Promise<string | undefined> {
    const chromeGlobal = (globalThis as Record<string, any>).chrome;
    if (!chromeGlobal?.runtime?.sendMessage) return undefined;

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
      // ignore
    }
    return undefined;
  }

  private async handleAnalyzePage(withScreenshot = false): Promise<void> {
    if (this.isAnalyzing) return;
    textToSpeech.stop();
    this.isAnalyzing = true;
    this.avatarState = 'thinking';
    this.taskState = {
      ...this.taskState,
      status: 'UNDERSTANDING',
      lastUpdated: Date.now(),
    };

    this.messages.push({
      id: generateId('msg'),
      sender: 'user',
      text: withScreenshot ? 'حلل هاد الصفحة بالصورة' : 'شنو كاين فهاد الصفحة؟',
      timestamp: Date.now(),
      hasScreenshot: withScreenshot,
    });
    this.render();

    try {
      const ctx = this.inspectCurrentPage();
      const screenshotDataUrl = withScreenshot
        ? await this.captureScreenshot()
        : undefined;
      const analysis = await aiService.analyzePage(ctx, screenshotDataUrl);

      this.messages.push({
        id: generateId('msg'),
        sender: 'ai',
        text: analysis.summaryDarija,
        timestamp: Date.now(),
        pageAnalysis: analysis,
      });
      this.avatarState = 'idle';
      this.taskState = {
        ...this.taskState,
        status: 'IDLE',
        lastUpdated: Date.now(),
      };
      this.speakResponse(analysis.summaryDarija);
    } catch {
      this.avatarState = 'error';
      this.taskState = {
        ...this.taskState,
        status: 'ERROR',
        lastUpdated: Date.now(),
      };
      this.messages.push({
        id: generateId('msg'),
        sender: 'ai',
        text: FRIENDLY_DARIJA_ERROR,
        timestamp: Date.now(),
        isError: true,
      });
    } finally {
      this.isAnalyzing = false;
      this.render();
    }
  }

  private async handleStartTask(
    userInput: string,
    options?: { isVoice?: boolean; withScreenshot?: boolean }
  ): Promise<void> {
    const trimmed = userInput.trim();
    if (!trimmed || this.isAnalyzing) return;

    // Cancel any ongoing speech when a new command starts
    textToSpeech.stop();

    if (this.isMinimized) {
      this.isMinimized = false;
    }

    this.isAnalyzing = true;
    this.avatarState = 'thinking';
    this.messages.push({
      id: generateId('msg'),
      sender: 'user',
      text: trimmed,
      timestamp: Date.now(),
      isVoice: options?.isVoice,
      hasScreenshot: options?.withScreenshot,
    });

    const routedPreview = intentRouter.route(
      trimmed,
      conversationMemory.getSnapshot(),
      false
    );
    const isResearchOrBrowserTask =
      routedPreview.intent === 'RESEARCH' ||
      (routedPreview.intent === 'NAVIGATION' &&
        routedPreview.contextRequirement === 'none');

    this.taskState = {
      id: generateId('task'),
      goal: trimmed,
      currentStep: 1,
      totalEstimatedSteps: isResearchOrBrowserTask ? 4 : 3,
      status: 'UNDERSTANDING',
      targetElement: null,
      currentInstruction: isResearchOrBrowserTask
        ? 'كنفهم الطلب وكنحضر خطة البحث...'
        : 'كنحلل الصفحة دابا...',
      requiresConfirmation: false,
      actionType: 'none',
      completedSteps: [],
      lastUpdated: Date.now(),
      researchProgress: isResearchOrBrowserTask ? 'UNDERSTANDING' : null,
      browserAgentPlan: null,
    };
    this.render();

    try {
      if (isResearchOrBrowserTask) {
        this.taskState = {
          ...this.taskState,
          status: 'SEARCHING',
          currentInstruction: 'كنقلب فـ الويب والمصادر الموثوقة...',
          researchProgress: 'SEARCHING',
          lastUpdated: Date.now(),
        };
        this.render();
        await new Promise((r) => setTimeout(r, 150));
      }

      const ctx = this.inspectCurrentPage();

      if (isResearchOrBrowserTask) {
        this.taskState = {
          ...this.taskState,
          status: 'ANALYZING',
          currentInstruction: 'كنفحص الصفحات وكنقارن المعلومات...',
          researchProgress: 'ANALYZING',
          lastUpdated: Date.now(),
        };
        this.render();
        await new Promise((r) => setTimeout(r, 150));
      }

      const screenshotDataUrl = options?.withScreenshot
        ? await this.captureScreenshot()
        : undefined;

      const actionRes = await aiService.getNextAction({
        userGoal: trimmed,
        pageContext: ctx,
        currentStep: 1,
        completedSteps: [],
        screenshotDataUrl,
      });

      this.applyStepAction(trimmed, 1, actionRes, []);
    } catch {
      this.avatarState = 'error';
      this.taskState = {
        ...this.taskState,
        status: 'ERROR',
        currentInstruction: FRIENDLY_DARIJA_ERROR,
        lastUpdated: Date.now(),
      };
      this.messages.push({
        id: generateId('msg'),
        sender: 'ai',
        text: FRIENDLY_DARIJA_ERROR,
        timestamp: Date.now(),
        isError: true,
      });
    } finally {
      this.isAnalyzing = false;
      this.render();
    }
  }

  private applyStepAction(
    goal: string,
    stepNumber: number,
    actionRes: AIActionResponse,
    completedSteps: CompletedStepRecord[]
  ): void {
    if (actionRes.taskCompleted && !actionRes.targetElementId) {
      this.taskState = {
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
      };
      this.avatarState = 'success';
      elementHighlighter.clearHighlight();
    } else {
      const resolvedEl = actionRes.targetElementId
        ? domAnalyzer.resolveElement(actionRes.targetElementId, document.body)
        : null;

      if (actionRes.targetElementId && !resolvedEl) {
        const notFoundMsg =
          'ما بانش ليا هاد العنصر فهاد الجزء من الصفحة. جرب تهبط شوية أو سولني بطريقة أخرى.';
        this.taskState = {
          id: generateId('task'),
          goal,
          currentStep: stepNumber,
          totalEstimatedSteps:
            actionRes.estimatedTotalSteps || Math.max(stepNumber + 1, 3),
          status: 'BLOCKED',
          targetElement: null,
          currentInstruction: notFoundMsg,
          requiresConfirmation: false,
          actionType: 'none',
          completedSteps,
          lastUpdated: Date.now(),
        };
        this.avatarState = 'error';
        this.messages.push({
          id: generateId('msg'),
          sender: 'ai',
          text: notFoundMsg,
          timestamp: Date.now(),
          isError: true,
        });
        this.render();
        this.speakResponse(notFoundMsg);
        return;
      }

      const stepNum = actionRes.currentStepNumber || stepNumber;
      this.taskState = {
        id: generateId('task'),
        goal,
        currentStep: stepNum,
        totalEstimatedSteps:
          actionRes.estimatedTotalSteps || Math.max(stepNumber + 1, 3),
        status: actionRes.taskCompleted ? 'COMPLETED' : 'WAITING_FOR_USER',
        targetElement: actionRes.targetElementId,
        currentInstruction: actionRes.message,
        requiresConfirmation: actionRes.requiresConfirmation,
        actionType: actionRes.action,
        completedSteps,
        lastUpdated: Date.now(),
      };
      this.avatarState = actionRes.taskCompleted ? 'success' : 'waiting';

      if (actionRes.targetElementId) {
        elementHighlighter.highlight(
          {
            elementId: actionRes.targetElementId,
            instruction: actionRes.message,
            action: actionRes.action,
            requiresConfirmation: actionRes.requiresConfirmation,
            stepNumber: stepNum,
          },
          document.body
        );
      }
    }

    this.messages.push({
      id: generateId('msg'),
      sender: 'ai',
      text: actionRes.message,
      timestamp: Date.now(),
      actionResponse: actionRes,
    });
    this.render();
    this.speakResponse(actionRes.message);
  }

  private handleConfirmSensitiveAction(executeAutomatically: boolean): void {
    const targetId = this.taskState.targetElement;
    if (!targetId) return;

    if (!executeAutomatically) {
      const msg =
        'مزيان، خليت ليك الزر مضوي فـ الصفحة باش تكليكي عليه ملي تكون واجد.';
      this.taskState = {
        ...this.taskState,
        requiresConfirmation: false,
        lastUpdated: Date.now(),
      };
      this.messages.push({
        id: generateId('msg'),
        sender: 'ai',
        text: msg,
        timestamp: Date.now(),
      });
      this.render();
      this.speakResponse(msg);
      return;
    }

    const el = domAnalyzer.resolveElement(targetId, document.body);
    this.taskState = {
      ...this.taskState,
      requiresConfirmation: false,
      lastUpdated: Date.now(),
    };
    this.render();
    if (el) {
      el.click();
    }
  }

  private handleStopTask(): void {
    this.taskState = { ...INITIAL_TASK_STATE };
    this.avatarState = 'idle';
    elementHighlighter.clearHighlight();
    this.render();
  }

  private handleToggleVoice(): void {
    if (textToSpeech.getIsSpeaking() || this.micState === 'Speaking') {
      this.handleStopSpeaking();
      return;
    }

    if (this.micState === 'Listening') {
      speechToText.stopListening();
      this.micState = 'Idle';
      this.avatarState = 'idle';
      this.liveTranscript = '';
      this.render();
      this.syncWakeWordStandby();
      return;
    }

    this.micPermissionDenied = false;
    this.avatarState = 'waiting';
    speechToText.startListening('ar-MA', this.getCallbacks());
  }

  private handleToggleWakeStandby(): void {
    this.wakeStandbyActive = !this.wakeStandbyActive;
    if (this.wakeStandbyActive) {
      this.micPermissionDenied = false;
      this.syncWakeWordStandby();
    } else {
      speechToText.disableWakeWordStandby();
      this.micState = 'Idle';
    }
    this.render();
  }

  private ensureMounted(): void {
    let existing = document.getElementById(
      FLOATING_HOST_ID
    ) as HTMLDivElement | null;

    if (!existing) {
      existing = document.createElement('div');
      existing.id = FLOATING_HOST_ID;
      existing.setAttribute('data-m3ak-overlay', 'true');
      existing.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:visible;';
      document.body.appendChild(existing);
    }

    this.hostEl = existing;
    if (!this.shadowRoot) {
      this.shadowRoot =
        existing.shadowRoot || existing.attachShadow({ mode: 'open' });
      this.attachWindowDragListeners();
    }
  }

  private attachWindowDragListeners(): void {
    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        this.dragMoved = true;
      }

      const maxRight = Math.max(16, window.innerWidth - 140);
      const maxBottom = Math.max(16, window.innerHeight - 90);

      this.posRight = Math.max(
        16,
        Math.min(maxRight, this.dragStartRight - dx)
      );
      this.posBottom = Math.max(
        16,
        Math.min(maxBottom, this.dragStartBottom - dy)
      );

      const container = this.shadowRoot?.querySelector(
        '.m3ak-floating-shell'
      ) as HTMLElement | null;
      if (container) {
        container.style.right = `${this.posRight}px`;
        container.style.bottom = `${this.posBottom}px`;
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.isDragging) {
        this.isDragging = false;
      }
    });
  }

  private getStateTheme(vState: JarvisVisualState): {
    code: JarvisVisualState;
    labelDarija: string;
    primaryColor: string;
    glowRgba: string;
    outerSpinDuration: string;
    innerSpinDuration: string;
  } {
    switch (vState) {
      case 'LISTENING':
        return {
          code: 'LISTENING',
          labelDarija: 'كنسمعك دابا...',
          primaryColor: '#22d3ee',
          glowRgba: 'rgba(34, 211, 238, 0.55)',
          outerSpinDuration: '2.4s',
          innerSpinDuration: '1.6s',
        };
      case 'THINKING':
        return {
          code: 'THINKING',
          labelDarija: 'كنحلل الصفحة...',
          primaryColor: '#38bdf8',
          glowRgba: 'rgba(56, 189, 248, 0.50)',
          outerSpinDuration: '1.2s',
          innerSpinDuration: '0.9s',
        };
      case 'SPEAKING':
        return {
          code: 'SPEAKING',
          labelDarija: 'كنهضر معاك',
          primaryColor: '#34d399',
          glowRgba: 'rgba(52, 211, 153, 0.60)',
          outerSpinDuration: '3.2s',
          innerSpinDuration: '2.0s',
        };
      case 'ERROR':
        return {
          code: 'ERROR',
          labelDarija: 'تنبيه',
          primaryColor: '#fb7185',
          glowRgba: 'rgba(251, 113, 133, 0.50)',
          outerSpinDuration: '8s',
          innerSpinDuration: '6s',
        };
      default:
        return {
          code: 'IDLE',
          labelDarija: this.wakeStandbyActive
            ? 'قل "Salam Jarvis"'
            : 'أنا معاك · واجد',
          primaryColor: '#10b981',
          glowRgba: 'rgba(16, 185, 129, 0.32)',
          outerSpinDuration: '11s',
          innerSpinDuration: '7.5s',
        };
    }
  }

  private render(): void {
    if (!this.shadowRoot) return;

    if (!this.isVisible) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const vState = this.getVisualState();
    const theme = this.getStateTheme(vState);
    const isListening = vState === 'LISTENING';
    const isSpeaking = vState === 'SPEAKING';

    const latestAiMsg =
      [...this.messages].reverse().find((m) => m.sender === 'ai') ||
      this.messages[this.messages.length - 1];
    const recentCommands = this.messages.slice(-4);

    const styleCss = `
      :host {
        all: initial;
        font-family: 'Plus Jakarta Sans', 'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      @keyframes m3akOrbitSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes m3akOrbitReverse {
        0% { transform: rotate(360deg); }
        100% { transform: rotate(0deg); }
      }
      @keyframes m3akCorePulse {
        0%, 100% { transform: scale(1); opacity: 0.90; }
        50% { transform: scale(${isListening || isSpeaking ? '1.28' : '1.12'}); opacity: 1; }
      }
      @keyframes m3akWaveBar {
        0%, 100% { height: 5px; }
        50% { height: 18px; }
      }
      .m3ak-floating-shell {
        position: fixed;
        right: ${this.posRight}px;
        bottom: ${this.posBottom}px;
        pointer-events: auto;
        z-index: 2147483647;
        user-select: none;
        font-family: 'Plus Jakarta Sans', 'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      /* ==========================================
         COLLAPSED STATE: FLOATING ENERGY ORB
         ========================================== */
      .m3ak-orb-dock {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 10px 7px 8px;
        border-radius: 9999px;
        background: linear-gradient(145deg, rgba(4, 10, 20, 0.92), rgba(9, 20, 36, 0.88));
        backdrop-filter: blur(20px) saturate(170%);
        -webkit-backdrop-filter: blur(20px) saturate(170%);
        border: 1px solid ${theme.primaryColor};
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.7), 0 0 26px ${theme.glowRgba};
        cursor: grab;
        transition: transform 160ms ease, border-color 160ms ease;
      }
      .m3ak-orb-dock:hover {
        transform: translateY(-2px);
      }
      .m3ak-orb-dock:active {
        cursor: grabbing;
      }
      .m3ak-orb-trigger {
        display: flex;
        align-items: center;
        gap: 9px;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        color: #f8fafc;
      }
      .m3ak-orb-visual {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 50% 50%, ${theme.glowRgba}, rgba(2, 6, 23, 0.96) 72%);
      }
      .m3ak-orb-ring-outer {
        position: absolute;
        inset: 1px;
        border-radius: 9999px;
        border: 1.5px dashed ${theme.primaryColor};
        opacity: 0.85;
        animation: m3akOrbitSpin ${theme.outerSpinDuration} linear infinite;
      }
      .m3ak-orb-ring-inner {
        position: absolute;
        inset: 6px;
        border-radius: 9999px;
        border: 1.5px solid ${theme.primaryColor};
        border-top-color: transparent;
        border-bottom-color: transparent;
        animation: m3akOrbitReverse ${theme.innerSpinDuration} linear infinite;
      }
      .m3ak-orb-nucleus {
        width: 13px;
        height: 13px;
        border-radius: 9999px;
        background: radial-gradient(circle, #ffffff 0%, ${theme.primaryColor} 60%, #059669 100%);
        box-shadow: 0 0 14px ${theme.primaryColor};
        animation: m3akCorePulse ${isListening || isSpeaking ? '0.85s' : '2.2s'} ease-in-out infinite;
      }
      .m3ak-orb-label {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: #f8fafc;
      }
      .m3ak-orb-mic {
        width: 32px;
        height: 32px;
        border-radius: 9999px;
        border: 1px solid ${theme.primaryColor};
        background: ${isListening ? 'rgba(34, 211, 238, 0.25)' : 'rgba(15, 23, 42, 0.85)'};
        color: ${theme.primaryColor};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 13px;
      }

      /* ==========================================
         EXPANDED STATE: VOICE-FIRST JARVIS HUD
         ========================================== */
      .m3ak-panel {
        width: 368px;
        max-width: calc(100vw - 24px);
        display: flex;
        flex-direction: column;
        background: linear-gradient(165deg, rgba(5, 10, 22, 0.90) 0%, rgba(8, 17, 32, 0.86) 100%);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        color: #f1f5f9;
        border: 1px solid ${theme.primaryColor}66;
        border-radius: 22px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.78), 0 0 36px ${theme.glowRgba}, inset 0 1px 0 rgba(255, 255, 255, 0.08);
        overflow: hidden;
      }
      .m3ak-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: rgba(4, 9, 19, 0.78);
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        cursor: grab;
      }
      .m3ak-header:active {
        cursor: grabbing;
      }
      .m3ak-state-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 9px;
        border-radius: 9999px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: ${theme.primaryColor};
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid ${theme.primaryColor}66;
      }
      .m3ak-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 9999px;
        background: ${theme.primaryColor};
        box-shadow: 0 0 8px ${theme.primaryColor};
      }
      .m3ak-header-actions {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .m3ak-btn {
        background: rgba(15, 23, 42, 0.78);
        color: #e2e8f0;
        border: 1px solid rgba(51, 65, 85, 0.8);
        border-radius: 9px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 140ms ease;
      }
      .m3ak-btn:hover {
        border-color: ${theme.primaryColor};
        color: #ffffff;
      }

      /* Voice-First Reactive AI Core Stage */
      .m3ak-voice-stage {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px 16px 12px;
        text-align: center;
        position: relative;
      }
      .m3ak-stage-orb-btn {
        position: relative;
        width: 68px;
        height: 68px;
        border-radius: 9999px;
        border: none;
        background: radial-gradient(circle at 50% 50%, ${theme.glowRgba}, rgba(2, 6, 23, 0.96) 72%);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 32px ${theme.glowRgba};
        transition: transform 150ms ease;
      }
      .m3ak-stage-orb-btn:hover {
        transform: scale(1.05);
      }
      .m3ak-wave-bars {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        height: 18px;
        margin-top: 8px;
      }
      .m3ak-wave-bar {
        width: 3px;
        border-radius: 9999px;
        background: ${theme.primaryColor};
        animation: m3akWaveBar 0.75s ease-in-out infinite;
      }
      .m3ak-stage-status {
        margin-top: 6px;
        font-size: 12px;
        font-weight: 700;
        color: ${theme.primaryColor};
      }
      .m3ak-live-transcript {
        margin-top: 6px;
        padding: 6px 12px;
        border-radius: 10px;
        background: rgba(6, 182, 212, 0.14);
        border: 1px solid rgba(34, 211, 238, 0.4);
        color: #e0f2fe;
        font-size: 12px;
        max-width: 100%;
      }
      .m3ak-perm-fallback {
        margin: 8px 14px 0;
        padding: 9px 11px;
        border-radius: 11px;
        background: rgba(159, 18, 57, 0.28);
        border: 1px solid rgba(251, 113, 133, 0.55);
        color: #fecdd3;
        font-size: 11.5px;
        line-height: 1.5;
        direction: rtl;
        text-align: right;
      }
      .m3ak-active-response {
        margin: 8px 14px;
        padding: 11px 13px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(51, 65, 85, 0.75);
        border-left: 3px solid ${theme.primaryColor};
        font-size: 13px;
        line-height: 1.58;
        color: #f8fafc;
        user-select: text;
      }
      .m3ak-history-compact {
        max-height: 115px;
        overflow-y: auto;
        margin: 0 14px 8px;
        padding: 6px 10px;
        border-radius: 10px;
        background: rgba(2, 6, 23, 0.55);
        border: 1px solid rgba(30, 41, 59, 0.75);
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 11px;
      }
      .m3ak-history-line {
        display: flex;
        align-items: baseline;
        gap: 6px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .m3ak-chips-bar {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding: 6px 14px;
        scrollbar-width: none;
      }
      .m3ak-chips-bar::-webkit-scrollbar {
        display: none;
      }
      .m3ak-chip {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(51, 65, 85, 0.75);
        color: #cbd5e1;
        border-radius: 8px;
        padding: 4px 9px;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .m3ak-chip:hover {
        border-color: ${theme.primaryColor};
        color: #ffffff;
      }
      .m3ak-footer {
        padding: 9px 14px 11px;
        background: rgba(4, 9, 19, 0.85);
        border-top: 1px solid rgba(148, 163, 184, 0.14);
      }
      .m3ak-input-box {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(2, 6, 23, 0.85);
        border: 1px solid rgba(51, 65, 85, 0.8);
        border-radius: 11px;
        padding: 4px 6px 4px 10px;
      }
      .m3ak-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #ffffff;
        font-size: 11.5px;
        min-width: 0;
      }
    `;

    // COLLAPSED STATE: Floating energy orb + M3ak label + subtle glow + microphone indicator
    if (this.isMinimized) {
      this.shadowRoot.innerHTML = `
        <style>${styleCss}</style>
        <div class="m3ak-floating-shell">
          <div class="m3ak-orb-dock" id="m3ak-orb-dock" title="M3ak Voice Companion (${theme.code}) · قل 'Salam Jarvis' أو إضغط">
            <button type="button" class="m3ak-orb-trigger" id="m3ak-orb-expand" aria-label="Expand M3ak Companion">
              <div class="m3ak-orb-visual">
                <div class="m3ak-orb-ring-outer"></div>
                <div class="m3ak-orb-ring-inner"></div>
                <div class="m3ak-orb-nucleus"></div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-start;">
                <span class="m3ak-orb-label">${AI_NAME}</span>
                <span style="font-size:9.5px;color:${theme.primaryColor};font-weight:600;">${theme.code}</span>
              </div>
            </button>
            <button
              type="button"
              class="m3ak-orb-mic"
              id="m3ak-orb-mic-btn"
              title="${isSpeaking ? 'حبس الصوت' : isListening ? 'حبس الاستماع' : 'هضر مع M3ak'}"
              aria-label="Voice control"
            >
              ${isSpeaking ? '🔇' : '🎤'}
            </button>
          </div>
        </div>
      `;

      const dock = this.shadowRoot.getElementById('m3ak-orb-dock');
      const expandBtn = this.shadowRoot.getElementById('m3ak-orb-expand');
      const micBtn = this.shadowRoot.getElementById('m3ak-orb-mic-btn');

      dock?.addEventListener('pointerdown', (e: PointerEvent) => {
        this.isDragging = true;
        this.dragMoved = false;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartRight = this.posRight;
        this.dragStartBottom = this.posBottom;
      });

      expandBtn?.addEventListener('click', () => {
        if (!this.dragMoved) {
          this.expand();
        }
      });

      micBtn?.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        if (!this.dragMoved) {
          this.handleToggleVoice();
        }
      });
      return;
    }

    const chipsHtml = DARIJA_QUICK_PROMPTS.map(
      (item) =>
        `<button type="button" class="m3ak-chip" data-prompt="${this.escapeAttr(
          item.text
        )}" dir="auto">${this.escapeHtml(item.label)}</button>`
    ).join('');

    const historyHtml = recentCommands
      .map(
        (m) => `
        <div class="m3ak-history-line" dir="auto">
          <span style="color:${m.sender === 'user' ? '#22d3ee' : '#34d399'};font-weight:700;">
            ${m.sender === 'user' ? '🎙️ نتا:' : '◉ M3ak:'}
          </span>
          <span style="overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(
            m.text
          )}</span>
        </div>
      `
      )
      .join('');

    this.shadowRoot.innerHTML = `
      <style>${styleCss}</style>
      <div class="m3ak-floating-shell">
        <section class="m3ak-panel" aria-label="M3ak Voice-First JARVIS HUD">
          <!-- Header -->
          <header class="m3ak-header" id="m3ak-drag-handle" title="اسحب لتحريك M3ak">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:13px;font-weight:800;color:#fff;">${AI_NAME}</span>
              <span style="font-size:11px;color:#64748b;">(${AI_NAME_ARABIC})</span>
              <span class="m3ak-state-pill">
                <span class="m3ak-status-dot"></span>
                <span>${theme.code}</span>
              </span>
            </div>
            <div class="m3ak-header-actions">
              <button
                type="button"
                class="m3ak-btn"
                id="m3ak-wake-toggle"
                title="تفعيل أو إيقاف الاستماع التلقائي لـ Salam Jarvis"
                style="border-color:${this.wakeStandbyActive ? '#10b981' : '#475569'};color:${
      this.wakeStandbyActive ? '#34d399' : '#94a3b8'
    };"
              >
                ${this.wakeStandbyActive ? '🟢 Salam Jarvis' : '⚪ Wake Off'}
              </button>
              <button type="button" class="m3ak-btn" id="m3ak-minimize-btn" title="تصغير إلى الأيقونة العائمة">—</button>
              <button type="button" class="m3ak-btn" id="m3ak-close-btn" title="إخفاء">✕</button>
            </div>
          </header>

          ${
            this.micPermissionDenied
              ? `
            <div class="m3ak-perm-fallback">
              <strong>🎤 صلاحية الميكروفون مقفولة:</strong><br/>
              باش تهضر مع M3ak بـ "Salam Jarvis"، كليكي على أيقونة القفل 🔒 حدا عنوان الموقع الفوق فـ المتصفح، وبدل <strong>Microphone</strong> لـ <strong>Allow</strong>، من بعد كليكي على الكرة الضوئية لتحت.
            </div>
          `
              : ''
          }

          <!-- Central Voice-First Reactive AI Core Stage -->
          <div class="m3ak-voice-stage">
            <button
              type="button"
              class="m3ak-stage-orb-btn"
              id="m3ak-voice-btn"
              title="${isSpeaking ? 'إضغط لإيقاف الصوت' : isListening ? 'إضغط لإيقاف الاستماع' : 'إضغط أو قول Salam Jarvis'}"
            >
              <div class="m3ak-orb-ring-outer"></div>
              <div class="m3ak-orb-ring-inner"></div>
              <div class="m3ak-orb-nucleus" style="width:18px;height:18px;"></div>
            </button>

            ${
              isListening || isSpeaking
                ? `
              <div class="m3ak-wave-bars">
                <div class="m3ak-wave-bar" style="animation-delay:0s"></div>
                <div class="m3ak-wave-bar" style="animation-delay:0.15s"></div>
                <div class="m3ak-wave-bar" style="animation-delay:0.3s"></div>
                <div class="m3ak-wave-bar" style="animation-delay:0.1s"></div>
                <div class="m3ak-wave-bar" style="animation-delay:0.25s"></div>
              </div>
            `
                : ''
            }

            <div class="m3ak-stage-status">${theme.labelDarija}</div>

            ${
              this.liveTranscript
                ? `<div class="m3ak-live-transcript" dir="auto">"${this.escapeHtml(
                    this.liveTranscript
                  )}"</div>`
                : ''
            }

            <div style="display:flex;gap:6px;margin-top:8px;">
              <button type="button" class="m3ak-btn" id="m3ak-mic-action-btn">
                ${isListening ? '⏹️ حبس الاستماع' : '🎤 هضر دابا'}
              </button>
              ${
                isSpeaking
                  ? `<button type="button" class="m3ak-btn" id="m3ak-stop-tts-btn" style="border-color:#fb7185;color:#fecdd3;">🔇 حبس الصوت</button>`
                  : `<button type="button" class="m3ak-btn" id="m3ak-speak-last-btn">🔊 عاود سمع</button>`
              }
              <button type="button" class="m3ak-btn" id="m3ak-analyze-btn">🔍 شنو هنا؟</button>
            </div>
          </div>

          <!-- Active Spoken Response HUD Card -->
          ${
            this.taskState.researchProgress ||
            latestAiMsg?.actionResponse?.browserAgentPlan
              ? `
            <div style="margin:0 14px 6px;padding:5px 10px;border-radius:9px;background:rgba(15,23,42,0.75);border:1px solid rgba(51,65,85,0.75);display:flex;justify-content:space-between;align-items:center;font-size:9.5px;font-family:monospace;">
              <span style="color:${
                (this.taskState.researchProgress || 'READY') === 'UNDERSTANDING'
                  ? '#22d3ee'
                  : '#34d399'
              };font-weight:700;">UNDERSTANDING</span>
              <span style="color:#475569;">→</span>
              <span style="color:${
                this.taskState.researchProgress === 'SEARCHING'
                  ? '#22d3ee'
                  : this.taskState.researchProgress === 'ANALYZING' ||
                    this.taskState.researchProgress === 'READY' ||
                    latestAiMsg?.actionResponse?.browserAgentPlan
                  ? '#34d399'
                  : '#475569'
              };font-weight:700;">SEARCHING</span>
              <span style="color:#475569;">→</span>
              <span style="color:${
                this.taskState.researchProgress === 'ANALYZING'
                  ? '#22d3ee'
                  : this.taskState.researchProgress === 'READY' ||
                    latestAiMsg?.actionResponse?.browserAgentPlan
                  ? '#34d399'
                  : '#475569'
              };font-weight:700;">ANALYZING</span>
              <span style="color:#475569;">→</span>
              <span style="color:${
                this.taskState.researchProgress === 'READY' ||
                latestAiMsg?.actionResponse?.browserAgentPlan
                  ? '#34d399'
                  : '#475569'
              };font-weight:700;">READY</span>
            </div>
          `
              : ''
          }
          ${
            latestAiMsg
              ? `
            <div class="m3ak-active-response" dir="auto">
              <div>${this.escapeHtml(latestAiMsg.text)}</div>
              ${
                latestAiMsg.actionResponse?.browserAgentPlan &&
                latestAiMsg.actionResponse.browserAgentPlan.sources.length > 0
                  ? `
                <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(51,65,85,0.7);display:flex;flex-direction:column;gap:4px;">
                  <div style="font-size:9.5px;color:#94a3b8;">Inspected Sources (${
                    latestAiMsg.actionResponse.browserAgentPlan.sources.length
                  }):</div>
                  ${latestAiMsg.actionResponse.browserAgentPlan.sources
                    .slice(0, 3)
                    .map(
                      (src) => `
                    <button
                      type="button"
                      class="m3ak-btn"
                      data-source-url="${this.escapeAttr(src.url)}"
                      style="justify-content:space-between;width:100%;text-align:left;font-size:10px;padding:4px 8px;"
                    >
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6ee7b7;">${this.escapeHtml(
                        src.title
                      )}</span>
                      <span style="color:#94a3b8;flex-shrink:0;">↗</span>
                    </button>
                  `
                    )
                    .join('')}
                </div>
              `
                  : ''
              }
              ${
                this.taskState.requiresConfirmation
                  ? `
                <div style="margin-top:8px;display:flex;gap:6px;">
                  <button type="button" class="m3ak-btn" style="flex:1;justify-content:center;background:#059669;color:#fff;" id="m3ak-confirm-yes">أه، كمل</button>
                  <button type="button" class="m3ak-btn" style="flex:1;justify-content:center;" id="m3ak-confirm-self">أنا غنديرها</button>
                </div>
              `
                  : ''
              }
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:10px;color:#64748b;">
                <span>${
                  latestAiMsg.actionResponse?.skillLabel
                    ? `${this.escapeHtml(latestAiMsg.actionResponse.skillLabel)}${
                        latestAiMsg.actionResponse.explanationDepth
                          ? ` · ${this.escapeHtml(latestAiMsg.actionResponse.explanationDepth)}`
                          : ''
                      }`
                    : this.pageContext
                    ? `${this.escapeHtml(this.pageContext.pageTitle.slice(0, 32))} · ${this.pageContext.elements.length} عناصر`
                    : formatTimeShort(latestAiMsg.timestamp)
                }</span>
                ${
                  this.taskState.targetElement
                    ? `<span style="color:#22d3ee;">Target: #${this.taskState.targetElement}</span>`
                    : ''
                }
              </div>
            </div>
          `
              : ''
          }

          <!-- Minimal Command Log -->
          <div class="m3ak-history-compact">
            ${historyHtml}
          </div>

          <!-- Quick Voice/Tap Prompts -->
          <div class="m3ak-chips-bar">
            ${chipsHtml}
          </div>

          <!-- Secondary Keyboard Fallback Input -->
          <footer class="m3ak-footer">
            <form id="m3ak-chat-form" class="m3ak-input-box">
              <input
                type="text"
                id="m3ak-chat-input"
                class="m3ak-input"
                dir="auto"
                placeholder="أو كتب الأمر ديالك هنا (مثال: fin kayn login?)..."
                value="${this.escapeAttr(this.inputText)}"
              />
              <button type="submit" class="m3ak-btn" style="background:#059669;color:#fff;border-color:#10b981;">أمر</button>
            </form>
          </footer>
        </section>
      </div>
    `;

    this.bindPanelEvents(latestAiMsg?.text || '');
  }

  private bindPanelEvents(latestAiText: string): void {
    if (!this.shadowRoot) return;

    const dragHandle = this.shadowRoot.getElementById('m3ak-drag-handle');
    dragHandle?.addEventListener('pointerdown', (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) return;
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartRight = this.posRight;
      this.dragStartBottom = this.posBottom;
    });

    this.shadowRoot
      .getElementById('m3ak-minimize-btn')
      ?.addEventListener('click', () => this.minimize());

    this.shadowRoot
      .getElementById('m3ak-close-btn')
      ?.addEventListener('click', () => this.hide());

    this.shadowRoot
      .getElementById('m3ak-wake-toggle')
      ?.addEventListener('click', () => this.handleToggleWakeStandby());

    this.shadowRoot
      .getElementById('m3ak-voice-btn')
      ?.addEventListener('click', () => this.handleToggleVoice());

    this.shadowRoot
      .getElementById('m3ak-mic-action-btn')
      ?.addEventListener('click', () => this.handleToggleVoice());

    this.shadowRoot
      .getElementById('m3ak-stop-tts-btn')
      ?.addEventListener('click', () => this.handleStopSpeaking());

    this.shadowRoot
      .getElementById('m3ak-speak-last-btn')
      ?.addEventListener('click', () => {
        if (latestAiText) {
          this.speakResponse(latestAiText);
        }
      });

    this.shadowRoot
      .getElementById('m3ak-analyze-btn')
      ?.addEventListener('click', () => {
        void this.handleAnalyzePage(false);
      });

    this.shadowRoot
      .getElementById('m3ak-confirm-yes')
      ?.addEventListener('click', () => {
        this.handleConfirmSensitiveAction(true);
      });

    this.shadowRoot
      .getElementById('m3ak-confirm-self')
      ?.addEventListener('click', () => {
        this.handleConfirmSensitiveAction(false);
      });

    const inputEl = this.shadowRoot.getElementById(
      'm3ak-chat-input'
    ) as HTMLInputElement | null;
    inputEl?.addEventListener('input', (e) => {
      this.inputText = (e.target as HTMLInputElement).value;
    });

    const formEl = this.shadowRoot.getElementById('m3ak-chat-form');
    formEl?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = (inputEl?.value || this.inputText).trim();
      if (!val || this.isAnalyzing) return;
      this.inputText = '';
      void this.handleStartTask(val);
    });

    this.shadowRoot.querySelectorAll('[data-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        if (prompt) {
          void this.handleStartTask(prompt);
        }
      });
    });

    this.shadowRoot.querySelectorAll('[data-source-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-source-url');
        if (url) {
          dispatchBrowserAgentPlan({
            browserAction: 'open_search_result',
            safetyTier: 'SAFE_AUTOMATIC',
            targetUrl: url,
            progressStage: 'READY',
            steps: [],
            sources: [],
          });
        }
      });
    });
  }

  private escapeHtml(str: string): string {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(str: string): string {
    return this.escapeHtml(str).replace(/'/g, '&#39;');
  }
}

export const floatingAssistant = new FloatingAssistantManager();
