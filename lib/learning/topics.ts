import type { GrammarUnit } from "@/types";
import type { IndependentCheck, KnowledgeTopicRef } from "@/types/learning";

export function topicRefFor(unit: GrammarUnit, topicIndex: number): KnowledgeTopicRef {
  const topic = unit.teachingGuide.coverageTopics[topicIndex] ?? "学習内容";
  return { unitId: unit.id, topicIndex, topic, ref: `${unit.id}:topic:${topicIndex}` };
}

/** Deterministic learner-facing check: the first test item mapped to the topic. */
export function independentCheckFor(unit: GrammarUnit, topicIndex: number): IndependentCheck | null {
  const question = unit.testQuestions.find((q) => q.requiredTopics?.includes(topicIndex));
  if (!question) return null;
  return {
    questionId: question.id,
    prompt: question.sentence,
    choices: question.choices,
    answerLabel: question.answerLabel,
  };
}

export function fallbackInference(unit: GrammarUnit, topicIndex: number, dialogue: string): string {
  const topic = unit.teachingGuide.coverageTopics[topicIndex] ?? "この単元のポイント";
  const excerpt = dialogue.trim().slice(-180);
  return excerpt
    ? `「${topic}」について、あなたの説明をもとに、${excerpt}という点が判断の手がかりだと理解しました。`
    : `「${topic}」では、先行詞や文の役割を確認して使い分ける、と理解しました。`;
}

export function isValidTopic(unit: GrammarUnit, topicIndex: number): boolean {
  return Number.isInteger(topicIndex) && topicIndex >= 0 && topicIndex < unit.teachingGuide.coverageTopics.length;
}
