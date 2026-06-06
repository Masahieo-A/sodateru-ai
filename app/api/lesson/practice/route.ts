import { NextRequest, NextResponse } from "next/server";
import { practiceChat } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import type { LessonMessage } from "@/types";

// POST /api/lesson/practice — 練習問題で生徒役AIの1ターンを返す
export async function POST(req: NextRequest) {
  try {
    const body: {
      unit_id?: string;
      question_id?: number;
      dialogue?: LessonMessage[];
      is_followup?: boolean;
      exchange_count?: number;
      force_stumble?: boolean;
    } = await req.json();
    const {
      unit_id,
      question_id,
      dialogue,
      is_followup,
      exchange_count,
      force_stumble,
    } = body;

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

    const question = unit.practiceQuestions.find((q) => q.id === question_id);
    if (!question) {
      return NextResponse.json(
        { error: "指定された練習問題が見つかりません" },
        { status: 404 }
      );
    }

    const turn = await practiceChat(
      unit,
      question,
      dialogue,
      !!is_followup,
      exchange_count ?? 0,
      !!force_stumble
    );
    return NextResponse.json(turn);
  } catch (err) {
    console.error("[/api/lesson/practice]", err);
    return NextResponse.json(
      { error: "AI応答中にエラーが発生しました。しばらく後に再試行してください。" },
      { status: 500 }
    );
  }
}
