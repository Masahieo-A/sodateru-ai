import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getUnitById } from "@/lib/questions";

export const runtime = "edge";

function knowledgeTopicId(unit: ReturnType<typeof getUnitById>, index: number): string {
  return unit?.teachingGuide.knowledgeTopicIds?.[index] ?? `${unit?.id ?? "unit"}.legacy-topic.${index}`;
}

// GET /api/sessions/[code] — コードでセッション取得（生徒・教員共用）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!await getSessionUser(_req)) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { code } = await params;
  const data = await getDb().prepare(
    `SELECT s.id,s.code,s.unit_id,s.name,s.status,s.created_at,
            c.session_id AS learning_config,c.curriculum_id,c.curriculum_version,
            c.selected_knowledge_ids,c.prior_knowledge_ids,c.sampling_policy,
            c.confirmation_policy,c.immutable_snapshot
       FROM sessions s LEFT JOIN session_learning_configs c ON c.session_id=s.id
      WHERE s.code=? LIMIT 1`,
  ).bind(code.toUpperCase()).first<Record<string, unknown>>();
  if (!data) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  const unit = getUnitById(String(data.unit_id));
  const parse = (value: unknown, fallback: unknown) => {
    if (typeof value !== "string") return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const learningConfig = data.learning_config ? {
    curriculum_id: data.curriculum_id ?? null,
    curriculum_version: data.curriculum_version ?? null,
    selected_knowledge_ids: parse(data.selected_knowledge_ids, unit?.teachingGuide.coverageTopics.map((_, i) => knowledgeTopicId(unit, i)) ?? []),
    prior_knowledge_ids: parse(data.prior_knowledge_ids, []),
    sampling_policy: parse(data.sampling_policy, {}),
    confirmation_policy: parse(data.confirmation_policy, {}),
    immutable_snapshot: parse(data.immutable_snapshot, unit ? {
      unit_id: unit.id, unit_name: unit.name,
      knowledge_topics: unit.teachingGuide.coverageTopics.map((label, index) => ({ id: knowledgeTopicId(unit, index), label })),
    } : {}),
  } : {
    curriculum_id: null, curriculum_version: null,
    selected_knowledge_ids: unit?.teachingGuide.coverageTopics.map((_, i) => knowledgeTopicId(unit, i)) ?? [],
    prior_knowledge_ids: [], sampling_policy: {}, confirmation_policy: {},
    immutable_snapshot: unit ? {
      unit_id: unit.id, unit_name: unit.name,
      knowledge_topics: unit.teachingGuide.coverageTopics.map((label, index) => ({ id: knowledgeTopicId(unit, index), label })),
    } : {},
  };
  return NextResponse.json({ ...data, learning_config: learningConfig, unit });
}
