"use client";

import { useEffect, useMemo, useState } from "react";
import type { GrammarUnit } from "@/types";
import { buildTeachingExplanation } from "@/lib/teaching";

type Mode = "guided" | "standard" | "free";

type Props = {
  unit: GrammarUnit;
  onSubmit: (explanation: string) => void;
  isLoading: boolean;
  initialValue?: string;
  /** 教師がモードを固定したい場合に指定（指定時はモード切替を隠す） */
  lockedMode?: Mode;
};

const MIN_FREE_LEN = 20;

// localStorage キー（単元ごとに「過去に教えたことがあるか」を記録）
const taughtKey = (unitId: string) => `sodateru_taught_${unitId}`;

// ============================================================
// 教え方チェックリスト（coverageTopics を手動チェック）
// ============================================================
function TeachingChecklist({ topics }: { topics: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => topics.map(() => false));
  const doneCount = checked.filter(Boolean).length;

  return (
    <div className="rounded-xl border border-emerald-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-emerald-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">✅</span>
          <span className="text-sm font-bold text-emerald-700">教え方チェックリスト</span>
        </div>
        <span className="text-xs font-bold text-emerald-600">
          {doneCount} / {topics.length}
        </span>
      </div>
      <div className="bg-white px-4 py-3 space-y-1.5">
        <p className="text-xs text-emerald-500 mb-2">
          説明できたものにチェック。全部に触れられているか自分で確認しよう。
        </p>
        {topics.map((topic, i) => (
          <label
            key={i}
            className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer py-1"
          >
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() =>
                setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
              }
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-emerald-500"
            />
            <span className={checked[i] ? "line-through text-gray-400" : ""}>
              {topic}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 弱い説明・良い説明の比較（折りたたみ）
// ============================================================
function WorkedExamplePanel({ unit }: { unit: GrammarUnit }) {
  const [open, setOpen] = useState(false);
  const we = unit.starterScaffold?.workedExample;
  if (!we) return null;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-sm font-bold text-gray-600">
          💡 説明例を見る（弱い例 / 良い例）
        </span>
        <span className="text-gray-400 text-xs font-medium">
          {open ? "▲ 閉じる" : "▼ 開く"}
        </span>
      </button>
      {open && (
        <div className="bg-white px-4 py-3 space-y-3">
          <p className="text-xs text-gray-400">
            答えを写すのではなく、「良い説明には何が入っているか」を確かめる用です。
          </p>
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-xs font-bold text-red-500 mb-1">△ 弱い説明</p>
            <p className="text-sm text-gray-600 leading-relaxed">{we.weak}</p>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
            <p className="text-xs font-bold text-green-600 mb-1">◎ 良い説明</p>
            <p className="text-sm text-gray-700 leading-relaxed">{we.strong}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="text-xs font-bold text-amber-600 mb-1">なぜ良いのか</p>
            <p className="text-sm text-gray-700 leading-relaxed">{we.commentary}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ガイド付きモードの入力欄1つ
// ============================================================
function ExplanationSlotCard({
  index,
  label,
  prompt,
  placeholder,
  required,
  value,
  onChange,
  disabled,
}: {
  index: number;
  label: string;
  prompt: string;
  placeholder: string;
  required: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
          {index}
        </span>
        <span className="text-sm font-bold text-gray-800">{label}</span>
        {required ? (
          <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
            必須
          </span>
        ) : (
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            任意
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 pl-8">{prompt}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
        className="w-full p-2.5 border border-gray-200 rounded-lg text-gray-800 text-sm
          focus:outline-none focus:border-indigo-400 transition-colors
          disabled:bg-gray-50 disabled:text-gray-400 resize-none leading-relaxed"
      />
    </div>
  );
}

// ============================================================
// モード切替タブ
// ============================================================
function ModeTabs({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const tabs: { id: Mode; label: string; hint: string }[] = [
    { id: "guided", label: "ガイド付き", hint: "穴埋めで作る" },
    { id: "standard", label: "標準", hint: "構成メモ付き" },
    { id: "free", label: "自由記述", hint: "まとめて書く" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tabs.map((t) => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`rounded-xl border-2 px-2 py-2 text-center transition-colors ${
              active
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 bg-white hover:border-indigo-200"
            }`}
          >
            <span
              className={`block text-sm font-bold ${
                active ? "text-indigo-700" : "text-gray-600"
              }`}
            >
              {t.label}
            </span>
            <span className="block text-[10px] text-gray-400 mt-0.5">{t.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// 説明ビルダー本体
// ============================================================
export function ExplanationBuilder({
  unit,
  onSubmit,
  isLoading,
  initialValue = "",
  lockedMode,
}: Props) {
  const scaffold = unit.starterScaffold;
  const hasScaffold = Boolean(scaffold);

  // モード（scaffold が無ければ自由記述のみ）
  const [mode, setMode] = useState<Mode>(
    lockedMode ?? (hasScaffold ? "guided" : "free")
  );

  // 初回はガイド付き、2回目以降は標準を推奨（lockedMode 指定時は固定）
  useEffect(() => {
    if (lockedMode || !hasScaffold) return;
    try {
      const taught = localStorage.getItem(taughtKey(unit.id));
      // 初回(server/client一致のguided)で描画後、過去に教えた実績があれば標準へ昇格。
      // localStorageはクライアント専用のため、ハイドレーション不一致を避けて effect で同期する。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (taught) setMode("standard");
    } catch {
      /* localStorage 不可環境では既定のまま */
    }
  }, [unit.id, hasScaffold, lockedMode]);

  // ガイド付き：各スロットの入力
  const [slots, setSlots] = useState<Record<string, string>>({});
  // ガイド付きプレビューを手動編集したか
  const [manualEdited, setManualEdited] = useState(false);
  const [manualText, setManualText] = useState("");

  // 標準・自由記述：単一テキスト
  const [text, setText] = useState(initialValue);

  // ガイド付きの自動合成結果
  const builtText = useMemo(
    () => buildTeachingExplanation(slots, scaffold),
    [slots, scaffold]
  );
  const previewText = manualEdited ? manualText : builtText;

  // 未入力の必須スロット
  const missingRequired = useMemo(() => {
    if (!scaffold) return [];
    return scaffold.explanationSlots.filter(
      (s) => s.required && !(slots[s.id]?.trim())
    );
  }, [scaffold, slots]);

  const setSlot = (id: string, v: string) => {
    setSlots((prev) => ({ ...prev, [id]: v }));
    // スロットを編集したら自動合成に戻す（手動編集を破棄）
    if (manualEdited) {
      setManualEdited(false);
      setManualText("");
    }
  };

  const markTaught = () => {
    try {
      localStorage.setItem(taughtKey(unit.id), "1");
    } catch {
      /* 失敗しても致命的ではない */
    }
  };

  // ---- 送信可否 ----
  const guidedReady =
    !manualEdited
      ? missingRequired.length === 0
      : manualText.trim().length >= MIN_FREE_LEN;
  const textReady = text.trim().length >= MIN_FREE_LEN;
  const canSubmit =
    !isLoading && (mode === "guided" ? guidedReady : textReady);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const explanation =
      mode === "guided" ? previewText.trim() : text.trim();
    if (!explanation) return;
    markTaught();
    onSubmit(explanation);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* モード切替（scaffold があり、固定モードでないときのみ） */}
      {hasScaffold && !lockedMode && (
        <ModeTabs mode={mode} onChange={setMode} />
      )}

      {/* ============ ガイド付きモード ============ */}
      {mode === "guided" && scaffold && (
        <div className="space-y-3">
          {/* 核となる問い */}
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
            <p className="text-xs font-bold text-indigo-500 mb-1">まず考えてみよう</p>
            <p className="text-sm text-indigo-800 font-medium">
              {scaffold.coreQuestion}
            </p>
          </div>

          {/* 入力欄を順番に */}
          {scaffold.explanationSlots.map((s, i) => (
            <ExplanationSlotCard
              key={s.id}
              index={i + 1}
              label={s.label}
              prompt={s.prompt}
              placeholder={s.placeholder}
              required={s.required}
              value={slots[s.id] ?? ""}
              onChange={(v) => setSlot(s.id, v)}
              disabled={isLoading}
            />
          ))}

          <WorkedExamplePanel unit={unit} />

          {/* 自動生成プレビュー（編集可） */}
          <div className="rounded-xl border-2 border-indigo-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-indigo-50 flex items-center justify-between">
              <span className="text-sm font-bold text-indigo-700">
                🪄 AIに教える説明文（自動生成・編集OK）
              </span>
              {manualEdited && (
                <button
                  type="button"
                  onClick={() => {
                    setManualEdited(false);
                    setManualText("");
                  }}
                  className="text-xs text-indigo-500 font-medium hover:underline"
                >
                  🔄 入力から作り直す
                </button>
              )}
            </div>
            <div className="p-3">
              <textarea
                value={previewText}
                onChange={(e) => {
                  setManualEdited(true);
                  setManualText(e.target.value);
                }}
                placeholder="上の欄を埋めると、ここに説明文が自動で組み立てられます。"
                rows={6}
                disabled={isLoading}
                className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 text-sm
                  focus:outline-none focus:border-indigo-400 transition-colors
                  disabled:bg-gray-50 disabled:text-gray-400 resize-none leading-relaxed bg-gray-50"
              />
            </div>
          </div>

          {/* 足りない項目の学習支援的メッセージ */}
          {!manualEdited && missingRequired.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800 leading-relaxed">
                あと少し！AIに伝わりやすくするために、
                「{missingRequired.map((s) => s.label).join("」「")}」
                を書いてみよう。
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============ 標準モード ============ */}
      {mode === "standard" && (
        <div className="space-y-3">
          {scaffold && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
              <p className="text-xs font-bold text-indigo-500 mb-2">
                この順番で説明してみよう
              </p>
              <ol className="space-y-1">
                {scaffold.explanationSlots.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-2 text-sm text-indigo-800"
                  >
                    <span className="font-bold text-indigo-400">{i + 1}.</span>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <WorkedExamplePanel unit={unit} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`上の構成メモの順番で、AIへの説明を書いてみよう。\n\n例：「${unit.name}は〜のために使います。見分け方は…。例文では…」`}
            rows={8}
            disabled={isLoading}
            className="w-full p-4 border-2 border-gray-200 rounded-xl text-gray-800 text-sm
              focus:outline-none focus:border-indigo-400 transition-colors
              disabled:bg-gray-50 disabled:text-gray-400 resize-none leading-relaxed"
          />
        </div>
      )}

      {/* ============ 自由記述モード ============ */}
      {mode === "free" && (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`AIへの説明を自由に書いてください。\n\n例：「${unit.name}とは〜です。〇〇のときは△△を使い、□□のときは...」`}
            rows={8}
            disabled={isLoading}
            className="w-full p-4 border-2 border-gray-200 rounded-xl text-gray-800 text-sm
              focus:outline-none focus:border-indigo-400 transition-colors
              disabled:bg-gray-50 disabled:text-gray-400 resize-none leading-relaxed"
          />
          <TeachingChecklist topics={unit.teachingGuide.coverageTopics} />
        </div>
      )}

      {/* 文字数の目安（テキスト系モード） */}
      {mode !== "guided" && (
        <div className="flex justify-between -mt-1">
          <span className="text-xs">
            {text.trim().length < MIN_FREE_LEN ? (
              <span className="text-amber-500">
                あと {MIN_FREE_LEN - text.trim().length} 文字くらい書いてみよう
              </span>
            ) : (
              <span className="text-green-500">✓ AIに教えられます</span>
            )}
          </span>
          <span className="text-xs text-gray-400">{text.length} 文字</span>
        </div>
      )}

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3 px-6 bg-indigo-600 text-white font-bold rounded-xl
          hover:bg-indigo-700 transition-colors duration-200
          disabled:bg-gray-300 disabled:cursor-not-allowed
          flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <span className="animate-spin">⏳</span>
            送信中...
          </>
        ) : (
          <>🚀 AIに教える</>
        )}
      </button>
    </form>
  );
}
