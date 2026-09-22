import { NextRequest, NextResponse } from "next/server";
import { learningSummary } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import { cacheAiResponse, expireAiResponse, reserveAiResponse } from "@/lib/ai-cache";
import { sha256 } from "@/lib/auth/crypto";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { boundedDialogue } from "@/lib/learning/access";
import type { LessonMessage, LearningSummary as LS } from "@/types";

// Gemini呼び出しはリトライ込みで10秒を超えうるため延長（Vercel）
export const maxDuration = 60;
export const runtime = "edge";

// POST /api/lesson/summary — 生徒AIの学習内容をまとめる
export async function POST(req: NextRequest) {
  let summaryKey: string | null = null;
  let summaryHash: string | null = null;
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const body: {
      unit_id?: string;
      dialogue?: LessonMessage[];
      student_id?: string;
      session_id?: string;
      /** 冪等化キー。同一IDの再呼び出しにはキャッシュを返す（再試行対策） */
      attempt_id?: string;
    } = await req.json();
    const { unit_id, dialogue, student_id, session_id, attempt_id } = body;
    const safeDialogue = boundedDialogue(dialogue);

    if (!unit_id || !student_id || !session_id || !safeDialogue) {
      return NextResponse.json(
        { error: "unit_id / student_id / session_id / dialogue は必須です" },
        { status: 400 }
      );
    }

    const unit = getUnitById(unit_id);
    if (!unit) {
      return NextResponse.json(
        { error: "指定された単元が見つかりません" },
        { status: 404 }
      );
    }

    const participant = await getDb().prepare(
      `SELECT p.id,p.session_id,s.unit_id,s.status,c.selected_knowledge_ids
         FROM participants p JOIN sessions s ON s.id=p.session_id
         LEFT JOIN session_learning_configs c ON c.session_id=s.id
        WHERE p.id=? AND p.session_id=? AND p.user_id=? LIMIT 1`,
    ).bind(student_id, session_id, user.id).first<{
      id: string; session_id: string; unit_id: string; status: string; selected_knowledge_ids: string | null;
    }>();
    if (!participant) return NextResponse.json({ error: "参加者の権限を確認できません" }, { status: 403 });
    if (participant.unit_id !== unit_id) return NextResponse.json({ error: "単元がセッションと一致しません" }, { status: 400 });
    if (participant.status !== "active") return NextResponse.json({ error: "授業中のセッションでのみ実行できます" }, { status: 409 });
    if (participant.selected_knowledge_ids) {
      try {
        if (!Array.isArray(JSON.parse(participant.selected_knowledge_ids))) throw new Error("invalid");
      } catch {
        return NextResponse.json({ error: "学習設定が不正です" }, { status: 500 });
      }
    }

    summaryKey = attempt_id ? `summary:${user.id}:${attempt_id}` : null;
    summaryHash = await sha256(JSON.stringify({ unit_id, session_id, student_id, dialogue: safeDialogue }));
    const reservation = await reserveAiResponse<LS>(summaryKey, summaryHash, user.id);
    if (reservation.kind === "completed") return NextResponse.json(reservation.response);
    if (reservation.kind === "conflict") return NextResponse.json({ error: "同じ試行IDに異なる内容が送信されました" }, { status: 409 });
    if (reservation.kind === "pending") return NextResponse.json({ error: "同じ試行を処理中です。しばらくして再試行してください" }, { status: 409 });
    const summary = await learningSummary(unit, safeDialogue);

    // 授業モード: 対話ログとサマリーをサーバー保存。
    // 以降のテストはこれを「正」として使い、クライアント側の改ざんを防ぐ
    // （さらにテストではサマリーを渡してトークンを削減する）。
    {
      const teachingSummaryText = [
        "【教わった内容】",
        ...summary.taught.map((t) => `- ${t}`),
        "【理解できたこと】",
        ...summary.learned.map((t) => `- ${t}`),
        ...(summary.gaps.length
          ? ["【まだあいまいなこと】", ...summary.gaps.map((t) => `- ${t}`)]
          : []),
      ].join("\n");

      await getDb().prepare(
        `UPDATE participants SET dialogue_log=?,teaching_summary=?
          WHERE id=? AND user_id=?`,
      ).bind(JSON.stringify(safeDialogue), teachingSummaryText, participant.id, user.id).run();
    }
    if (summaryKey) await cacheAiResponse(summaryKey, summary, summaryHash);

    return NextResponse.json(summary);
  } catch (err) {
    if (summaryKey && summaryHash) await expireAiResponse(summaryKey, summaryHash);
    console.error("[/api/lesson/summary]", err);
    return NextResponse.json(
      { error: "学習内容のまとめ中にエラーが発生しました。しばらく後に再試行してください。" },
      { status: 500 }
    );
  }
}
