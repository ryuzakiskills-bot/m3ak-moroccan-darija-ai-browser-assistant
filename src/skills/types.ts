import {
  AIActionResponse,
  CompletedStepRecord,
  ExplanationDepth,
  PageContext,
  SkillId,
} from '../shared/types';
import { GatheredCompanionContext } from '../context-engine/context-engine';

export interface SkillExecutionParams {
  userRequest: string;
  gatheredContext: GatheredCompanionContext;
  pageContext?: PageContext | null;
  currentStep?: number;
  completedSteps?: CompletedStepRecord[];
}

export interface CompanionSkill {
  id: SkillId;
  label: string;
  description: string;
  buildSkillDirectives: (depth: ExplanationDepth) => string;
  executeFallback: (params: SkillExecutionParams) => AIActionResponse | null;
}
