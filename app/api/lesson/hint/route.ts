import { NextRequest, NextResponse } from "next/server";
import { teachingHint } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import type { LessonMessage } from "@/types";

// Gemini呼び出しはリトライ込みで10秒を超えうるため延長（Vercel）
export const maxDuration = 60;

// POST /api/lesson/hint — 文法マスターが「教え方」のヒントを返す
export async function POST(req: NextRequest) {
  try {
    const body: {
      unit_id?: string;
      dialogue?: LessonMessage[];
      question_id?: number;
    } = await req.json();
    const { unit_id, dialogue, question_id } = body;

    if (!unit_id || !dialogue) {
      return NextResponse.json(
        { error: "unit_id / dialogue は必須です" },
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

    const question =
      question_id != null
        ? unit.practiceQuestions.find((q) => q.id === question_id)
        : undefined;

    const hint = await teachingHint(unit, dialogue, question);
    return NextResponse.json(hint);
  } catch (err) {
    console.error("[/api/lesson/hint]", err);
    return NextResponse.json(
      { error: "ヒント生成中にエラーが発生しました。しばらく後に再試行してください。" },
      { status: 500 }
    );
  }
}
