import type { StarterScaffold } from "@/types";

// ============================================================
// 説明ビルダー：各入力欄の内容から、AIに送る説明文を合成する
// ============================================================

/** スロットIDごとの自然な書き出し（合成時の接続詞） */
const SLOT_PREFIX: Record<string, string> = {
  purpose: "この文法は、",
  decision: "見分け方は、",
  example: "例文で説明すると、",
  warning: "注意点は、",
  misconception: "AIが間違えそうな点は、",
};

/**
 * ガイド付きモードの各入力欄（slots）を、1つの説明文に合成する。
 * - scaffold があれば explanationSlots の順序で並べる
 * - 既知のIDには自然な接続詞を、未知のIDにはラベルを前置きする
 * - 空欄はスキップする
 */
export function buildTeachingExplanation(
  slots: Record<string, string>,
  scaffold?: StarterScaffold
): string {
  const order = scaffold?.explanationSlots.map((s) => s.id) ?? Object.keys(slots);

  const lines = order
    .map((id) => {
      const value = slots[id]?.trim();
      if (!value) return null;
      const slot = scaffold?.explanationSlots.find((s) => s.id === id);
      const prefix = SLOT_PREFIX[id] ?? (slot ? `${slot.label}：` : "");
      return `${prefix}${value}`;
    })
    .filter((line): line is string => Boolean(line));

  return lines.join("\n");
}
