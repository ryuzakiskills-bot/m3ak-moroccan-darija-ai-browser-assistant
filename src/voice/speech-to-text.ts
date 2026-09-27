import { MicrophoneState } from '../shared/types';

export interface SpeechToTextCallbacks {
  onStateChange: (state: MicrophoneState) => void;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (friendlyMessageDarija: string, permissionDenied?: boolean) => void;
  onWakeWordDetected?: (commandRemainder: string) => void;
}

const WAKE_WORD_PATTERNS: RegExp[] = [
  /^(?:salam|slm|salut|hey|hi|hello|yo|ya|ok)\s+(?:jarvis|m3ak|maak|m3aak)\b[,\s:-]*(.*)$/i,
  /^(?:jarvis|m3ak)\b[,\s:-]*(.*)$/i,
  /^(?:سلام|اهلا|مرحبا|يا|هاي|الو)\s*(?:جارفيس|معاك|جارفس|ممعاك)\b[،,\s:-]*(.*)$/i,
  /^(?:جارفيس|معاك)\b[،,\s:-]*(.*)$/i,
];

/**
 * Extracts wake phrase ("Salam Jarvis", "Salam M3ak", "Hey Jarvis", "سلام جارفيس", "سلام معاك")
 * and returns any command spoken immediately after it.
 */
export function matchWakePhrase(transcript: string): {
  matched: boolean;
  remainder: string;
} {
  const cleaned = transcript.trim();
  if (!cleaned) return { matched: false, remainder: '' };

  for (const pattern of WAKE_WORD_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      return {
        matched: true,
        remainder: (match[1] || '').trim(),
      };
    }
  }

  // Also check if wake phrase appears mid-utterance (e.g., "... salam jarvis chno kayn hna")
  const midMatch = cleaned.match(
    /(?:salam\s+jarvis|salam\s+m3ak|hey\s+jarvis|سلام\s*جارفيس|سلام\s*معاك)\b[،,\s:-]*(.*)$/i
  );
  if (midMatch) {
    return {
      matched: true,
      remainder: (midMatch[1] || '').trim(),
    };
  }

  return { matched: false, remainder: '' };
}

/**
 * Voice-First Speech-to-Text & Wake-Phrase Engine
 * - Supports active command listening (auto-stops after a natural pause)
 * - Supports practical browser-compatible continuous Wake-Phrase Standby ("Salam Jarvis" / "Salam M3ak")
 * - Pauses recognition automatically while TTS is speaking so M3ak never hears its own voice
 * - Reports explicit permissionDenied state so UI can display clear instructions to enable the mic
 */
