import type { GrammarUnit, MCQuestion } from "@/types";
import type { CurriculumDocument, CurriculumQuestion } from "./types";
import { assertValidCurriculum } from "./validation";

export function loadCurriculum(value: unknown): CurriculumDocument {
  assertValidCurriculum(value);
  return value;
}

/** Adapter for screens and APIs that still consume the legacy GrammarUnit shape. */
export function toGrammarUnit(doc: CurriculumDocument, unitId: string): GrammarUnit | undefined {
  const unit = doc.units.find((candidate) => candidate.id === unitId);
  if (!unit) return undefined;
  const convert = (q: CurriculumQuestion, index: number): MCQuestion => ({
    id: index + 1,
    sentence: q.prompt,
    choices: q.choices,
    answerLabel: q.answer,
    explanation: q.explanation,
    hint: q.hint,
    commonMistake: q.misconceptionRationale && q.misconceptionChoiceLabel
      ? { label: q.misconceptionChoiceLabel, misconception: q.misconceptionRationale }
      : undefined,
    requiredTopics: q.knowledgeIds.map((id) => unit.knowledge.findIndex((k) => k.id === id)).filter((i) => i >= 0),
  });
  const byId = new Map(unit.questionBank.map((q, index) => [q.id, convert(q, index)]));
  const selectedPractice = unit.practiceQuestionIds?.map((id) => byId.get(id)).filter((q): q is MCQuestion => Boolean(q));
  const selectedAssessment = unit.assessmentQuestionIds?.map((id) => byId.get(id)).filter((q): q is MCQuestion => Boolean(q));
  const questions = unit.questionBank.map(convert);
  return {
    id: unit.id,
    name: unit.title,
    description: unit.description,
    teachingGuide: {
      assumedKnowledge: (unit.prerequisiteKnowledge ?? []).map((item) => item.label),
      coverageTopics: unit.knowledge.map((item) => item.label),
      thinkingPrompts: unit.knowledge.map((item) => item.description),
      knowledgeTopicIds: unit.knowledge.map((item) => item.id),
    },
    practiceQuestions: selectedPractice ?? questions.slice(0, unit.sampling.practiceCount),
    testQuestions: selectedAssessment ?? questions.slice(unit.sampling.practiceCount, unit.sampling.practiceCount + unit.sampling.testCount),
  };
}
