import type { CurriculumDocument, CurriculumQuestion, CurriculumUnit } from "./types";

export type ValidationIssue = { path: string; message: string };

const idPattern = /^[a-z0-9][a-z0-9._-]*$/;
const add = (issues: ValidationIssue[], path: string, message: string) => issues.push({ path, message });

function validateQuestion(q: CurriculumQuestion, path: string, knowledgeIds: Set<string>, sourceIds: Set<string>, rubricIds: Set<string>, issues: ValidationIssue[]) {
  if (!idPattern.test(q.id)) add(issues, `${path}.id`, "use stable lowercase ids (a-z, 0-9, ., _, -)");
  if (q.choices.length !== 4) add(issues, `${path}.choices`, "must contain exactly four choices");
  const labels = new Set(q.choices.map((c) => c.label));
  if (labels.size !== q.choices.length) add(issues, `${path}.choices`, "choice labels must be unique");
  if (!labels.has(q.answer)) add(issues, `${path}.answer`, "answer must match a choice label");
  for (const id of q.knowledgeIds) if (!knowledgeIds.has(id)) add(issues, `${path}.knowledgeIds`, `unknown knowledge id: ${id}`);
  for (const id of q.sourceRefs ?? []) if (!sourceIds.has(id)) add(issues, `${path}.sourceRefs`, `unknown source id: ${id}`);
  if (q.answerAmbiguity && q.answerAmbiguity.status !== "unique") add(issues, `${path}.answerAmbiguity`, "questions must be marked unique before publishing");
  if (q.answerAnalysis) {
    const analysis = q.answerAnalysis;
    const analysisPath = `${path}.answerAnalysis`;
    if (!analysis.target?.trim()) add(issues, `${analysisPath}.target`, "must name the concept being tested");
    if (!analysis.rationale?.trim()) add(issues, `${analysisPath}.rationale`, "must explain why the keyed answer matches the target");
    const choiceLabels = new Set(q.choices.map((choice) => choice.label));
    for (const label of choiceLabels) {
      const classification = analysis.choiceClassifications?.[label];
      if (!classification?.trim()) add(issues, `${analysisPath}.choiceClassifications.${label}`, "must classify every answer choice");
    }
    for (const label of Object.keys(analysis.choiceClassifications ?? {})) {
      if (!choiceLabels.has(label)) add(issues, `${analysisPath}.choiceClassifications.${label}`, "must refer to an existing choice");
    }
    const matchingLabels = q.choices
      .filter((choice) => analysis.choiceClassifications?.[choice.label]?.trim() === analysis.target?.trim())
      .map((choice) => choice.label);
    if (matchingLabels.length !== 1) add(issues, `${analysisPath}.target`, "must match exactly one classified choice");
    if (matchingLabels.length === 1 && matchingLabels[0] !== q.answer) {
      add(issues, `${analysisPath}.target`, "the uniquely matching choice must equal answer");
    }
  }
  for (const id of q.rubricCriteriaIds ?? []) if (!rubricIds.has(id)) add(issues, `${path}.rubricCriteriaIds`, `unknown rubric criterion: ${id}`);
}

