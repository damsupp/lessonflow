import { LessonPlan, LessonSection, PedagogicalModelId } from '../types/lesson';

export interface ModelBlueprint {
  id: PedagogicalModelId;
  name: string;
  shortLabel: string;
  description: string;
  phases: {
    phaseName: string;
    weight: number;
    objectiveTemplate: (topic: string) => string;
    activityTemplate: (topic: string) => string;
    checkTemplate: (topic: string) => string;
  }[];
}

export const PEDAGOGICAL_MODELS: Record<PedagogicalModelId, ModelBlueprint> = {
  '5e_inquiry': {
    id: '5e_inquiry',
    name: '5E Inquiry Sequence',
    shortLabel: '5E Inquiry',
    description: 'Five-stage constructivist cycle: Engage, Explore, Explain, Elaborate, and Evaluate.',
    phases: [
      {
        phaseName: 'Engage: Phenomenon & Prior Knowledge Hook',
        weight: 0.12,
        objectiveTemplate: (topic) =>
          `Students will observe an anchoring phenomenon related to ${topic} and formulate a testable inquiry question.`,
        activityTemplate: (topic) =>
          `Present a discrepancy or real-world prompt on ${topic}. Students record initial observations and share partner hypotheses.`,
        checkTemplate: () =>
          'Quick poll of initial student predictions and baseline vocabulary check.',
      },
      {
        phaseName: 'Explore: Guided Investigation & Discovery',
        weight: 0.28,
        objectiveTemplate: (topic) =>
          `Students will collaboratively examine primary evidence or models of ${topic} to identify core patterns.`,
        activityTemplate: (topic) =>
          `Small groups manipulate data sets, diagrams, or manipulatives illustrating ${topic} while logging cause-and-effect relationships.`,
        checkTemplate: () =>
          'Circulate with observation checklist verifying group data collection logs.',
      },
      {
        phaseName: 'Explain: Concept Synthesis & Academic Framing',
        weight: 0.24,
        objectiveTemplate: (topic) =>
          `Students will articulate the governing principles of ${topic} using accurate domain terminology.`,
        activityTemplate: (topic) =>
          `Facilitate whole-class debrief connecting student discoveries to formal definitions and structured notes on ${topic}.`,
        checkTemplate: () =>
          'Think-Pair-Share oral explanation of the core mechanism in students’ own words.',
      },
      {
        phaseName: 'Elaborate: Transfer to Novel Contexts',
        weight: 0.24,
        objectiveTemplate: (topic) =>
          `Students will apply their understanding of ${topic} to solve a non-routine problem or real-world scenario.`,
        activityTemplate: (topic) =>
          `Students complete an application challenge requiring multi-step reasoning and justification using ${topic} principles.`,
        checkTemplate: () =>
          'Review written justification steps and peer cross-check of problem solutions.',
      },
      {
        phaseName: 'Evaluate: Mastery Check & Metacognitive Closure',
        weight: 0.12,
        objectiveTemplate: (topic) =>
          `Students will independently demonstrate mastery of ${topic} learning targets and self-assess confidence.`,
        activityTemplate: (topic) =>
          `Individual synthesis prompt and 3-question formative exit assessment on ${topic}.`,
        checkTemplate: () =>
          'Written exit ticket scored against lesson objective rubric.',
      },
    ],
  },
  gradual_release: {
    id: 'gradual_release',
    name: 'Gradual Release (I Do · We Do · You Do)',
    shortLabel: 'Gradual Release',
    description: 'Structured scaffolded instruction shifting cognitive load from teacher modeling to independent mastery.',
    phases: [
      {
        phaseName: 'Warm-Up: Retrieval Practice & Objective Framing',
        weight: 0.12,
        objectiveTemplate: (topic) =>
          `Students will retrieve prerequisite concepts and connect them to today's target skill in ${topic}.`,
        activityTemplate: (topic) =>
          `3-minute retrieval starter followed by unpacking the success criteria for ${topic}.`,
        checkTemplate: () =>
          'Scan warm-up responses to identify immediate prerequisite misconceptions.',
      },
      {
        phaseName: 'Direct Instruction (I Do): Explicit Modeling',
        weight: 0.22,
        objectiveTemplate: (topic) =>
          `Students will analyze worked examples of ${topic} and identify the critical decision steps.`,
        activityTemplate: (topic) =>
          `Teacher think-aloud demonstrating the step-by-step analytical process for ${topic} with annotated notes.`,
        checkTemplate: () =>
          'Cold-call process questions checking why each step was taken.',
      },
      {
        phaseName: 'Guided Practice (We Do): Collaborative Scaffolding',
        weight: 0.28,
        objectiveTemplate: (topic) =>
          `Students will co-construct solutions for ${topic} problems with peer and instructor feedback.`,
        activityTemplate: (topic) =>
          `Structured partner practice on tiered ${topic} prompts with immediate error analysis and whiteboard checks.`,
        checkTemplate: () =>
          'Whole-class mini-whiteboard show-me check before releasing to independent work.',
      },
      {
        phaseName: 'Independent Application (You Do): Deliberate Practice',
        weight: 0.26,
        objectiveTemplate: (topic) =>
          `Students will independently execute ${topic} tasks meeting all proficiency criteria without scaffolds.`,
        activityTemplate: (topic) =>
          `Silent or quiet independent problem set / writing task on ${topic} while teacher pulls targeted small group.`,
        checkTemplate: () =>
          'Spot-check Problem #2 and Problem #4 across student desks for accuracy.',
      },
      {
        phaseName: 'Closure & Exit Ticket: Evidence of Learning',
        weight: 0.12,
        objectiveTemplate: (topic) =>
          `Students will synthesize key takeaways and prove independent proficiency in ${topic}.`,
        activityTemplate: (topic) =>
          `Students complete an independent exit slip and summarize the most common pitfall to avoid in ${topic}.`,
        checkTemplate: () =>
          'Sort exit tickets into Mastery, Approaching, and Reteach piles for tomorrow.',
      },
    ],
  },
  workshop_seminar: {
    id: 'workshop_seminar',
    name: 'Studio Workshop & Socratic Seminar',
    shortLabel: 'Workshop Block',
    description: 'Discussion and production-focused structure ideal for humanities, writing, arts, and project studio.',
    phases: [
      {
        phaseName: 'Provocation & Textual / Studio Framing',
        weight: 0.15,
        objectiveTemplate: (topic) =>
          `Students will establish interpretive norms and annotate the central tension within ${topic}.`,
        activityTemplate: (topic) =>
          `Close reading or artifact inspection of ${topic} anchor piece; students mark two evidence citations.`,
        checkTemplate: () =>
          'Verify every student has annotated at least two textual/visual passages.',
      },
      {
        phaseName: 'Focused Mini-Lesson: Craft & Analytical Move',
        weight: 0.20,
        objectiveTemplate: (topic) =>
          `Students will examine a targeted analytical or compositional technique used in ${topic}.`,
        activityTemplate: (topic) =>
          `Brief demonstration of how to integrate counter-evidence or structural technique in ${topic}.`,
        checkTemplate: () =>
          'Quick partner paraphrase of the target craft move.',
      },
      {
        phaseName: 'Active Seminar / Independent Studio Production',
        weight: 0.45,
        objectiveTemplate: (topic) =>
          `Students will construct original arguments or studio artifacts addressing ${topic} supported by evidence.`,
        activityTemplate: (topic) =>
          `Sustained seminar dialogue or independent drafting session on ${topic} with individual teacher conferences.`,
        checkTemplate: () =>
          'Conference log and seminar participation tracker.',
      },
      {
        phaseName: 'Peer Critique & Revision Commitments',
        weight: 0.20,
        objectiveTemplate: (topic) =>
          `Students will evaluate peer work on ${topic} against rubric criteria and formulate one concrete revision step.`,
        activityTemplate: (topic) =>
          `Structured TAG (Tell, Ask, Give) peer review protocol and written next-step goal setting.`,
        checkTemplate: () =>
          'Written revision commitment submitted at end of class.',
      },
    ],
  },
  lab_investigation: {
    id: 'lab_investigation',
    name: 'Empirical Lab & Data Investigation',
    shortLabel: 'Lab Investigation',
    description: 'Hands-on experimental protocol covering hypothesis design, data collection, and error analysis.',
    phases: [
      {
        phaseName: 'Pre-Lab Briefing: Variables & Safety Protocol',
        weight: 0.16,
        objectiveTemplate: (topic) =>
          `Students will identify independent, dependent, and control variables for the ${topic} investigation.`,
        activityTemplate: (topic) =>
          `Review experimental apparatus, safety checkpoints, and hypothesis statement for ${topic}.`,
        checkTemplate: () =>
          'Sign-off on group variable table and safety readiness check.',
      },
      {
        phaseName: 'Experimental Procedure & Live Data Logging',
        weight: 0.44,
        objectiveTemplate: (topic) =>
          `Students will execute the experimental trials for ${topic} and record quantitative measurements accurately.`,
        activityTemplate: (topic) =>
          `Lab teams conduct 3 trials of the ${topic} protocol, recording raw measurements with proper units.`,
        checkTemplate: () =>
          'Audit raw data tables at each lab bench for unit consistency and repeatability.',
      },
      {
        phaseName: 'Data Visualization & Quantitative Analysis',
        weight: 0.24,
        objectiveTemplate: (topic) =>
          `Students will plot experimental results from ${topic} and calculate rate of change or percent error.`,
        activityTemplate: (topic) =>
          `Construct comparative graphs and compute summary statistics from the ${topic} trial data.`,
        checkTemplate: () =>
          'Check graph axes, scale intervals, and trendline interpretation.',
      },
      {
        phaseName: 'CER Debrief: Claim, Evidence & Reasoning',
        weight: 0.16,
        objectiveTemplate: (topic) =>
          `Students will defend an empirical conclusion about ${topic} citing quantitative lab evidence and error sources.`,
        activityTemplate: (topic) =>
          `Draft concise Claim-Evidence-Reasoning (CER) paragraph and clean lab station.`,
        checkTemplate: () =>
          'Collect individual CER conclusion cards.',
      },
    ],
  },
};

