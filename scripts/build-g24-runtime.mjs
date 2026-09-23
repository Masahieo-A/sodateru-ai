import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const sourceRoot = process.env.G24_SOURCE_ROOT ?? "/Users/aomatsumasahiro/Desktop/育てるAI";
const inputPath = path.join(sourceRoot, "g24_curriculum.json");
const schemaPath = path.join(sourceRoot, "curriculum.schema.json");
const dataDir = path.join(root, "curriculum", "data");
const generatedDir = path.join(root, "curriculum", "generated");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const source = readJson(inputPath);

// Preserve the supplied documents as data. Nothing in either attachment is executed.
writeJson(path.join(dataDir, "g24_curriculum.json"), source);
writeJson(path.join(dataDir, "curriculum.schema.json"), readJson(schemaPath));

const sourceIdList = (refs = []) => refs.map((ref) => ref.sourceId);
const sourceDetails = (refs = []) => refs.map((ref) => ({ ...ref }));
const knowledgeById = new Map(source.knowledge.map((item) => [item.id, item]));
const prerequisiteById = new Map(source.prerequisiteKnowledge.map((item) => [item.id, item]));
const questionByUnit = new Map();
for (const question of source.questions) {
  const list = questionByUnit.get(question.unitId) ?? [];
  list.push(question);
  questionByUnit.set(question.unitId, list);
}

function collectPrerequisiteKnowledgeIds(unit) {
  const unitKnowledgeIds = new Set(unit.knowledgeIds);
  const collected = [];
  const seen = new Set();
  const visit = (id) => {
    if (seen.has(id) || unitKnowledgeIds.has(id)) return;
    seen.add(id);
    const item = knowledgeById.get(id);
    if (!item) return;
    collected.push(id);
    for (const dependency of item.prerequisites?.knowledgeIds ?? []) visit(dependency);
  };
  for (const id of unit.knowledgeIds) {
    for (const dependency of knowledgeById.get(id)?.prerequisites?.knowledgeIds ?? []) visit(dependency);
  }
  return collected;
}

function eligible(question, kind) {
  return kind === "practice" ? question.eligibility !== "assessment" : question.eligibility !== "practice";
}

function chooseQuestions(unit, kind, count, alreadyChosen) {
  const all = (questionByUnit.get(unit.id) ?? []).filter((q) => eligible(q, kind));
  const chosen = [];
  const chosenIds = new Set(alreadyChosen);
  const minimums = unit.sampling.perKnowledgeMinimums ?? [];
  const add = (question) => {
    if (chosen.length >= count || chosenIds.has(question.id)) return false;
    chosen.push(question);
    chosenIds.add(question.id);
    return true;
  };
  // Stable, coverage-first selection: input order is the published tie-breaker.
  for (const minimum of minimums) {
    let needed = minimum[kind === "practice" ? "practice" : "assessment"];
    for (const question of all) {
      if (needed <= 0) break;
      if (question.knowledgeIds.includes(minimum.knowledgeId) && add(question)) needed -= 1;
    }
    if (needed > 0) throw new Error(`${unit.id}: ${kind} minimum cannot be satisfied for ${minimum.knowledgeId}`);
  }
  for (const question of all) add(question);
  if (chosen.length !== count) throw new Error(`${unit.id}: selected ${chosen.length} ${kind} questions, expected ${count}`);
  return chosen;
}

