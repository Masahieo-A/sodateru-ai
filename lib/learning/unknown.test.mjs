import assert from "node:assert/strict";
import test from "node:test";
import { unresolvedUnknown } from "./unknown.ts";

test("explicit unknown keeps a previously taught topic unresolved", () => {
  const dialogue = [
    { role: "teacher", content: "be動詞の後ろで主語の内容を説明する" },
    { role: "teacher", content: "分からない", unknownTopics: [2] },
  ];
  assert.equal(unresolvedUnknown(dialogue, 2, dialogue[0].content), true);
  assert.equal(unresolvedUnknown(dialogue, 1, dialogue[0].content), false);
});

test("a later explanation can resolve an unknown topic", () => {
  const dialogue = [
    { role: "teacher", content: "分からない", unknownTopics: [2] },
    { role: "student", content: "どうしてですか？" },
    { role: "teacher", content: "be動詞の後ろで主語の内容を説明する" },
  ];
  assert.equal(unresolvedUnknown(dialogue, 2, "be動詞の後ろで主語の内容を説明する"), false);
});
