import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getUnitById } from "@/lib/questions";

export const runtime = "edge";

// GET /api/teacher/sessions/[id] — セッション詳細と参加者一覧（教員の授業管理画面用）
// The browser polls this same-origin endpoint, avoiding cross-origin database access.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "教員権限が必要です" }, { status: 403 });
  const { id } = await params;
  const session = await getDb().prepare(
    `SELECT s.id,s.code,s.unit_id,s.name,s.status,s.created_at,
            c.session_id AS learning_config,c.curriculum_id,c.curriculum_version,
            c.selected_knowledge_ids,c.prior_knowledge_ids,c.sampling_policy,
            c.confirmation_policy,c.immutable_snapshot
       FROM sessions s LEFT JOIN session_learning_configs c ON c.session_id=s.id
      WHERE s.id=? AND s.teacher_user_id=? LIMIT 1`,
  ).bind(id, user.id).first<Record<string, unknown>>();
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  const db = getDb();
  const { results: participantRows } = await db.prepare(
    `SELECT p.id,p.session_id,p.user_id,p.name,p.best_score,p.attempt_count,p.last_attempt_at,p.created_at,
            u.email AS account_email,u.name AS account_name,u.google_sub AS account_google_sub
       FROM participants p LEFT JOIN users u ON u.id=p.user_id
      WHERE p.session_id=? ORDER BY p.best_score DESC,p.last_attempt_at ASC,p.created_at ASC LIMIT 500`,
  ).bind(id).all<Record<string, unknown>>();
  const parse = (value: unknown, fallback: unknown) => {
    if (typeof value !== "string") return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const students = participantRows.map((participant) => ({
    ...participant,
    account: {
      id: participant.user_id,
      email: participant.account_email ?? null,
      name: participant.account_name ?? participant.name,
      google_sub: participant.account_google_sub ?? null,
    },
  }));
  const unit = getUnitById(String(session.unit_id));
  const defaultIds = unit?.teachingGuide.coverageTopics.map((_, index) => unit.teachingGuide.knowledgeTopicIds?.[index] ?? `${unit.id}.legacy-topic.${index}`) ?? [];
  const defaultSnapshot = unit ? {
    unit_id: unit.id, unit_name: unit.name,
    knowledge_topics: unit.teachingGuide.coverageTopics.map((label, index) => ({ id: unit.teachingGuide.knowledgeTopicIds?.[index] ?? `${unit.id}.legacy-topic.${index}`, label })),
  } : {};
  const config = session.learning_config ? {
    curriculum_id: session.curriculum_id ?? null,
    curriculum_version: session.curriculum_version ?? null,
    selected_knowledge_ids: parse(session.selected_knowledge_ids, defaultIds),
    prior_knowledge_ids: parse(session.prior_knowledge_ids, []),
    sampling_policy: parse(session.sampling_policy, {}),
    confirmation_policy: parse(session.confirmation_policy, {}),
    immutable_snapshot: parse(session.immutable_snapshot, defaultSnapshot),
  } : {
    curriculum_id: null, curriculum_version: null, selected_knowledge_ids: defaultIds,
    prior_knowledge_ids: [], sampling_policy: {}, confirmation_policy: {}, immutable_snapshot: defaultSnapshot,
  };
  return NextResponse.json({ session: { ...session, learning_config: config }, students });
}