export class SpeechToTextEngine {
  private recognition: any = null;
  private isListening = false;
  private isPausedForTTS = false;
  private wakeStandbyEnabled = false;
  private activeCommandCapture = false;
  private currentLang: 'ar-MA' | 'fr-FR' | 'en-US' = 'ar-MA';
  private standbyCallbacks: SpeechToTextCallbacks | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private permissionDenied = false;

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
    );
  }

  public isWakeStandbyEnabled(): boolean {
    return this.wakeStandbyEnabled;
  }

  public hasPermissionDenied(): boolean {
    return this.permissionDenied;
  }

  /**
   * Requests microphone permission gracefully and enables continuous wake-phrase standby
   * ("Salam Jarvis" / "Salam M3ak") while the assistant is active.
   */
  public enableWakeWordStandby(
    lang: 'ar-MA' | 'fr-FR' | 'en-US' = 'ar-MA',
    callbacks: SpeechToTextCallbacks
  ): void {
    this.currentLang = lang;
    this.standbyCallbacks = callbacks;
    this.wakeStandbyEnabled = true;
    this.permissionDenied = false;

    if (!this.isListening && !this.isPausedForTTS) {
      this.startRecognitionSession(lang, callbacks, false);
    }
  }

  public disableWakeWordStandby(): void {
    this.wakeStandbyEnabled = false;
    this.standbyCallbacks = null;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.stopListening();
  }

  /**
   * Starts immediate active command listening (user either said "Salam Jarvis" or clicked the mic).
   * Automatically stops after a natural speech pause and dispatches the final command.
   */
  public startListening(
    lang: 'ar-MA' | 'fr-FR' | 'en-US' = 'ar-MA',
    callbacks: SpeechToTextCallbacks
  ): void {
    this.currentLang = lang;
    this.standbyCallbacks = callbacks;
    this.permissionDenied = false;
    this.startRecognitionSession(lang, callbacks, true);
  }

  /**
   * Temporarily suspends microphone recognition while M3ak is speaking aloud.
   */
  public pauseForSpeechOutput(): void {
    this.isPausedForTTS = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
      this.isListening = false;
    }
  }

  /**
   * Resumes continuous listening or active command capture after M3ak finishes speaking.
   */
  public resumeAfterSpeechOutput(captureNextCommandImmediately = false): void {
    this.isPausedForTTS = false;
    if (this.permissionDenied || !this.standbyCallbacks) return;

    if (captureNextCommandImmediately) {
      this.startRecognitionSession(
        this.currentLang,
        this.standbyCallbacks,
        true
      );
    } else if (this.wakeStandbyEnabled) {
      this.startRecognitionSession(
        this.currentLang,
        this.standbyCallbacks,
        false
      );
    }
  }

  private startRecognitionSession(
    lang: 'ar-MA' | 'fr-FR' | 'en-US',
    callbacks: SpeechToTextCallbacks,
    isActiveCommandMode: boolean
  ): void {
    if (!this.isSupported()) {
      callbacks.onStateChange('Idle');
      callbacks.onError(
        'الميكروفون ما خدامش فهاد المتصفح دابا. تقدر تستعمل Chrome وتكتب أو تهضر مباشرة.',
        false
      );
      return;
    }

    this.stopRecognitionInternal();
    this.activeCommandCapture = isActiveCommandMode;

    try {
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognitionCtor();
      this.recognition = recognition;
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = !isActiveCommandMode;

      let latestTranscript = '';
      let hasDispatchedFinal = false;

      const finalizeActiveCommand = (textToDispatch: string) => {
        if (hasDispatchedFinal) return;
        const cleaned = textToDispatch.trim();
        if (!cleaned) return;
        hasDispatchedFinal = true;
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        callbacks.onStateChange('Processing');
        callbacks.onResult(cleaned, true);
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      };

      recognition.onstart = () => {
        this.isListening = true;
        this.permissionDenied = false;
        callbacks.onStateChange(isActiveCommandMode ? 'Listening' : 'Idle');
      };

      recognition.onresult = (event: any) => {
        if (this.isPausedForTTS) return;

        let interim = '';
        let finalStr = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const t = event.results[i]?.[0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalStr += t;
          } else {
            interim += t;
          }
        }

        const cleanedFinal = finalStr.trim();
        const cleanedInterim = interim.trim();
        const combined = cleanedFinal || cleanedInterim;
        if (!combined) return;

        // 1. Check if we are in Wake-Phrase Standby Mode
        if (!this.activeCommandCapture) {
          const wakeCheck = matchWakePhrase(combined);
          if (wakeCheck.matched) {
            if (cleanedFinal || wakeCheck.remainder.length > 2) {
              hasDispatchedFinal = true;
              try {
                recognition.stop();
              } catch {
                // ignore
              }
              if (callbacks.onWakeWordDetected) {
                callbacks.onWakeWordDetected(wakeCheck.remainder);
              } else if (wakeCheck.remainder) {
                callbacks.onStateChange('Processing');
                callbacks.onResult(wakeCheck.remainder, true);
              } else {
                // Switch into active command capture
                this.startRecognitionSession(lang, callbacks, true);
              }
            } else {
              // User is saying "Salam Jarvis..." — show interim wake detection
              callbacks.onStateChange('Listening');
              callbacks.onResult(combined, false);
            }
          }
          return;
        }

        // 2. Active Command Capture Mode: strip optional wake prefix if user repeated "Salam Jarvis ..."
        const wakeCheck = matchWakePhrase(combined);
        const effectiveTranscript =
          wakeCheck.matched && wakeCheck.remainder
            ? wakeCheck.remainder
            : combined;

        latestTranscript = effectiveTranscript;

        if (cleanedFinal) {
          // If user only said "Salam Jarvis" in active mode, acknowledge via wake callback
          if (wakeCheck.matched && !wakeCheck.remainder && callbacks.onWakeWordDetected) {
            hasDispatchedFinal = true;
            try {
              recognition.stop();
            } catch {
              // ignore
            }
            callbacks.onWakeWordDetected('');
            return;
          }
          finalizeActiveCommand(effectiveTranscript);
        } else if (cleanedInterim) {
          callbacks.onResult(effectiveTranscript, false);

          // Natural pause auto-stop timer (1.4s of silence after speaking interim words)
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
          }
          this.silenceTimer = setTimeout(() => {
            if (latestTranscript.trim() && !hasDispatchedFinal) {
              finalizeActiveCommand(latestTranscript);
            }
          }, 1450);
        }
      };

      recognition.onerror = (event: any) => {
        this.isListening = false;
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }

        const errCode = event?.error;
        if (errCode === 'aborted' || errCode === 'no-speech') {
          callbacks.onStateChange('Idle');
          return;
        }

        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          this.permissionDenied = true;
          this.wakeStandbyEnabled = false;
          callbacks.onStateChange('Idle');
          callbacks.onError(
            'صلاحية الميكروفون مقفولة فهاد الصفحة. كليكي على القفل 🔒 حدا الرابط الفوق وفعل Microphone باش تهضر مع M3ak بصوتك.',
            true
          );
          return;
        }

        callbacks.onStateChange('Idle');
        if (isActiveCommandMode) {
          callbacks.onError(
            'ما سمعتكش مزيان، عاود هضر معايا أو قول "Salam Jarvis".',
            false
          );
        }
      };

      recognition.onend = () => {
        this.isListening = false;
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }

        if (
          isActiveCommandMode &&
          !hasDispatchedFinal &&
          latestTranscript.trim()
        ) {
          const wakeCheck = matchWakePhrase(latestTranscript);
          if (
            wakeCheck.matched &&
            !wakeCheck.remainder &&
            callbacks.onWakeWordDetected
          ) {
            hasDispatchedFinal = true;
            callbacks.onWakeWordDetected('');
            return;
          }
          hasDispatchedFinal = true;
          callbacks.onStateChange('Processing');
          callbacks.onResult(latestTranscript.trim(), true);
        }

        callbacks.onStateChange('Idle');

        // If continuous wake-word standby is enabled and we aren't paused for TTS or blocked by permissions, restart standby listener
        if (
          this.wakeStandbyEnabled &&
          !this.isPausedForTTS &&
          !this.permissionDenied &&
          this.standbyCallbacks
        ) {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (
              this.wakeStandbyEnabled &&
              !this.isPausedForTTS &&
              !this.isListening &&
              this.standbyCallbacks
            ) {
              this.startRecognitionSession(
                this.currentLang,
                this.standbyCallbacks,
                false
              );
            }
          }, 450);
        }
      };

      recognition.start();
    } catch (err) {
      console.error('[M3ak Voice STT Error]:', err);
      this.isListening = false;
      callbacks.onStateChange('Idle');
      callbacks.onError(
        'وقع مشكل فالميكروفون، تأكد من الصلاحيات أو استعمل الكتابة.',
        false
      );
    }
  }

  private stopRecognitionInternal(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  public stopListening(): void {
    this.activeCommandCapture = false;
    this.stopRecognitionInternal();
  }
}

export const speechToText = new SpeechToTextEngine();
