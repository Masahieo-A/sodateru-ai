/** JSON-first curriculum model. Keep IDs stable once published. */
export const CURRICULUM_SCHEMA_VERSION = "1.0.0" as const;

export type SourceRef = {
  id: string;
  title: string;
  kind: "textbook" | "teacher-note" | "open-resource" | "original";
  locator?: string;
  url?: string;
  checkedAt?: string;
  publisher?: string;
  edition?: string;
  page?: string;
};

export type KnowledgeItem = {
  id: string;
  label: string;
  description: string;
  prerequisites?: string[];
  sourceRefs?: string[];
  sourceRefDetails?: unknown[];
};

export type CurriculumChoice = { label: string; text: string };

export type CurriculumQuestion = {
  id: string;
  type: "multiple-choice";
  prompt: string;
  choices: CurriculumChoice[];
  answer: string;
  explanation?: string;
  hint?: string;
  knowledgeIds: string[];
  eligibility?: "practice" | "assessment" | "both";
  misconceptionRationale?: string;
  misconceptionChoiceLabel?: string;
  rubricCriteriaIds?: string[];
  answerAmbiguity?: { status: "unique" | "ambiguous"; note?: string };
  /** Explicit semantic classification for questions where categories might overlap. */
  answerAnalysis?: {
    target: string;
    choiceClassifications: Record<string, string>;
    rationale: string;
  };
  sourceRefs?: string[];
  difficulty?: "intro" | "standard" | "challenge";
  sourceRefDetails?: unknown[];
};

export type SamplingPolicy = {
  practiceCount: number;
  testCount: number;
  minKnowledgeCoverage?: number;
  avoidRepeatingQuestionIds?: boolean;
  perKnowledgeMinimums?: Record<string, { practice: number; assessment: number }>;
  deterministicSeedStrategy?: "session-unit-v1" | "fixed" | "none";
};

export type CurriculumUnit = {
  id: string;
  title: string;
  description: string;
  knowledge: KnowledgeItem[];
  prerequisiteKnowledge?: KnowledgeItem[];
  questionBank: CurriculumQuestion[];
  sampling: SamplingPolicy;
  sourceRefs?: string[];
  sourceRefDetails?: unknown[];
  practiceQuestionIds?: string[];
  assessmentQuestionIds?: string[];
};

export type CurriculumDocument = {
  schemaVersion: typeof CURRICULUM_SCHEMA_VERSION;
  curriculumId: string;
  title: string;
  language: "ja" | "en" | "ja-en";
  sources: SourceRef[];
  rubricCriteria: { id: string; label: string; description: string }[];
  units: CurriculumUnit[];
};
