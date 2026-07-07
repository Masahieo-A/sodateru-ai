import { NextRequest, NextResponse } from "next/server";
import { runTest } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getCachedAiResponse, cacheAiResponse } from "@/lib/ai-cache";
import type { LessonMessage, TestResult } from "@/types";

// カバレッジ判定＋テスト評価はリトライ込みで10秒を超えうるため延長（Vercel）
export const maxDuration = 60;

// POST /api/lesson/test — テスト問題をAIが解いてスコアを確定し、DBに保存
export async function POST(req: NextRequest) {
  try {
    const body: {
      unit_id?: string;
      dialogue?: LessonMessage[];
      student_id?: string;
      session_id?: string;
      /** 冪等化キー。同一IDの再呼び出しにはキャッシュを返す（再試行での二重採点・二重保存を防ぐ） */
      attempt_id?: string;
    } = await req.json();
    const { unit_id, dialogue, student_id, session_id, attempt_id } = body;

    if (!unit_id) {
      return NextResponse.json(
        { error: "unit_id は必須です" },
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

    // 冪等化：同じ attempt_id で既に採点済みならキャッシュを返す（DB保存も済んでいる）
    const cachedResult = await getCachedAiResponse<TestResult>(attempt_id);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    // 授業モードでは、クライアントから送られた dialogue は信用せず、
    // サマリー生成時にサーバー保存した内容を「正」として使う（改ざん防止）。
    // teaching_summary があればそれを優先（トークン削減）、なければ保存済み対話を使う。
    let teachingSummary: string | undefined;
    let dbDialogue: LessonMessage[] | undefined;
    if (student_id) {
      const { data: stu } = await supabaseAdmin
        .from("students")
        .select("dialogue_log, teaching_summary")
        .eq("id", student_id)
        .single();
      if (stu) {
        teachingSummary = stu.teaching_summary ?? undefined;
        dbDialogue = (stu.dialogue_log as LessonMessage[] | null) ?? undefined;
      }
    }

    // 知識源：DB のサマリー > DB の対話 > クライアントの対話（standaloneモード用）
    const sourceDialogue = dbDialogue ?? dialogue;
    if (!teachingSummary && (!sourceDialogue || sourceDialogue.length === 0)) {
      return NextResponse.json(
        { error: "テストに使える学習内容がありません" },
        { status: 400 }
      );
    }

    const result = await runTest(unit, {
      dialogue: sourceDialogue,
      teachingSummary,
    });

    // 授業モード: DB に保存してスコアを更新
    if (student_id && session_id) {
      // 教えた全内容（DB優先）をテキスト化して保存。
      // 対話が無くサマリーのみの場合はサマリーを記録（explanation は NOT NULL）。
      const explanationText =
        (sourceDialogue ?? [])
          .map((m) => `[${m.role === "teacher" ? "先生" : "AI"}] ${m.content}`)
          .join("\n") ||
        teachingSummary ||
        "（記録なし）";

      await supabaseAdmin.from("attempts").insert({
        student_id,
        session_id,
        explanation: explanationText,
        teaching_score: result.teaching_score,
        ai_correct_count: result.ai_correct_count,
        total_questions: result.total_questions,
        result_json: result,
      });

      const { data: student } = await supabaseAdmin
        .from("students")
        .select("best_score, attempt_count")
        .eq("id", student_id)
        .single();

      if (student) {
        await supabaseAdmin
          .from("students")
          .update({
            best_score: Math.max(student.best_score, result.teaching_score),
            attempt_count: student.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq("id", student_id);
      }
    }

    // 成功結果をキャッシュ（同じ attempt_id の再送で二重採点・二重保存しない）
    await cacheAiResponse(attempt_id, result);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/lesson/test]", err);
    return NextResponse.json(
      { error: "テスト評価中にエラーが発生しました。しばらく後に再試行してください。" },
      { status: 500 }
    );
  }
}
