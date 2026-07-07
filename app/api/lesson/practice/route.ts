import { NextRequest, NextResponse } from "next/server";
import { practiceChat } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import { getCachedAiResponse, cacheAiResponse } from "@/lib/ai-cache";
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
    } = body;
    isFollowup = !!is_followup;

    if (!unit_id || question_id == null || !dialogue) {
      return NextResponse.json(
        { error: "unit_id / question_id / dialogue は必須です" },
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

    question = unit.practiceQuestions.find((q) => q.id === question_id);
    if (!question) {
      return NextResponse.json(
        { error: "指定された練習問題が見つかりません" },
        { status: 404 }
      );
    }

    // 冪等化：同じ attempt_id で既に成功していればキャッシュを返す
    const cached = await getCachedAiResponse<PracticeTurn>(attempt_id);
    if (cached) {
      return NextResponse.json(cached);
    }

    const turn = await practiceChat(
      unit,
      question,
      dialogue,
      isFollowup,
      exchange_count ?? 0,
      !!force_stumble,
      !!is_cold_open
    );
    await cacheAiResponse(attempt_id, turn);
    return NextResponse.json(turn);
  } catch (err) {
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
