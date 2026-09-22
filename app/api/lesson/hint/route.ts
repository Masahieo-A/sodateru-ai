import { NextRequest, NextResponse } from "next/server";
import { teachingHint } from "@/lib/gemini";
import { authorizeLessonScope, boundedDialogue } from "@/lib/learning/access";
import { publicAiError } from "@/lib/learning/ai-errors";
import type { LessonMessage } from "@/types";

// Gemini呼び出しはリトライ込みで10秒を超えうるため延長。
export const maxDuration = 60;

// POST /api/lesson/hint — 文法マスターが「教え方」のヒントを返す
export async function POST(req: NextRequest) {
  try {
    const body: {
      unit_id?: string;
      dialogue?: LessonMessage[];
      question_id?: number;
      participant_id?: string;
      session_id?: string;
    } = await req.json();
    const { unit_id, dialogue, question_id, participant_id, session_id } = body;
    const safeDialogue = boundedDialogue(dialogue);

    if (!unit_id || !safeDialogue) {
      return NextResponse.json(
        { error: "unit_id / dialogue は必須です" },
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

    const question =
      question_id != null
        ? unit.practiceQuestions.find((q) => q.id === question_id)
        : undefined;
    if (question_id != null && !question) {
      return NextResponse.json({ error: "この授業の対象外の問題です" }, { status: 404 });
    }

    const hint = await teachingHint(unit, safeDialogue, question);
    return NextResponse.json(hint);
  } catch (err) {
    console.error("[/api/lesson/hint]", err);
    return NextResponse.json(
      publicAiError(err, "ヒント生成中にエラーが発生しました。しばらく後に再試行してください。"),
      { status: 500 }
    );
  }
}
