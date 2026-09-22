import { NextRequest, NextResponse } from "next/server";
import { practiceChat } from "@/lib/gemini";
import {
  cacheAiResponse,
  expireAiResponse,
  reserveAiResponse,
} from "@/lib/ai-cache";
import { sha256 } from "@/lib/auth/crypto";
import { authorizeLessonScope, boundedDialogue } from "@/lib/learning/access";
import { publicAiError } from "@/lib/learning/ai-errors";
import type { LessonMessage, PracticeTurn } from "@/types";

// Gemini呼び出しはリトライ込みで10秒を超えうるため延長。
export const maxDuration = 60;

// POST /api/lesson/practice — 練習問題で生徒役AIの1ターンを返す
export async function POST(req: NextRequest) {
  let cacheKey: string | null = null;
  let requestHash: string | null = null;
  try {
    const body: {
      unit_id?: string;
      question_id?: number;
      dialogue?: LessonMessage[];
      is_followup?: boolean;
      exchange_count?: number;
      force_stumble?: boolean;
      /** レッスン冒頭の「腕試し」ターン（まだ何も教わっていない状態で挑戦→失敗→質問） */
      is_cold_open?: boolean;
      /** 冪等化キー。同一IDの再呼び出しにはキャッシュを返す（再試行・戻る対策） */
      attempt_id?: string;
      participant_id?: string;
      session_id?: string;
    } = await req.json();
    const {
      unit_id,
      question_id,
      dialogue,
      is_followup,
      exchange_count,
      force_stumble,
      is_cold_open,
      attempt_id,
      participant_id,
      session_id,
    } = body;

    const safeDialogue = boundedDialogue(dialogue);
    if (!unit_id || question_id == null || !safeDialogue) {
      return NextResponse.json(
        { error: "unit_id / question_id / dialogue は必須です" },
        { status: 400 }
      );
    }

    const authorization = await authorizeLessonScope(req, {
      participantId: participant_id,
      sessionId: session_id,
      unitId: unit_id,
    });
    if (!authorization.ok) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }

    const unit = authorization.scope.unit;

    const question = unit.practiceQuestions.find((q) => q.id === question_id);
    if (!question) {
      return NextResponse.json(
        { error: "指定された練習問題が見つかりません" },
        { status: 404 }
      );
    }

    cacheKey = attempt_id
      ? `practice:v2:${authorization.scope.participantId}:${attempt_id}`
      : null;
    requestHash = await sha256(JSON.stringify({
      unit_id,
      question_id,
      dialogue: safeDialogue,
      is_followup: !!is_followup,
      exchange_count: exchange_count ?? 0,
      force_stumble: !!force_stumble,
      is_cold_open: !!is_cold_open,
    }));
    const reservation = await reserveAiResponse<PracticeTurn>(
      cacheKey,
      requestHash,
      authorization.scope.userId,
    );
    if (reservation.kind === "completed") {
      return NextResponse.json(reservation.response);
    }
    if (reservation.kind === "conflict") {
      return NextResponse.json(
        { error: "同じ試行IDに異なる内容が送信されました" },
        { status: 409 },
      );
    }
    if (reservation.kind === "pending") {
      return NextResponse.json(
        { error: "同じ試行を処理中です。しばらく後に再試行してください" },
        { status: 409 },
      );
    }

    const turn = await practiceChat(
      unit,
      question,
      safeDialogue,
      !!is_followup,
      exchange_count ?? 0,
      !!force_stumble,
      !!is_cold_open
    );
    await cacheAiResponse(cacheKey, turn, requestHash);
    return NextResponse.json(turn);
  } catch (err) {
    if (cacheKey && requestHash) {
      await expireAiResponse(cacheKey, requestHash);
    }
    console.error("[/api/lesson/practice]", err);
    return NextResponse.json(
      publicAiError(err, "AIの応答を取得できませんでした。しばらく後に再試行してください。"),
      { status: 503 }
    );
  }
}
