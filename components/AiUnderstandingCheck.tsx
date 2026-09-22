"use client";

import { useEffect, useRef, useState } from "react";
import type { GrammarUnit, LessonMessage } from "@/types";
import type { AiLearningEvidence, MasteryEvidence } from "@/types/learning";
import { independentCheckFor, topicRefFor } from "@/lib/learning/topics";

const STORAGE_VERSION = 1;
type Props = { unit: GrammarUnit; dialogue: LessonMessage[]; storageScope: { sessionId: string; participantId: string }; onComplete: (ai: AiLearningEvidence[], mastery: MasteryEvidence[]) => void };
type Inference = { inferredRule: string; revision: number };
type StoredEvidence = { version: number; scope: Props["storageScope"]; ai: AiLearningEvidence[]; mastery: MasteryEvidence[]; updatedAt: string };

function storageKey(unitId: string, scope: Props["storageScope"]): string {
  return `learning-evidence:v${STORAGE_VERSION}:${encodeURIComponent(unitId)}:${encodeURIComponent(scope.sessionId)}:${encodeURIComponent(scope.participantId)}`;
}

export function AiUnderstandingCheck({ unit, dialogue, storageScope, onComplete }: Props) {
  const [topicIndex, setTopicIndex] = useState(0);
  const [inference, setInference] = useState<Inference | null>(null);
  const [correction, setCorrection] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masteryEvidence, setMasteryEvidence] = useState<MasteryEvidence[]>([]);
  const aiEvidenceRef = useRef<AiLearningEvidence[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const check = independentCheckFor(unit, topicIndex);

  const requestInference = async (nextCorrection?: string) => {
    const res = await fetch("/api/lesson/inference", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unit_id: unit.id, topic_index: topicIndex, dialogue, session_id: storageScope.sessionId, participant_id: storageScope.participantId, ...(nextCorrection ? { correction: nextCorrection } : {}) }) });
    const data = (await res.json().catch(() => ({}))) as Partial<Inference> & { error?: string };
    if (!res.ok || typeof data.inferredRule !== "string") throw new Error(data.error ?? "確認を取得できませんでした");
    return data as Inference;
  };

  useEffect(() => {
    let cancelled = false;
    requestInference().then((data) => { if (!cancelled) { setError(null); setInference(data); } }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "確認を取得できませんでした"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // requestInference is scoped to the current topic/dialogue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id, topicIndex, dialogue]);

  const persist = (ai: AiLearningEvidence[], mastery: MasteryEvidence[]) => {
    const payload: StoredEvidence = { version: STORAGE_VERSION, scope: storageScope, ai, mastery, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(storageKey(unit.id, storageScope), JSON.stringify(payload)); } catch { /* React state remains the current client evidence. */ }
  };

  const advanceOrComplete = (nextAi: AiLearningEvidence[], nextMastery: MasteryEvidence[]) => {
    if (topicIndex < unit.teachingGuide.coverageTopics.length - 1) {
      setLoading(true); setTopicIndex((index) => index + 1); setCorrection(""); setReviewed(false); setEditing(false); return;
    }
    persist(nextAi, nextMastery); onComplete(nextAi, nextMastery);
  };

  const finishTopic = (response: "confirmed" | "corrected") => {
    if (!inference) return;
    const evidence: AiLearningEvidence = { id: crypto.randomUUID(), topicRef: topicRefFor(unit, topicIndex), inferredRule: inference.inferredRule, learnerResponse: response, correction: correction.trim() || undefined, revision: inference.revision, createdAt: new Date().toISOString() };
    const nextAi = [...aiEvidenceRef.current, evidence];
    aiEvidenceRef.current = nextAi;
    if (response === "confirmed" && check) { setReviewed(true); return; }
    advanceOrComplete(nextAi, masteryEvidence);
  };

  const answerCheck = (label: string) => {
    if (!check) { finishTopic("confirmed"); return; }
    const evidence: MasteryEvidence = { id: crypto.randomUUID(), topicRef: topicRefFor(unit, topicIndex), checkQuestion: check.prompt, selectedAnswer: label, expectedAnswer: check.answerLabel, isCorrect: label === check.answerLabel, createdAt: new Date().toISOString() };
    const nextMastery = [...masteryEvidence, evidence]; setMasteryEvidence(nextMastery); advanceOrComplete(aiEvidenceRef.current, nextMastery);
  };

  const submitCorrection = async () => {
    const text = correction.trim(); if (!text || submittingCorrection) return;
    setSubmittingCorrection(true); setError(null);
    try { setInference(await requestInference(text)); setEditing(false); } catch (err) { setError(err instanceof Error ? err.message : "修正の反映に失敗しました。もう一度お試しください。"); } finally { setSubmittingCorrection(false); }
  };

  return <div className="space-y-4" aria-live="polite">
    <section className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
      <p className="text-xs font-bold text-indigo-600">理解の確認 {topicIndex + 1} / {unit.teachingGuide.coverageTopics.length}</p>
      <h2 className="text-lg font-black text-gray-800 mt-2">AIの理解したルール</h2>
      <p className="text-sm text-gray-500 mt-1">「{unit.teachingGuide.coverageTopics[topicIndex]}」について、AIの推測を確認してください。</p>
      {loading && <p className="text-indigo-500 font-bold py-6">AIが理解を整理しています...</p>}
      {!loading && error && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(null); requestInference().then(setInference).catch((err) => setError(err instanceof Error ? err.message : "再試行に失敗しました")).finally(() => setLoading(false)); }} className="mt-3 rounded-lg bg-red-600 px-3 py-2 font-bold text-white">もう一度取得</button></div>}
      {!loading && !error && inference && <>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mt-4 text-sm text-indigo-900">{inference.inferredRule}</div>
        {!reviewed && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4"><button type="button" onClick={() => finishTopic("confirmed")} className="py-3 rounded-xl bg-green-600 text-white font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700">合っている</button><button type="button" onClick={() => setEditing(true)} className="py-3 rounded-xl bg-amber-100 text-amber-800 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700">違うので直す</button></div>}
        {editing && <div className="mt-3 space-y-2"><label htmlFor="inference-correction" className="block text-sm font-bold text-gray-700">修正内容</label><textarea id="inference-correction" value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder="どこが違うか、正しいルールを教えてください" className="w-full border rounded-xl p-3 text-sm" rows={4} /><button type="button" disabled={!correction.trim() || submittingCorrection} onClick={submitCorrection} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50">{submittingCorrection ? "修正を反映しています..." : "修正を反映してもう一度確認"}</button></div>}
      </>}
    </section>
    {check && inference && reviewed && <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><h3 className="font-bold text-gray-800">独立チェック（AIの返答とは別の証拠）</h3><p className="text-sm text-gray-700 mt-3">{check.prompt}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3" role="group" aria-label="独立チェックの選択肢">{check.choices.map((choice) => <button type="button" key={choice.label} onClick={() => answerCheck(choice.label)} className="text-left px-3 py-3 rounded-xl border border-gray-200 hover:border-indigo-400 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"><b>{choice.label}.</b> {choice.text}</button>)}</div></section>}
  </div>;
}