/**
 * Allocates an integer totalMinutes across N weights using the Largest Remainder (Hamilton) method.
 */
export function allocateExactMinutes(totalMinutes: number, weights: number[]): number[] {
  const cleanTotal = Math.floor(Number(totalMinutes));
  const count = weights.length;
  if (count === 0 || cleanTotal <= 0 || !Number.isFinite(cleanTotal)) {
    return weights.map(() => 0);
  }

  const weightSum = weights.reduce((acc, w) => acc + (w > 0 ? w : 1), 0);
  const normalizedWeights = weights.map((w) => (w > 0 ? w : 1) / weightSum);

  if (cleanTotal >= count) {
    const remainingToDistribute = cleanTotal - count;
    const exactExtras = normalizedWeights.map((w) => w * remainingToDistribute);
    const flooredExtras = exactExtras.map((val) => Math.floor(val));
    const currentSum = flooredExtras.reduce((a, b) => a + b, 0);
    let remainder = remainingToDistribute - currentSum;

    const indicesByRemainder = exactExtras
      .map((val, idx) => ({ idx, rem: val - flooredExtras[idx] }))
      .sort((a, b) => b.rem - a.rem || a.idx - b.idx);

    const allocation = flooredExtras.map((v) => v + 1);
    for (let i = 0; i < remainder; i++) {
      allocation[indicesByRemainder[i % count].idx] += 1;
    }
    return allocation;
  }

  const exact = normalizedWeights.map((w) => w * cleanTotal);
  const floored = exact.map((val) => Math.floor(val));
  let remainder = cleanTotal - floored.reduce((a, b) => a + b, 0);
  const indices = exact
    .map((val, idx) => ({ idx, rem: val - floored[idx] }))
    .sort((a, b) => b.rem - a.rem || a.idx - b.idx);

  for (let i = 0; i < remainder; i++) {
    floored[indices[i % count].idx] += 1;
  }
  return floored;
}

