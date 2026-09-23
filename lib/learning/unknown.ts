import type { LessonMessage } from "../../types/index";

/** An explicit "I don't know" stays unresolved until later teacher text supports the rule. */
export function unresolvedUnknown(
  dialogue: LessonMessage[],
  topicIndex: number,
  evidence?: string,
): boolean {
  const unknownAt = dialogue.findLastIndex((message) =>
    message.role === "teacher" && message.unknownTopics?.includes(topicIndex),
  );
  if (unknownAt < 0) return false;
  if (!evidence) return true;
  const normalize = (value: string) => value.toLowerCase()
    .replace(/[\s、。，．,.!?！？…・:：;；\-ー「」『』（）()"'’‘”“]/g, "");
  const laterTeaching = normalize(dialogue.slice(unknownAt + 1)
    .filter((message) => message.role === "teacher")
    .map((message) => message.content).join("\n"));
  return !laterTeaching.includes(normalize(evidence));
}
