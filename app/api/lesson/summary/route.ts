import { NextRequest, NextResponse } from "next/server";
import { learningSummary } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import type { LessonMessage } from "@/types";

// POST /api/lesson/summary — 生徒AIの学習内容をまとめる
export async function POST(req: NextRequest) {
  try {
    const body: { unit_id?: string; dialogue?: LessonMessage[] } =
      await req.json();
    const { unit_id, dialogue } = body;

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

    const summary = await learningSummary(unit, dialogue);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[/api/lesson/summary]", err);
    return NextResponse.json(
      { error: "学習内容のまとめ中にエラーが発生しました。しばらく後に再試行してください。" },
      { status: 500 }
    );
  }
}
