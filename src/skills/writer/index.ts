import { CompanionSkill } from '../types';

export const writerSkill: CompanionSkill = {
  id: 'writer',
  label: 'Writer',
  description:
    'Drafts emails, internship (stage) applications, messages, cover letters, CV sections, and professional copy.',
  buildSkillDirectives: () =>
    `
SKILL: WRITER
- Draft ready-to-use, well-structured text (email, message, cover letter, CV summary, or post) tailored to the user's request.
- Briefly introduce the draft in natural Darija (or the user's language), then provide the clean text they can copy/use.
`.trim(),
  executeFallback: ({ userRequest, gatheredContext }) => {
    const lower = userRequest.toLowerCase();
    const isStageOrJob = /(?:سطاج|خدمة|عمل|\bstage\b|\binternship\b|\bemploi\b|\bcv\b)/i.test(
      lower
    );
    const isFriendMsg = /(?:صاحبي|صديق|رسالة|\bfriend\b|\bmessage\b)/i.test(lower);

    if (isStageOrJob) {
      const wantsEnglish = /(?:إنجليزية|انجليزية|\benglish\b)/i.test(lower);
      const draft = wantsEnglish
        ? `مزيان، ها هو إيميل احترافي واجد لطلب Stage باللونغلي:\nSubject: Internship Application — [Your Name]\nDear Hiring Team,\nI am writing to express my strong interest in joining your team as an intern. I am eager to contribute to your projects and apply my technical skills. Please find my CV attached.\nBest regards,\n[Your Name]`
        : `مزيان، ها هو إيميل احترافي واجد باش تطلب Stage:\nObjet : Candidature pour un stage — [الإسم ديالك]\nMadame, Monsieur,\nActuellement étudiant(e), je souhaite intégrer votre équipe dans le cadre d'un stage afin de mettre en pratique mes compétences. Vous trouverez ci-joint mon CV.\nCordialement,\n[الإسم ورقم الهاتف]`;

      return {
        message: draft,
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        intent: 'WRITING',
        skillId: 'writer',
        skillLabel: 'Writer',
        explanationDepth: gatheredContext.routedIntent.explanationDepth,
        topic: 'Internship Email Draft',
      };
    }

    if (isFriendMsg) {
      return {
        message:
          'واخا، ها هي رسالة زوينة ومختصرة: "السلام خويا، نتمنى تكون بخير وعلى خير! بغيت غير نسول فيك ونشوف فوقاش نقدرو نتلاقاو هاد السيمانة إن شاء الله."',
        action: 'none',
        targetElementId: null,
        requiresConfirmation: false,
        taskCompleted: true,
        intent: 'WRITING',
        skillId: 'writer',
        skillLabel: 'Writer',
        explanationDepth: gatheredContext.routedIntent.explanationDepth,
        topic: 'Message Draft',
      };
    }

    return {
      message:
        'خليها عليا. ها هي صياغة احترافية واجدة: حدد غير السمية والتفاصيل الأساسية، وإلا بغيتي نرجعها بالفرنسية أو الإنجليزية قولها ليا.',
      action: 'none',
      targetElementId: null,
      requiresConfirmation: false,
      taskCompleted: true,
      intent: 'WRITING',
      skillId: 'writer',
      skillLabel: 'Writer',
      explanationDepth: gatheredContext.routedIntent.explanationDepth,
      topic: 'Writing Draft',
    };
  },
};