export function buildSectionsFromModel(
  modelId: PedagogicalModelId,
  topic: string,
  totalMinutes: number
): LessonSection[] {
  const blueprint = PEDAGOGICAL_MODELS[modelId] || PEDAGOGICAL_MODELS['5e_inquiry'];
  const cleanTopic = topic.trim() || 'Core Curriculum Concept';
  const weights = blueprint.phases.map((p) => p.weight);
  const exactMinutes = allocateExactMinutes(totalMinutes, weights);

  return blueprint.phases.map((phase, idx) => ({
    id: `sec-${idx + 1}-${Date.now().toString(36)}`,
    index: idx + 1,
    phaseName: phase.phaseName,
    minutes: exactMinutes[idx],
    weight: phase.weight,
    learningObjective: phase.objectiveTemplate(cleanTopic),
    instructionalActivities: phase.activityTemplate(cleanTopic),
    formativeCheck: phase.checkTemplate(cleanTopic),
  }));
}

export function rebalanceSectionsToTotal(
  sections: LessonSection[],
  newTotalMinutes: number
): LessonSection[] {
  if (sections.length === 0) return [];
  const weights = sections.map((s) => (s.minutes > 0 ? s.minutes : s.weight || 1));
  const allocated = allocateExactMinutes(newTotalMinutes, weights);
  return sections.map((sec, idx) => ({
    ...sec,
    index: idx + 1,
    minutes: allocated[idx],
    weight: newTotalMinutes > 0 ? allocated[idx] / newTotalMinutes : sec.weight,
  }));
}

