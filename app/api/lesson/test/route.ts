import { NextRequest, NextResponse } from "next/server";
import { runTest } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import { cacheAiResponse, expireAiResponse, reserveAiResponse } from "@/lib/ai-cache";
import { getSessionUser } from "@/lib/auth/session";
import { getDb, nowIso } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { independentCheckFor } from "@/lib/learning/topics";
import { boundedDialogue } from "@/lib/learning/access";
import { scopeUnit, selectedKnowledgeIdsFromDb } from "@/lib/learning/scope";
import { publicAiError } from "@/lib/learning/ai-errors";
import type { LessonMessage, TestResult } from "@/types";

// カバレッジ判定＋テスト評価はリトライ込みで10秒を超えうるため延長。
export const maxDuration = 60;
export const runtime = "edge";

function validateEvidence(value: unknown, kind: "ai_learning" | "mastery", unit: ReturnType<typeof getUnitById>): unknown[] {
  if (!unit || !Array.isArray(value)) return [];
  if (value.length > 20) throw new Error("evidence limit exceeded");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("invalid evidence");
    const record = entry as Record<string, unknown>;
    const topicRef = record.topicRef;
    if (!topicRef || typeof topicRef !== "object" || Array.isArray(topicRef)) throw new Error("invalid topic reference");
    const ref = topicRef as Record<string, unknown>;
    const topicIndex = ref.topicIndex;
    if (ref.unitId !== unit.id || typeof topicIndex !== "number" || !Number.isInteger(topicIndex) || topicIndex < 0 || topicIndex >= unit.teachingGuide.coverageTopics.length || ref.topic !== unit.teachingGuide.coverageTopics[topicIndex]) throw new Error("invalid topic reference");
    if (kind === "ai_learning") {
      if (typeof record.inferredRule !== "string" || record.inferredRule.length > 4000 || (record.learnerResponse !== "confirmed" && record.learnerResponse !== "corrected") || (record.correction !== undefined && (typeof record.correction !== "string" || record.correction.length > 4000))) throw new Error("invalid AI evidence");
      return { id: typeof record.id === "string" ? record.id.slice(0, 100) : randomToken(8), topicRef: { unitId: unit.id, topicIndex, topic: unit.teachingGuide.coverageTopics[topicIndex], ref: typeof ref.ref === "string" ? ref.ref.slice(0, 200) : `${unit.id}:${topicIndex}` }, inferredRule: record.inferredRule, learnerResponse: record.learnerResponse, ...(record.correction ? { correction: record.correction } : {}), revision: typeof record.revision === "number" ? Math.max(1, Math.min(10, Math.floor(record.revision))) : 1, createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso() };
    }
    const check = independentCheckFor(unit, topicIndex);
    if (!check || record.checkQuestion !== check.prompt || typeof record.selectedAnswer !== "string" || !check.choices.some((choice) => choice.label === record.selectedAnswer)) throw new Error("invalid mastery evidence");
    return { id: typeof record.id === "string" ? record.id.slice(0, 100) : randomToken(8), topicRef: { unitId: unit.id, topicIndex, topic: unit.teachingGuide.coverageTopics[topicIndex], ref: typeof ref.ref === "string" ? ref.ref.slice(0, 200) : `${unit.id}:${topicIndex}` }, checkQuestion: check.prompt, selectedAnswer: record.selectedAnswer, expectedAnswer: check.answerLabel, isCorrect: record.selectedAnswer === check.answerLabel, createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso() };
  });
}

type ParticipantRecord = {
  id: string;
  session_id: string;
  teaching_summary: string | null;
  dialogue_log: string | null;
  unit_id?: string;
  status?: string;
  selected_knowledge_ids?: string | null;
};

