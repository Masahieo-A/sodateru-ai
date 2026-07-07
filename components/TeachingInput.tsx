"use client";

import { GrammarUnit } from "@/types";
import { useState } from "react";
import { ExplanationBuilder } from "@/components/ExplanationBuilder";

type Props = {
  unit: GrammarUnit;
  onSubmit: (explanation: string) => void;
  isLoading: boolean;
  initialValue?: string;
};

/** 教え方ガイド：折りたたみパネル */
function TeachingGuidePanel({ unit }: { unit: GrammarUnit }) {
  const [open, setOpen] = useState(true);
  const { teachingGuide } = unit;

  return (
    <div className="rounded-xl border border-indigo-200 overflow-hidden">
      {/* ヘッダー（クリックで開閉） */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <span className="text-sm font-bold text-indigo-700">教え方ガイド</span>
          <span className="text-xs text-indigo-400 font-normal">（範囲確認 ＋ 考え方のヒント）</span>
        </div>
        <span className="text-indigo-400 text-xs font-medium">
          {open ? "▲ 閉じる" : "▼ 開く"}
        </span>
      </button>

      {open && (
        <div className="bg-white px-4 pb-4 pt-3 space-y-4">
          {/* AIの前提知識 */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              🧠 AIがすでに知っていること（説明しなくてOK）
            </p>
            <ul className="space-y-1">
              {teachingGuide.assumedKnowledge.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="mt-0.5 flex-shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="h-px bg-gray-100" />

          {/* 出題トピック（スコープ確認） */}
          <div>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
              📝 出題されるトピック
            </p>
            <p className="text-xs text-indigo-400 mb-2">
              これらをすべてカバーできているか、書きながら確認しよう
            </p>
            <ul className="space-y-1.5">
              {teachingGuide.coverageTopics.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="mt-0.5 text-indigo-300 flex-shrink-0 font-bold">□</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="h-px bg-gray-100" />

          {/* 考え方のヒント */}
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
              💡 考えてみよう
            </p>
            <p className="text-xs text-amber-400 mb-2">
              答えは自分で考えて！説明を組み立てる視点のヒントです
            </p>
            <ul className="space-y-2">
              {teachingGuide.thinkingPrompts.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-amber-50 rounded-lg px-3 py-2">
                  <span className="mt-0.5 text-amber-400 flex-shrink-0 font-bold">Q.</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function TeachingInput({
  unit,
  onSubmit,
  isLoading,
  initialValue = "",
}: Props) {
  return (
    <div className="space-y-4">
      {/* AIからのメッセージ */}
      <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
        <div className="flex items-start gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <p className="font-bold text-indigo-800">AIより</p>
            <p className="text-indigo-700 text-sm mt-1 leading-relaxed">
              「{unit.name}」のこと、まだきちんと分かっていません。
              下のステップに沿って、基本ルールをまとめて教えてください！
              そのあと、先生（あなた）の説明だけを使って練習問題に挑戦し、分からないところを質問します。
              一緒に学んでいきましょう。
            </p>
          </div>
        </div>
      </div>

      {/* 教え方ガイドパネル */}
      <TeachingGuidePanel unit={unit} />

      {/* 説明ビルダー（ガイド付き / 標準 / 自由記述） */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          ✏️ AIに「{unit.name}」を教えてください
        </label>
        <ExplanationBuilder
          unit={unit}
          onSubmit={onSubmit}
          isLoading={isLoading}
          initialValue={initialValue}
        />
      </div>
    </div>
  );
}