function validateUnit(unit: CurriculumUnit, path: string, sourceIds: Set<string>, rubricIds: Set<string>, issues: ValidationIssue[]) {
  if (!idPattern.test(unit.id)) add(issues, `${path}.id`, "use a stable lowercase id");
  for (const ref of unit.sourceRefs ?? []) if (!sourceIds.has(ref)) add(issues, `${path}.sourceRefs`, `unknown source id: ${ref}`);
  const knowledgeIds = new Set<string>();
  const prerequisiteIds = new Set<string>();
  for (const [i, k] of (unit.prerequisiteKnowledge ?? []).entries()) {
    if (prerequisiteIds.has(k.id)) add(issues, `${path}.prerequisiteKnowledge[${i}].id`, "duplicate prerequisite knowledge id");
    prerequisiteIds.add(k.id);
    if (!idPattern.test(k.id)) add(issues, `${path}.prerequisiteKnowledge[${i}].id`, "use a stable lowercase id");
    for (const ref of k.sourceRefs ?? []) if (!sourceIds.has(ref)) add(issues, `${path}.prerequisiteKnowledge[${i}].sourceRefs`, `unknown source id: ${ref}`);
  }
  unit.knowledge.forEach((k, i) => {
    if (prerequisiteIds.has(k.id)) add(issues, `${path}.knowledge[${i}].id`, "must not duplicate prerequisite knowledge id");
    if (knowledgeIds.has(k.id)) add(issues, `${path}.knowledge[${i}].id`, "duplicate knowledge id");
    knowledgeIds.add(k.id);
    if (!idPattern.test(k.id)) add(issues, `${path}.knowledge[${i}].id`, "use a stable lowercase id");
    for (const ref of k.sourceRefs ?? []) if (!sourceIds.has(ref)) add(issues, `${path}.knowledge[${i}].sourceRefs`, `unknown source id: ${ref}`);
  });
  unit.knowledge.forEach((k, i) => {
    for (const prerequisite of k.prerequisites ?? []) if (!knowledgeIds.has(prerequisite) && !prerequisiteIds.has(prerequisite)) add(issues, `${path}.knowledge[${i}].prerequisites`, `unknown knowledge id: ${prerequisite}`);
  });
  const questionIds = new Set<string>();
  unit.questionBank.forEach((q, i) => {
    if (questionIds.has(q.id)) add(issues, `${path}.questionBank[${i}].id`, "duplicate question id");
    questionIds.add(q.id);
    validateQuestion(q, `${path}.questionBank[${i}]`, knowledgeIds, sourceIds, rubricIds, issues);
  });
  if (!Number.isInteger(unit.sampling.practiceCount) || unit.sampling.practiceCount < 0) add(issues, `${path}.sampling.practiceCount`, "must be a non-negative integer");
  if (!Number.isInteger(unit.sampling.testCount) || unit.sampling.testCount < 0) add(issues, `${path}.sampling.testCount`, "must be a non-negative integer");
  if (unit.sampling.practiceCount + unit.sampling.testCount > unit.questionBank.length) add(issues, `${path}.sampling`, "requested sample counts exceed question bank size");
  const minimums = unit.sampling.perKnowledgeMinimums ?? {};
  for (const [id, minimum] of Object.entries(minimums)) {
    if (!knowledgeIds.has(id)) add(issues, `${path}.sampling.perKnowledgeMinimums`, `unknown knowledge id: ${id}`);
    const practiceEligibleForKnowledge = unit.questionBank.filter((q) => q.knowledgeIds.includes(id) && q.eligibility !== "assessment").length;
    const assessmentEligibleForKnowledge = unit.questionBank.filter((q) => q.knowledgeIds.includes(id) && q.eligibility !== "practice").length;
    if (!Number.isInteger(minimum.practice) || minimum.practice < 0 || minimum.practice > practiceEligibleForKnowledge) add(issues, `${path}.sampling.perKnowledgeMinimums.${id}.practice`, "practice minimum is impossible");
    if (!Number.isInteger(minimum.assessment) || minimum.assessment < 0 || minimum.assessment > assessmentEligibleForKnowledge) add(issues, `${path}.sampling.perKnowledgeMinimums.${id}.assessment`, "assessment minimum is impossible");
  }
  const practiceEligible = unit.questionBank.filter((q) => q.eligibility !== "assessment").length;
  const assessmentEligible = unit.questionBank.filter((q) => q.eligibility !== "practice").length;
  for (const knowledgeId of knowledgeIds) {
    if (!unit.questionBank.some((q) => q.knowledgeIds.includes(knowledgeId))) add(issues, `${path}.knowledge`, `no question covers knowledge id: ${knowledgeId}`);
  }
  const requestedPracticeMinimumTotal = Object.values(minimums).reduce((sum, value) => sum + value.practice, 0);
  const requestedAssessmentMinimumTotal = Object.values(minimums).reduce((sum, value) => sum + value.assessment, 0);
  if (requestedPracticeMinimumTotal > unit.sampling.practiceCount) add(issues, `${path}.sampling.perKnowledgeMinimums`, "practice minimums cannot fit within practiceCount");
  if (requestedAssessmentMinimumTotal > unit.sampling.testCount) add(issues, `${path}.sampling.perKnowledgeMinimums`, "assessment minimums cannot fit within testCount");
  if ((unit.sampling.minKnowledgeCoverage ?? 0) > knowledgeIds.size) add(issues, `${path}.sampling.minKnowledgeCoverage`, "exceeds teachable knowledge count");
  if (unit.sampling.practiceCount > practiceEligible) add(issues, `${path}.sampling.practiceCount`, "exceeds practice-eligible questions");
  if (unit.sampling.testCount > assessmentEligible) add(issues, `${path}.sampling.testCount`, "exceeds assessment-eligible questions");
}

export function validateCurriculum(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!value || typeof value !== "object") return [{ path: "$", message: "curriculum must be an object" }];
  const doc = value as Partial<CurriculumDocument>;
  if (doc.schemaVersion !== "1.0.0") add(issues, "schemaVersion", "must be 1.0.0");
  if (!doc.curriculumId || !idPattern.test(doc.curriculumId)) add(issues, "curriculumId", "must be a stable lowercase id");
  if (!Array.isArray(doc.sources)) add(issues, "sources", "must be an array");
  if (!Array.isArray(doc.rubricCriteria)) add(issues, "rubricCriteria", "must be an array");
  if (!Array.isArray(doc.units)) add(issues, "units", "must be an array");
  if (!Array.isArray(doc.sources) || !Array.isArray(doc.units)) return issues;
  const sourceIds = new Set<string>();
  doc.sources.forEach((s, i) => {
    if (sourceIds.has(s.id)) add(issues, `sources[${i}].id`, "duplicate source id");
    sourceIds.add(s.id);
    if (!idPattern.test(s.id)) add(issues, `sources[${i}].id`, "use a stable lowercase id");
    if (s.kind !== "textbook" && s.kind !== "teacher-note" && s.kind !== "open-resource" && s.kind !== "original") add(issues, `sources[${i}].kind`, "unsupported source kind");
  });
  const rubricIds = new Set<string>();
  for (const rubric of doc.rubricCriteria ?? []) {
    if (!idPattern.test(rubric.id)) add(issues, "rubricCriteria", `invalid rubric criterion id: ${rubric.id}`);
    if (rubricIds.has(rubric.id)) add(issues, "rubricCriteria", "duplicate rubric criterion id");
    rubricIds.add(rubric.id);
  }
  const unitIds = new Set<string>();
  doc.units.forEach((u, i) => {
    if (unitIds.has(u.id)) add(issues, `units[${i}].id`, "duplicate unit id");
    unitIds.add(u.id);
    validateUnit(u, `units[${i}]`, sourceIds, rubricIds, issues);
  });
  return issues;
}

export function assertValidCurriculum(value: unknown): asserts value is CurriculumDocument {
  const issues = validateCurriculum(value);
  if (issues.length) throw new Error(`Invalid curriculum:\n${issues.map((i) => `${i.path}: ${i.message}`).join("\n")}`);
}