const units = source.units.map((unit) => {
  const questions = questionByUnit.get(unit.id) ?? [];
  const practice = chooseQuestions(unit, "practice", unit.sampling.practiceCount, new Set());
  const assessment = chooseQuestions(
    unit,
    "assessment",
    unit.sampling.testCount,
    unit.sampling.avoidRepeatingQuestionIds ? new Set(practice.map((q) => q.id)) : new Set(),
  );
  const knowledge = unit.knowledgeIds.map((id) => {
    const item = knowledgeById.get(id);
    if (!item) throw new Error(`${unit.id}: unknown knowledge ${id}`);
    return {
      id: item.id,
      label: item.name,
      description: item.description,
      prerequisites: item.prerequisites?.knowledgeIds ?? [],
      sourceRefs: sourceIdList(item.sourceRefs),
      sourceRefDetails: sourceDetails(item.sourceRefs),
    };
  });
  const prerequisiteKnowledgeIds = collectPrerequisiteKnowledgeIds(unit);
  const toQuestion = (q) => ({
    id: q.id,
    type: "multiple-choice",
    prompt: q.prompt,
    choices: q.choices,
    answer: q.correctLabel,
    explanation: q.rationale,
    knowledgeIds: q.knowledgeIds,
    eligibility: q.eligibility === "both" ? "both" : q.eligibility,
    misconceptionRationale: q.misconceptions?.[0]?.description,
    misconceptionChoiceLabel: q.misconceptions?.[0]?.choiceLabel,
    rubricCriteriaIds: q.rubricCriteriaIds,
    answerAmbiguity: q.answerAmbiguity,
    answerAnalysis: q.answerAnalysis,
    sourceRefs: sourceIdList(q.sourceRefs),
    sourceRefDetails: sourceDetails(q.sourceRefs),
    difficulty: q.difficulty === "basic" ? "intro" : q.difficulty === "advanced" ? "challenge" : "standard",
  });
  return {
    id: unit.id,
    title: unit.title,
    description: unit.summary,
    prerequisiteKnowledge: [
      ...new Set([
        ...unit.knowledgeIds.flatMap((id) => knowledgeById.get(id)?.prerequisites?.prerequisiteKnowledgeIds ?? []),
        ...prerequisiteKnowledgeIds,
      ]),
    ].map((id) => {
      const knowledgeItem = knowledgeById.get(id);
      if (knowledgeItem) {
        return {
          id: knowledgeItem.id,
          label: knowledgeItem.name,
          description: knowledgeItem.description,
          prerequisites: knowledgeItem.prerequisites?.knowledgeIds ?? [],
          sourceRefs: sourceIdList(knowledgeItem.sourceRefs),
          sourceRefDetails: sourceDetails(knowledgeItem.sourceRefs),
        };
      }
      const item = prerequisiteById.get(id);
      if (!item) throw new Error(`${unit.id}: unknown prerequisite ${id}`);
      return { id: item.id, label: item.name, description: item.description };
    }),
    knowledge,
    questionBank: questions.map(toQuestion),
    sampling: {
      practiceCount: practice.length,
      testCount: assessment.length,
      minKnowledgeCoverage: unit.knowledgeIds.length,
      avoidRepeatingQuestionIds: unit.sampling.avoidRepeatingQuestionIds,
      deterministicSeedStrategy: unit.sampling.deterministicSeedStrategy,
      perKnowledgeMinimums: Object.fromEntries((unit.sampling.perKnowledgeMinimums ?? []).map((m) => [m.knowledgeId, { practice: m.practice, assessment: m.assessment }])),
    },
    practiceQuestionIds: practice.map((q) => q.id),
    assessmentQuestionIds: assessment.map((q) => q.id),
    sourceRefs: sourceIdList(unit.sourceRefs),
    sourceRefDetails: sourceDetails(unit.sourceRefs),
  };
});

const runtime = {
  schemaVersion: "1.0.0",
  curriculumId: source.curriculum.id,
  title: source.curriculum.title,
  language: source.curriculum.language,
  sources: source.sources.map((item) => ({
    id: item.id,
    title: item.title,
    kind: item.type === "workbook" || item.type === "textbook-reference"
      ? "textbook"
      : item.type === "answer-key"
        ? "teacher-note"
        : "original",
    locator: item.note,
  })),
  rubricCriteria: source.rubricCriteria.map((item) => ({
    id: item.id,
    label: item.name,
    description: item.description,
  })),
  units,
  provenance: { sourceFile: "g24_curriculum.json", sourceSchema: "curriculum.schema.json" },
};
writeJson(path.join(generatedDir, "g24-runtime.json"), runtime);

const catalog = units.map((unit) => ({
  id: unit.id,
  title: unit.title,
  description: unit.description,
  knowledgeTopics: unit.knowledge.map((item) => ({ id: item.id, label: item.label })),
  practiceCount: unit.sampling.practiceCount,
  testCount: unit.sampling.testCount,
}));
const ts = `// Generated by scripts/build-g24-runtime.mjs. Do not edit by hand.\nexport const CURRICULUM_ID = ${JSON.stringify(source.curriculum.id)};\nexport const CURRICULUM_VERSION = 1;\nexport type UnitCatalogEntry = {\n  id: string;\n  title: string;\n  description: string;\n  knowledgeTopics: ReadonlyArray<{ id: string; label: string }>;\n  practiceCount: number;\n  testCount: number;\n};\nexport const UNIT_CATALOG: ReadonlyArray<UnitCatalogEntry> = ${JSON.stringify(catalog, null, 2)};\n`;
fs.writeFileSync(path.join(generatedDir, "unit-catalog.ts"), ts);
console.log(`Generated G24 runtime: ${units.length} units, ${units.reduce((n, u) => n + u.knowledge.length, 0)} knowledge, ${source.questions.length} questions`);
