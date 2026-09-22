import type { GrammarUnit, MCQuestion } from "@/types";

/** Apply the teacher's immutable session scope to every learner-facing use of a unit. */
export function scopeUnit(
  unit: GrammarUnit,
  selectedKnowledgeIds: unknown,
): GrammarUnit {
  if (!Array.isArray(selectedKnowledgeIds) || !selectedKnowledgeIds.every((id) => typeof id === "string")) {
    throw new Error("Invalid selected knowledge IDs");
  }

  const selected = new Set(selectedKnowledgeIds);
  const topicIds = unit.teachingGuide.knowledgeTopicIds ??
    unit.teachingGuide.coverageTopics.map((_, index) => `${unit.id}.legacy-topic.${index}`);
  const keptIndices = topicIds.flatMap((id, index) => selected.has(id) ? [index] : []);
  const newIndexByOldIndex = new Map(keptIndices.map((oldIndex, index) => [oldIndex, index]));
  const scopedQuestions = (questions: MCQuestion[]) => questions
    .filter((question) =>
      question.requiredTopics?.length &&
      question.requiredTopics.every((index) => newIndexByOldIndex.has(index)))
    .map((question) => ({
      ...question,
      requiredTopics: question.requiredTopics!.map((index) => newIndexByOldIndex.get(index)!),
    }));

  return {
    ...unit,
    teachingGuide: {
      ...unit.teachingGuide,
      coverageTopics: keptIndices.map((index) => unit.teachingGuide.coverageTopics[index]),
      thinkingPrompts: keptIndices.map((index) => unit.teachingGuide.thinkingPrompts[index]),
      knowledgeTopicIds: keptIndices.map((index) => topicIds[index]),
    },
    practiceQuestions: scopedQuestions(unit.practiceQuestions),
    testQuestions: scopedQuestions(unit.testQuestions),
  };
}

export function selectedKnowledgeIdsFromDb(value: string | null, unit: GrammarUnit): string[] {
  if (value === null) {
    return unit.teachingGuide.knowledgeTopicIds ??
      unit.teachingGuide.coverageTopics.map((_, index) => `${unit.id}.legacy-topic.${index}`);
  }
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
    throw new Error("Invalid selected knowledge IDs in session config");
  }
  return parsed;
}
