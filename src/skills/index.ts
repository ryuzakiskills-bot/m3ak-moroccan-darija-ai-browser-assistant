import { SkillId } from '../shared/types';
import { CompanionSkill } from './types';
import { generalKnowledgeSkill } from './general';
import { tutorSkill } from './tutor';
import { webpageAnalyzerSkill, formAssistantSkill } from './webpage';
import { visualGuideSkill, browserNavigationSkill } from './navigation';
import { writerSkill } from './writer';
import { translatorSkill } from './translator';
import { summarizerSkill, documentAssistantSkill } from './summarizer';
import { codingAssistantSkill } from './coding';
import { problemSolverSkill } from './problem-solver';
import { plannerSkill } from './planner';
import { researchAssistantSkill, decisionSupportSkill } from './researcher';

/**
 * Extensible Modular Skill Registry
 * Holds all 15 built-in Universal Companion Skills and allows registering additional skills dynamically.
 */
class SkillRegistry {
  private skills = new Map<SkillId, CompanionSkill>();

  constructor() {
    const initialSkills: CompanionSkill[] = [
      generalKnowledgeSkill,
      tutorSkill,
      webpageAnalyzerSkill,
      visualGuideSkill,
      writerSkill,
      translatorSkill,
      summarizerSkill,
      codingAssistantSkill,
      problemSolverSkill,
      plannerSkill,
      researchAssistantSkill,
      documentAssistantSkill,
      formAssistantSkill,
      browserNavigationSkill,
      decisionSupportSkill,
    ];

    for (const skill of initialSkills) {
      this.skills.set(skill.id, skill);
    }
  }

  public registerSkill(skill: CompanionSkill): void {
    this.skills.set(skill.id, skill);
  }

  public getSkill(id: SkillId): CompanionSkill {
    return this.skills.get(id) || generalKnowledgeSkill;
  }

  public getAllSkills(): CompanionSkill[] {
    return Array.from(this.skills.values());
  }
}

export const skillRegistry = new SkillRegistry();