export function adjustSectionMinutesPreservingTotal(
  sections: LessonSection[],
  targetId: string,
  desiredMinutes: number,
  totalMinutes: number
): LessonSection[] {
  const count = sections.length;
  if (count <= 1) {
    return sections.map((s) => ({ ...s, minutes: totalMinutes }));
  }

  const targetIdx = sections.findIndex((s) => s.id === targetId);
  if (targetIdx === -1) return sections;

  const minAllowed = totalMinutes >= count ? 1 : 0;
  const maxAllowed = Math.max(minAllowed, totalMinutes - (count - 1) * minAllowed);
  const clampedTarget = Math.max(minAllowed, Math.min(maxAllowed, Math.round(desiredMinutes)));

  const currentMinutes = sections.map((s) => s.minutes);
  let diff = clampedTarget - currentMinutes[targetIdx];
  if (diff === 0) return sections;

  currentMinutes[targetIdx] = clampedTarget;

  let remainingToAdjust = -diff;
  let safetyCounter = 0;

  while (remainingToAdjust !== 0 && safetyCounter < 500) {
    safetyCounter++;
    let changedInPass = false;
    for (let offset = 1; offset < count; offset++) {
      if (remainingToAdjust === 0) break;
      const otherIdx = (targetIdx + offset) % count;
      if (remainingToAdjust > 0) {
        currentMinutes[otherIdx] += 1;
        remainingToAdjust -= 1;
        changedInPass = true;
      } else if (remainingToAdjust < 0 && currentMinutes[otherIdx] > minAllowed) {
        currentMinutes[otherIdx] -= 1;
        remainingToAdjust += 1;
        changedInPass = true;
      }
    }
    if (!changedInPass) break;
  }

  return sections.map((s, idx) => ({
    ...s,
    index: idx + 1,
    minutes: currentMinutes[idx],
    weight: totalMinutes > 0 ? currentMinutes[idx] / totalMinutes : s.weight,
  }));
}

export function formatMinuteWindow(startMin: number, durationMin: number): string {
  const endMin = startMin + durationMin;
  const fmt = (m: number) => `${String(m).padStart(2, '0')}:00`;
  return `${fmt(startMin)} – ${fmt(endMin)}`;
}

export const INITIAL_DEFAULT_PLAN: LessonPlan = {
  id: 'plan-cellular-energetics-01',
  title: 'Cellular Respiration & ATP Energy Transfer',
  subject: 'Science: Biology & Life Sciences',
  gradeLevel: 'Grade 10',
  date: new Date().toISOString().slice(0, 10),
  totalMinutes: 50,
  modelId: '5e_inquiry',
  standardCode: 'NGSS HS-LS1-7',
  essentialQuestion: 'How do living cells harvest chemical energy stored in organic molecules to power cellular work?',
  materials: 'Cellular respirometer data sheets, molecular ATP/ADP models, graphing calculators, exit slip cards.',
  sections: buildSectionsFromModel(
    '5e_inquiry',
    'Cellular Respiration & ATP Energy Transfer',
    50
  ),
  updatedAt: new Date().toISOString(),
};

export const SAMPLE_PRESET_PLANS: LessonPlan[] = [
  INITIAL_DEFAULT_PLAN,
  {
    id: 'plan-linear-functions-02',
    title: 'Linear Functions & Rate of Change Modeling',
    subject: 'Mathematics: Algebra & Functions',
    gradeLevel: 'Grade 8',
    date: new Date().toISOString().slice(0, 10),
    totalMinutes: 45,
    modelId: 'gradual_release',
    standardCode: 'CCSS.MATH.8.F.B.4',
    essentialQuestion: 'How do slope and y-intercept represent real-world initial conditions and constant rates of change?',
    materials: 'Coordinate grid whiteboards, dry-erase markers, Desmos offline graphing tables, tiered problem sets.',
    sections: buildSectionsFromModel(
      'gradual_release',
      'Linear Functions & Rate of Change Modeling',
      45
    ),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan-harlem-renaissance-03',
    title: 'Rhythm & Resistance in Harlem Renaissance Poetry',
    subject: 'English Language Arts & Literature',
    gradeLevel: 'Grade 11',
    date: new Date().toISOString().slice(0, 10),
    totalMinutes: 60,
    modelId: 'workshop_seminar',
    standardCode: 'CCSS.ELA-LITERACY.RL.11-12.4',
    essentialQuestion: 'How did poets of the Harlem Renaissance use jazz cadence and vernacular form to redefine American identity?',
    materials: 'Annotated anthology packets (Langston Hughes, Claude McKay, Countee Cullen), seminar rubric.',
    sections: buildSectionsFromModel(
      'workshop_seminar',
      'Rhythm & Resistance in Harlem Renaissance Poetry',
      60
    ),
    updatedAt: new Date().toISOString(),
  },
];
