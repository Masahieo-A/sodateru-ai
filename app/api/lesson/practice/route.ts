import { NextRequest, NextResponse } from "next/server";
import { practiceChat } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import {
  cacheAiResponse,
  expireAiResponse,
  reserveAiResponse,
} from "@/lib/ai-cache";
import { sha256 } from "@/lib/auth/crypto";
import { authorizeLessonScope, boundedDialogue } from "@/lib/learning/access";
import type { LessonMessage, MCQuestion, PracticeTurn } from "@/types";

// Gemini呼び出しはリトライ込みで10秒を超えうるため延長（Vercel）
export const maxDuration = 60;

/**
 * リトライしても失敗した場合の定型応答（フォールバック）。
 * 授業が止まることだけは防ぐ。誤答側に倒して「教える契機」は保つ。
 */
function fallbackTurn(question: MCQuestion, isFollowup: boolean): PracticeTurn {
  if (isFollowup) {
    return {
      message:
        "ありがとうございます…！ごめんなさい、いま頭が混み合っていてうまく整理できませんでした。もう一度だけ、いちばん大事なポイントを短く教えてもらえますか？",
      satisfied: false,
      isFallback: true,
    };
  }
  const wrong = question.choices.find(
    (c) => c.label.toUpperCase() !== question.answerLabel.toUpperCase()
  );
  const label = question.commonMistake?.label ?? wrong?.label ?? question.answerLabel;
  const text = question.choices.find((c) => c.label === label)?.text ?? "";
  return {
    message: `うーん、いまちょっと考えがまとまりません…。とりあえず「${label}（${text}）」かなと思うのですが、自信がないです。どうやって見分ければいいか、判断のポイントを教えてもらえますか？`,
    chosenLabel: label,
    isCorrect:
      label.trim().toUpperCase() === question.answerLabel.trim().toUpperCase(),
    satisfied: false,
    isFallback: true,
  };
}

// POST /api/lesson/practice — 練習問題で生徒役AIの1ターンを返す
export async function POST(req: NextRequest) {
  let question: MCQuestion | undefined;
  let isFollowup = false;
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
    isFollowup = !!is_followup;

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

    const unit = getUnitById(unit_id);
    if (!unit) {
      return NextResponse.json(
        { error: "指定された単元が見つかりません" },
        { status: 404 }
      );
    }

    question = unit.practiceQuestions.find((q) => q.id === question_id);
    if (!question) {
      return NextResponse.json(
        { error: "指定された練習問題が見つかりません" },
        { status: 404 }
      );
    }

    cacheKey = attempt_id
      ? `practice:${authorization.scope.participantId}:${attempt_id}`
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
      isFollowup,
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
    // リトライ済みでなお失敗 → 定型応答で授業を止めない（フォールバックはキャッシュしない）
    if (question) {
      return NextResponse.json(fallbackTurn(question, isFollowup));
    }
    return NextResponse.json(
      { error: "AI応答中にエラーが発生しました。しばらく後に再試行してください。" },
      { status: 500 }
    );
  }
}
