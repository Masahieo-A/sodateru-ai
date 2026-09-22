import { NextRequest, NextResponse } from "next/server";
import { getUnitById } from "@/lib/questions";
import { getSessionUser } from "@/lib/auth/session";
import { randomToken } from "@/lib/auth/crypto";
import { getDb } from "@/lib/db";
import { scopeUnit } from "@/lib/learning/scope";

export const runtime = "edge";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join("");
}

function knowledgeTopicId(unit: ReturnType<typeof getUnitById>, index: number): string {
  return unit?.teachingGuide.knowledgeTopicIds?.[index] ?? `${unit?.id ?? "unit"}.legacy-topic.${index}`;
}

function publicSession(row: Record<string, unknown>) {
  const json = (value: unknown, fallback: unknown) => {
    if (typeof value !== "string") return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const unit = getUnitById(String(row.unit_id));
  const defaultSnapshot = unit ? {
    unit_id: unit.id, unit_name: unit.name,
    knowledge_topics: unit.teachingGuide.coverageTopics.map((label, index) => ({ id: knowledgeTopicId(unit, index), label })),
  } : {};
  const defaultIds = unit?.teachingGuide.coverageTopics.map((_, index) => knowledgeTopicId(unit, index)) ?? [];
  return {
    id: row.id, code: row.code, unit_id: row.unit_id, name: row.name,
    status: row.status, created_at: row.created_at,
    learning_config: row.learning_config ? {
      curriculum_id: row.curriculum_id ?? null,
      curriculum_version: row.curriculum_version ?? null,
      selected_knowledge_ids: json(row.selected_knowledge_ids, defaultIds),
      prior_knowledge_ids: json(row.prior_knowledge_ids, []),
      sampling_policy: json(row.sampling_policy, {}),
      confirmation_policy: json(row.confirmation_policy, {}),
      immutable_snapshot: json(row.immutable_snapshot, defaultSnapshot),
    } : {
      curriculum_id: null, curriculum_version: null, selected_knowledge_ids: defaultIds,
      prior_knowledge_ids: [], sampling_policy: {}, confirmation_policy: {}, immutable_snapshot: defaultSnapshot,
    },
  };
}

// GET /api/sessions — セッション一覧（教員用）
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "教員権限が必要です" }, { status: 403 });
  const { results } = await getDb().prepare(
    `SELECT s.id,s.code,s.unit_id,s.name,s.status,s.created_at,
            c.session_id AS learning_config,c.curriculum_id,c.curriculum_version,
            c.selected_knowledge_ids,c.prior_knowledge_ids,c.sampling_policy,
            c.confirmation_policy,c.immutable_snapshot
       FROM sessions s LEFT JOIN session_learning_configs c ON c.session_id=s.id
      WHERE s.teacher_user_id=? ORDER BY s.created_at DESC LIMIT 200`,
  ).bind(user.id).all<Record<string, unknown>>();
  return NextResponse.json(results.map(publicSession));
}

// POST /api/sessions — セッション作成（教員用）
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "教員権限が必要です" }, { status: 403 });
  const body = await req.json() as {
    unit_id?: unknown; name?: unknown; curriculum_id?: unknown; curriculum_version?: unknown;
    selected_knowledge_ids?: unknown; prior_knowledge_ids?: unknown;
    sampling_policy?: unknown; confirmation_policy?: unknown;
  };
  const { unit_id, name } = body;
  if (typeof unit_id !== "string" || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "unit_id と name は必須です" }, { status: 400 });
  }
  const unit = typeof unit_id === "string" ? getUnitById(unit_id) : undefined;
  if (!unit) {
    return NextResponse.json({ error: "指定された単元が見つかりません" }, { status: 404 });
  }
  if (typeof name !== "string" || name.trim().length > 120) {
    return NextResponse.json({ error: "授業名は120文字以内で入力してください" }, { status: 400 });
  }
  const topicIds = unit.teachingGuide.coverageTopics.map((_, index) => knowledgeTopicId(unit, index));
  const asIds = (value: unknown, fallback: string[]) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && topicIds.includes(item))
    : fallback;
  const selectedKnowledgeIds = asIds(body.selected_knowledge_ids, topicIds);
  const scopedUnit = scopeUnit(unit, selectedKnowledgeIds);
  if (!selectedKnowledgeIds.length || !scopedUnit.practiceQuestions.length || !scopedUnit.testQuestions.length) {
    return NextResponse.json({ error: "今回扱う知識を選択してください。練習・テストに使える問題が必要です" }, { status: 400 });
  }
  const priorKnowledgeIds = asIds(body.prior_knowledge_ids, []).filter((id) => selectedKnowledgeIds.includes(id));
  const jsonObject = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const snapshot = {
    unit_id, unit_name: unit.name, coverage_topics: unit.teachingGuide.coverageTopics,
    selected_knowledge_ids: selectedKnowledgeIds, prior_knowledge_ids: priorKnowledgeIds,
    knowledge_topics: unit.teachingGuide.coverageTopics.map((label, index) => ({ id: knowledgeTopicId(unit, index), label })),
  };

  let data: Record<string, unknown> | null = null;
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    try {
      const sessionId = randomToken(16);
      const db = getDb();
      await db.batch([
        db.prepare(
          "INSERT INTO sessions (id,code,unit_id,name,status,teacher_user_id) VALUES (?,?,?,?,'waiting',?)",
        ).bind(sessionId, code, unit_id, name.trim(), user.id),
        db.prepare(
          `INSERT INTO session_learning_configs
             (session_id,curriculum_id,curriculum_version,unit_id,selected_knowledge_ids,prior_knowledge_ids,
              sampling_policy,confirmation_policy,immutable_snapshot,creator_user_id)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        ).bind(sessionId,
          typeof body.curriculum_id === "string" ? body.curriculum_id : null,
          typeof body.curriculum_version === "number" ? body.curriculum_version : null,
          unit_id, JSON.stringify(selectedKnowledgeIds), JSON.stringify(priorKnowledgeIds),
          JSON.stringify(jsonObject(body.sampling_policy)), JSON.stringify(jsonObject(body.confirmation_policy)),
          JSON.stringify(snapshot), user.id),
      ]);
      data = await getDb().prepare(
        `SELECT s.id,s.code,s.unit_id,s.name,s.status,s.created_at,
                c.session_id AS learning_config,c.curriculum_id,c.curriculum_version,
                c.selected_knowledge_ids,c.prior_knowledge_ids,c.sampling_policy,
                c.confirmation_policy,c.immutable_snapshot
           FROM sessions s LEFT JOIN session_learning_configs c ON c.session_id=s.id
          WHERE s.code=? LIMIT 1`,
      ).bind(code).first<Record<string, unknown>>();
      if (data) break;
    } catch (error) {
      if (!(error instanceof Error) || !/unique|constraint/i.test(error.message)) {
        return NextResponse.json({ error: "セッションの作成に失敗しました" }, { status: 500 });
      }
    }
  }
  if (!data) return NextResponse.json({ error: "コード生成に失敗しました" }, { status: 500 });
  return NextResponse.json(publicSession(data), { status: 201 });
}
