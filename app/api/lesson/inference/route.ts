import { NextRequest, NextResponse } from "next/server";
import { getUnitById } from "@/lib/questions";
import { inferLearningRule } from "@/lib/gemini";
import { fallbackInference, isValidTopic, topicRefFor } from "@/lib/learning/topics";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import type { LessonMessage } from "@/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      unit_id?: string; topic_index?: number; dialogue?: LessonMessage[]; correction?: string;
      session_id?: string; participant_id?: string;
    };
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    if (!body.unit_id || !body.session_id || !body.participant_id || !Array.isArray(body.dialogue) || body.topic_index == null) {
      return NextResponse.json({ error: "unit_id / session_id / participant_id / topic_index / dialogue は必須です" }, { status: 400 });
    }
    if (body.unit_id.length > 128 || body.session_id.length > 128 || body.participant_id.length > 128 || body.dialogue.length > 40) {
      return NextResponse.json({ error: "入力が長すぎます" }, { status: 413 });
    }
    if (body.correction != null && (typeof body.correction !== "string" || body.correction.length > 2000)) {
      return NextResponse.json({ error: "修正内容が長すぎます" }, { status: 413 });
    }
    if (body.dialogue.some((message) => !message || (message.role !== "teacher" && message.role !== "student") || typeof message.content !== "string" || message.content.length > 4000)) {
      return NextResponse.json({ error: "対話の形式または長さが不正です" }, { status: 400 });
    }
    const dialogueLength = body.dialogue.reduce((total, message) => total + message.content.length, 0);
    if (dialogueLength > 20000) return NextResponse.json({ error: "対話全体が長すぎます" }, { status: 413 });
    const unit = getUnitById(body.unit_id);
    if (!unit || !isValidTopic(unit, body.topic_index)) {
      return NextResponse.json({ error: "指定された学習トピックが見つかりません" }, { status: 404 });
    }
    const participant = await getDb().prepare(
      `SELECT p.id FROM participants p
         JOIN sessions s ON s.id=p.session_id
        WHERE p.id=? AND p.session_id=? AND p.user_id=? AND s.unit_id=? LIMIT 1`
    ).bind(body.participant_id, body.session_id, user.id, body.unit_id).first<{ id: string }>();
    if (!participant) return NextResponse.json({ error: "この学習セッションへのアクセス権がありません" }, { status: 403 });
    const topicRef = topicRefFor(unit, body.topic_index);
    const dialogueText = body.dialogue.map((m) => `${m.role}: ${m.content}`).join("\n");
    let inferredRule: string;
    try {
      inferredRule = await inferLearningRule(unit, topicRef.topic, dialogueText, body.correction);
    } catch {
      inferredRule = fallbackInference(unit, body.topic_index, dialogueText);
    }
    return NextResponse.json({ topicRef, inferredRule, revision: body.correction ? 2 : 1 });
  } catch (err) {
    console.error("[/api/lesson/inference]", err);
    return NextResponse.json({ error: "理解の確認に失敗しました" }, { status: 500 });
  }
}
