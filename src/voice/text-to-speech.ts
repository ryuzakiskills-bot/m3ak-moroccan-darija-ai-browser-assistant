/**
 * Pluggable Cloud TTS Provider interface so higher-quality external TTS engines
 * (e.g., Gemini Live Audio, Google Cloud TTS, ElevenLabs) can be plugged in
 * without changing any UI or agent code.
 */
export interface CloudTTSProvider {
  name: string;
  speak: (
    cleanText: string,
    lang: 'ar' | 'en' | 'fr',
    callbacks: { onStart?: () => void; onEnd?: () => void; onError?: () => void }
  ) => Promise<void> | void;
  stop: () => void;
}

/**
 * Modular Text-to-Speech Engine (JARVIS Voice Output)
 * - Cleans AI responses of markdown, code syntax, URLs, element IDs, and UI metadata before speaking
 * - Automatically detects response language (Moroccan Darija/Arabic, English, French) and selects the best natural voice
 * - Cancels previous speech immediately when a new command starts
 * - Supports pluggable CloudTTSProvider with automatic fallback to browser SpeechSynthesis API
 */
export class TextToSpeechEngine {
  private isSpeakingNow = false;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private activeOnEnd: (() => void) | null = null;
  private cloudProvider: CloudTTSProvider | null = null;
  private stateListeners = new Set<(speaking: boolean) => void>();

  public registerCloudProvider(provider: CloudTTSProvider | null): void {
    this.cloudProvider = provider;
  }

  public onSpeakingStateChange(listener: (speaking: boolean) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notifyState(speaking: boolean): void {
    this.isSpeakingNow = speaking;
    this.stateListeners.forEach((cb) => {
      try {
        cb(speaking);
      } catch {
        // ignore listener error
      }
    });
  }

  /**
   * Strips markdown symbols, code blocks, URLs, internal element IDs (#element_3),
   * and decorative emojis so TTS sounds like a natural human companion.
   */
  public cleanTextForSpeech(rawText: string): string {
    if (!rawText) return '';

    return rawText
      // Remove fenced code blocks
      .replace(/```[\s\S]*?```/g, ' ')
      // Remove inline code ticks
      .replace(/`([^`]+)`/g, '$1')
      // Remove URLs
      .replace(/https?:\/\/[^\s)]+/gi, ' ')
      // Remove internal DOM element identifiers like #element_12 or (element_4)
      .replace(/\(?#?element_\d+\)?/gi, ' ')
      // Remove markdown links [label](url) -> label
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove markdown formatting characters (*, _, #, ~, >, |)
      .replace(/[*_#~>|]/g, ' ')
      // Remove bullet prefixes
      .replace(/^\s*[-•❯]\s*/gm, ' ')
      // Remove emojis and pictographs
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ' '
      )
      // Collapse multiple spaces/newlines into natural pauses
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detects the primary language of the response so the synthesizer uses a matching voice.
   */
  public detectSpeechLanguage(text: string): 'ar' | 'en' | 'fr' {
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    if (arabicChars > 3) {
      return 'ar';
    }
    const lower = text.toLowerCase();
    if (
      /\b(voici|bonjour|cliquez|page|bouton|formulaire|connecter|télécharger)\b/.test(
        lower
      )
    ) {
      return 'fr';
    }
    return 'en';
  }

  private selectBestVoice(
    voices: SpeechSynthesisVoice[],
    lang: 'ar' | 'en' | 'fr'
  ): SpeechSynthesisVoice | undefined {
    if (!voices.length) return undefined;

    const scoreVoice = (v: SpeechSynthesisVoice): number => {
      const vLang = (v.lang || '').toLowerCase();
      const vName = (v.name || '').toLowerCase();
      let score = 0;

      if (lang === 'ar') {
        if (vLang.includes('ar-ma')) score += 100;
        else if (vLang.startsWith('ar')) score += 80;
        else if (vLang.startsWith('fr')) score += 20;
      } else if (lang === 'en') {
        if (vLang.startsWith('en-us') || vLang.startsWith('en-gb')) score += 90;
        else if (vLang.startsWith('en')) score += 75;
      } else if (lang === 'fr') {
        if (vLang.startsWith('fr-fr') || vLang.startsWith('fr-ma')) score += 90;
        else if (vLang.startsWith('fr')) score += 75;
      }

      if (score > 0) {
        if (vName.includes('natural') || vName.includes('online')) score += 25;
        if (vName.includes('google') || vName.includes('microsoft')) score += 15;
        if (!v.localService) score += 5;
      }

      return score;
    };

    const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    if (ranked[0] && scoreVoice(ranked[0]) > 0) {
      return ranked[0];
    }
    return voices.find((v) => v.default) || voices[0];
  }

  public speak(
    text: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
    }
  ): void {
    // Cancel any ongoing speech before starting a new response
    this.stop();

    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText) {
      options?.onEnd?.();
      return;
    }

    const detectedLang = this.detectSpeechLanguage(cleanText);

    const finishSpeaking = () => {
      if (this.safetyTimer) {
        clearTimeout(this.safetyTimer);
        this.safetyTimer = null;
      }
      const cb = this.activeOnEnd;
      this.activeOnEnd = null;
      this.notifyState(false);
      cb?.();
    };

    this.activeOnEnd = options?.onEnd || null;

    // 1. If a pluggable Cloud TTS provider is registered, try it first
    if (this.cloudProvider) {
      this.notifyState(true);
      options?.onStart?.();
      try {
        void Promise.resolve(
          this.cloudProvider.speak(cleanText, detectedLang, {
            onStart: () => {
              this.notifyState(true);
            },
            onEnd: () => {
              finishSpeaking();
            },
            onError: () => {
              this.speakWithBrowserSynthesis(
                cleanText,
                detectedLang,
                options?.onStart,
                finishSpeaking
              );
            },
          })
        );
        return;
      } catch {
        // Fallback to browser synthesis
      }
    }

    // 2. Default Browser SpeechSynthesis API
    this.speakWithBrowserSynthesis(
      cleanText,
      detectedLang,
      options?.onStart,
      finishSpeaking
    );
  }

  private speakWithBrowserSynthesis(
    cleanText: string,
    detectedLang: 'ar' | 'en' | 'fr',
    onStart?: () => void,
    finishSpeaking?: () => void
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      finishSpeaking?.();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices() || [];
      const selectedVoice = this.selectBestVoice(voices, detectedLang);

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang =
          detectedLang === 'ar'
            ? 'ar-MA'
            : detectedLang === 'fr'
            ? 'fr-FR'
            : 'en-US';
      }

      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        this.notifyState(true);
        onStart?.();
      };

      utterance.onend = () => {
        finishSpeaking?.();
      };

      utterance.onerror = () => {
        finishSpeaking?.();
      };

      // Safety timeout (max 20s) in case the OS SpeechSynthesis engine drops onend
      this.safetyTimer = setTimeout(() => {
        finishSpeaking?.();
      }, 20000);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[M3ak TTS Fallback]:', err);
      finishSpeaking?.();
    }
  }

  public stop(): void {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
    if (this.cloudProvider) {
      try {
        this.cloudProvider.stop();
      } catch {
        // ignore
      }
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore cancel errors
      }
    }
    if (this.activeOnEnd) {
      const cb = this.activeOnEnd;
      this.activeOnEnd = null;
      this.notifyState(false);
      cb();
    } else if (this.isSpeakingNow) {
      this.notifyState(false);
    }
  }

  public getIsSpeaking(): boolean {
    return this.isSpeakingNow;
  }
}

export const textToSpeech = new TextToSpeechEngine();