// POST /api/lesson/test — テスト問題をAIが解いてスコアを確定し、DBに保存
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const body: {
      unit_id?: string;
      dialogue?: LessonMessage[];
      student_id?: string;
      session_id?: string;
      /** 冪等化キー。同一IDの再呼び出しにはキャッシュを返す（再試行での二重採点・二重保存を防ぐ） */
      attempt_id?: string;
      ai_learning_evidence?: unknown[];
      mastery_evidence?: unknown[];
    } = await req.json();
    const { unit_id, dialogue, student_id, session_id, attempt_id } = body;
    const safeDialogue = dialogue === undefined ? undefined : boundedDialogue(dialogue);

    if (!unit_id || !student_id || !session_id || (dialogue !== undefined && !safeDialogue)) {
      return NextResponse.json(
        { error: "unit_id / student_id / session_id は必須です。dialogue を送る場合は形式も確認してください" },
        { status: 400 }
      );
    }

    const baseUnit = getUnitById(unit_id);
    if (!baseUnit) {
      return NextResponse.json(
        { error: "指定された単元が見つかりません" },
        { status: 404 }
      );
    }
    // 授業モードでは、クライアントから送られた dialogue は信用せず、
    // サマリー生成時にサーバー保存した内容を「正」として使う（改ざん防止）。
    // teaching_summary があればそれを優先（トークン削減）、なければ保存済み対話を使う。
    let teachingSummary: string | undefined;
    let dbDialogue: LessonMessage[] | undefined;
    let participant: ParticipantRecord | null = null;
    if (student_id && session_id) {
      participant = await getDb().prepare(
        `SELECT p.id,p.session_id,p.dialogue_log,p.teaching_summary,s.unit_id,s.status,c.selected_knowledge_ids
           FROM participants p JOIN sessions s ON s.id=p.session_id
           LEFT JOIN session_learning_configs c ON c.session_id=s.id
          WHERE p.id=? AND p.session_id=? AND p.user_id=? LIMIT 1`,
      ).bind(student_id, session_id, user.id).first<ParticipantRecord & { unit_id: string; status: string; selected_knowledge_ids: string | null }>();
      if (!participant) return NextResponse.json({ error: "参加者の権限を確認できません" }, { status: 403 });
      if (participant.unit_id !== unit_id) return NextResponse.json({ error: "単元がセッションと一致しません" }, { status: 400 });
      if (participant.status !== "active") return NextResponse.json({ error: "授業中のセッションでのみ実行できます" }, { status: 409 });
      teachingSummary = participant.teaching_summary ?? undefined;
      try { dbDialogue = participant.dialogue_log ? JSON.parse(participant.dialogue_log) as LessonMessage[] : undefined; } catch { dbDialogue = undefined; }
    }

    const unit = scopeUnit(baseUnit, selectedKnowledgeIdsFromDb(participant?.selected_knowledge_ids ?? null, baseUnit));
    let aiEvidence: unknown[];
    let masteryEvidence: unknown[];
    try {
      aiEvidence = validateEvidence(body.ai_learning_evidence, "ai_learning", unit);
      masteryEvidence = validateEvidence(body.mastery_evidence, "mastery", unit);
    } catch {
      return NextResponse.json({ error: "学習証拠の形式が不正です" }, { status: 400 });
    }

    // 知識源：DB のサマリー > DB の対話 > クライアントの対話（standaloneモード用）
    const sourceDialogue = dbDialogue ?? safeDialogue;
    if (!teachingSummary && (!sourceDialogue || sourceDialogue.length === 0)) {
      return NextResponse.json(
        { error: "テストに使える学習内容がありません" },
        { status: 400 }
      );
    }
    const verifiedSourceDialogue = sourceDialogue ?? undefined;

    const attemptKey = attempt_id ? `test:v2:${user.id}:${attempt_id}` : null;
    const requestHash = await sha256(JSON.stringify({
      unit_id,
      student_id: participant?.id ?? null,
      session_id: participant?.session_id ?? null,
      dialogue: safeDialogue,
      teachingSummary,
      aiEvidence,
      masteryEvidence,
    }));
    if (attemptKey) {
      const reservation = await reserveAiResponse<TestResult>(attemptKey, requestHash, user.id);
      if (reservation.kind === "completed") return NextResponse.json(reservation.response);
      if (reservation.kind === "conflict") return NextResponse.json({ error: "同じ試行IDに異なる内容が送信されました" }, { status: 409 });
      if (reservation.kind === "pending") return NextResponse.json({ error: "同じ試行を処理中です。しばらくして再試行してください" }, { status: 409 });
    }

    let result: TestResult;
    try {
      result = await runTest(unit, { dialogue: verifiedSourceDialogue, teachingSummary });
    } catch (error) {
      if (attemptKey) await expireAiResponse(attemptKey, requestHash);
      throw error;
    }

    // 授業モード: DB に保存してスコアを更新
    if (participant) {
      // 教えた全内容（DB優先）をテキスト化して保存。
      // 対話が無くサマリーのみの場合はサマリーを記録（explanation は NOT NULL）。
      const explanationText =
        (verifiedSourceDialogue ?? [])
          .map((m) => `[${m.role === "teacher" ? "先生" : "AI"}] ${m.content}`)
          .join("\n") ||
        teachingSummary ||
        "（記録なし）";

      const attemptRecordId = attempt_id ? await sha256(`${user.id}:${attempt_id}`) : randomToken(16);
      const evidenceRows = [
        ["ai_learning", aiEvidence],
        ["mastery", masteryEvidence],
      ] as const;
      const db = getDb();
      const statements = [db.prepare(
        `INSERT OR IGNORE INTO attempts
          (id,participant_id,session_id,explanation,teaching_score,ai_correct_count,total_questions,result_json,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).bind(attemptRecordId, participant.id, participant.session_id, explanationText,
        result.teaching_score, result.ai_correct_count, result.total_questions, JSON.stringify(result), nowIso())];
      for (const [kind, entries] of evidenceRows) {
        entries.forEach((entry, index) => {
          statements.push(db.prepare(
            `INSERT OR IGNORE INTO evidence (id,participant_id,session_id,kind,content_json,created_at)
             VALUES (?,?,?,?,?,?)`,
          ).bind(`${attemptRecordId}:${kind}:${index}`, participant.id, participant.session_id, kind, JSON.stringify(entry), nowIso()));
        });
      }
      // Recounting from attempts makes this update idempotent even if the same
      // attempt is delivered concurrently or retried after a network timeout.
      statements.push(db.prepare(
        `UPDATE participants SET
           best_score=CASE WHEN best_score>? THEN best_score ELSE ? END,
           attempt_count=(SELECT COUNT(*) FROM attempts WHERE participant_id=?),
           last_attempt_at=(SELECT MAX(created_at) FROM attempts WHERE participant_id=?)
         WHERE id=? AND user_id=?`,
      ).bind(result.teaching_score, result.teaching_score, participant.id, participant.id, participant.id, user.id));
      try {
        await db.batch(statements);
      } catch (error) {
        if (attemptKey) await expireAiResponse(attemptKey, requestHash);
        throw error;
      }
    }

    // 成功結果をキャッシュ（同じ attempt_id の再送で二重採点・二重保存しない）
    if (attemptKey) await cacheAiResponse(attemptKey, result, requestHash);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/lesson/test]", err);
    return NextResponse.json(
      publicAiError(err, "テスト評価中にエラーが発生しました。しばらく後に再試行してください。"),
      { status: 500 }
    );
  }
}
