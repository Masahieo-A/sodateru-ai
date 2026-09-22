/** A stable reference to one teachable concept in a grammar unit. */
export type KnowledgeTopicRef = {
  unitId: string;
  topicIndex: number;
  topic: string;
  ref: string;
};

export type AiInferenceConfirmation = "confirmed" | "corrected";

/** Evidence that the AI formed and the learner reviewed an inference. */
export type AiLearningEvidence = {
  id: string;
  topicRef: KnowledgeTopicRef;
  inferredRule: string;
  learnerResponse: AiInferenceConfirmation;
  correction?: string;
  revision: number;
  createdAt: string;
};

/** Independent evidence; intentionally never inferred from an AI response. */
export type MasteryEvidence = {
  id: string;
  topicRef: KnowledgeTopicRef;
  checkQuestion: string;
  selectedAnswer: string;
  expectedAnswer: string;
  isCorrect: boolean;
  createdAt: string;
};

export type IndependentCheck = {
  questionId: number;
  prompt: string;
  choices: { label: string; text: string }[];
  answerLabel: string;
};
