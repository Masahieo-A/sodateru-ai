import assert from "node:assert/strict";
import test from "node:test";
import { validateCurriculum } from "./validation.ts";

const documentWithQuestion = (choiceClassifications = {
  A: "permission",
  B: "request",
  C: "ability",
  D: "possibility",
}) => ({
  schemaVersion: "1.0.0",
  curriculumId: "test.curriculum",
  title: "Test",
  language: "ja",
  sources: [],
  rubricCriteria: [],
  units: [{
    id: "test.unit",
    title: "Test",
    description: "Test",
    knowledge: [{ id: "test.knowledge", label: "Test", description: "Test" }],
    questionBank: [{
      id: "test.question",
      type: "multiple-choice",
      prompt: "Choose the ability use of can.",
      choices: ["A", "B", "C", "D"].map((label) => ({ label, text: label })),
      answer: "C",
      explanation: "C expresses ability.",
      answerAmbiguity: { status: "unique", note: "Exactly one option matches the target." },
      answerAnalysis: {
        target: "ability",
        choiceClassifications,
        rationale: "Only C expresses the target concept.",
      },
      knowledgeIds: ["test.knowledge"],
    }],
    sampling: { practiceCount: 0, testCount: 0 },
  }],
});

test("accepts a single-choice question with one explicitly classified correct answer", () => {
  assert.deepEqual(validateCurriculum(documentWithQuestion()), []);
});

test("rejects a single-choice question whose target classification matches multiple choices", () => {
  const issues = validateCurriculum(documentWithQuestion({
    A: "permission",
    B: "request",
    C: "ability",
    D: "ability",
  }));
  assert.ok(issues.some((issue) => issue.path.endsWith("answerAnalysis.target") && issue.message.includes("exactly one")));
});

test("rejects an answer key that conflicts with the unique target classification", () => {
  const value = documentWithQuestion();
  value.units[0].questionBank[0].answer = "D";
  const issues = validateCurriculum(value);
  assert.ok(issues.some((issue) => issue.path.endsWith("answerAnalysis.target") && issue.message.includes("equal answer")));
});
