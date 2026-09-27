import {
  ExplanationDepth,
  SkillId,
  UniversalIntentCategory,
} from '../shared/types';

export interface ConversationTurn {
  role: 'user' | 'ai';
  text: string;
  topic?: string;
  intent?: UniversalIntentCategory;
  skillId?: SkillId;
  targetElementId?: string | null;
  timestamp: number;
}

export interface ConversationMemorySnapshot {
  activeTopic: string | null;
  activeSkillId: SkillId | null;
  activeIntent: UniversalIntentCategory | null;
  preferredDepth: ExplanationDepth;
  lastTargetElementId: string | null;
  lastSelectedText: string;
  recentTurns: ConversationTurn[];
}

/**
 * Conversational Memory Engine
 * Tracks what the user is currently trying to accomplish, previous questions & answers,
 * active topic (so "وعلاش كنحتاجوه؟" or "عطيني example" or "بسطها ليا" naturally continues the topic),
 * selected text, and explanation depth preferences.
 */
export class ConversationMemoryManager {
  private activeTopic: string | null = null;
  private activeSkillId: SkillId | null = null;
  private activeIntent: UniversalIntentCategory | null = null;
  private preferredDepth: ExplanationDepth = 'NORMAL';
  private lastTargetElementId: string | null = null;
  private lastSelectedText = '';
  private recentTurns: ConversationTurn[] = [];
  private maxTurns = 10;

  public getSnapshot(): ConversationMemorySnapshot {
    return {
      activeTopic: this.activeTopic,
      activeSkillId: this.activeSkillId,
      activeIntent: this.activeIntent,
      preferredDepth: this.preferredDepth,
      lastTargetElementId: this.lastTargetElementId,
      lastSelectedText: this.lastSelectedText,
      recentTurns: [...this.recentTurns],
    };
  }

  public recordUserTurn(params: {
    text: string;
    topic?: string;
    intent?: UniversalIntentCategory;
    skillId?: SkillId;
    depth?: ExplanationDepth;
    selectedText?: string;
  }): void {
    if (params.topic && params.topic.trim()) {
      this.activeTopic = params.topic.trim();
    }
    if (params.intent) {
      this.activeIntent = params.intent;
    }
    if (params.skillId) {
      this.activeSkillId = params.skillId;
    }
    if (params.depth) {
      this.preferredDepth = params.depth;
    }
    if (params.selectedText && params.selectedText.trim()) {
      this.lastSelectedText = params.selectedText.trim().slice(0, 1200);
    }

    this.recentTurns.push({
      role: 'user',
      text: params.text.trim(),
      topic: this.activeTopic || undefined,
      intent: params.intent,
      skillId: params.skillId,
      timestamp: Date.now(),
    });

    if (this.recentTurns.length > this.maxTurns) {
      this.recentTurns = this.recentTurns.slice(-this.maxTurns);
    }
  }

  public recordAITurn(params: {
    text: string;
    topic?: string;
    intent?: UniversalIntentCategory;
    skillId?: SkillId;
    targetElementId?: string | null;
  }): void {
    if (params.topic && params.topic.trim()) {
      this.activeTopic = params.topic.trim();
    }
    if (params.intent) {
      this.activeIntent = params.intent;
    }
    if (params.skillId) {
      this.activeSkillId = params.skillId;
    }
    if (params.targetElementId !== undefined) {
      this.lastTargetElementId = params.targetElementId;
    }

    this.recentTurns.push({
      role: 'ai',
      text: params.text.trim(),
      topic: this.activeTopic || undefined,
      intent: params.intent,
      skillId: params.skillId,
      targetElementId: params.targetElementId,
      timestamp: Date.now(),
    });

    if (this.recentTurns.length > this.maxTurns) {
      this.recentTurns = this.recentTurns.slice(-this.maxTurns);
    }
  }

  public clear(): void {
    this.activeTopic = null;
    this.activeSkillId = null;
    this.activeIntent = null;
    this.preferredDepth = 'NORMAL';
    this.lastTargetElementId = null;
    this.lastSelectedText = '';
    this.recentTurns = [];
  }
}

export const conversationMemory = new ConversationMemoryManager();
