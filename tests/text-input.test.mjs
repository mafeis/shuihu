import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

test("game shortcuts ignore text editing and IME composition", () => {
  assert.match(source, /function isTextEditable\(target\)/);
  assert.match(
    source,
    /window\.addEventListener\("keydown", \(event\) => \{\s+if \(isTextEditable\(event\.target\)\) \{[\s\S]*?return;\s+\}/,
  );
  assert.match(
    source,
    /function isGameShortcut\(event\)[\s\S]*?event\.key === "Escape"[\s\S]*?event\.key === "Enter"[\s\S]*?\["a", "t", "c", "1", "2", "4"\]/,
  );
});

test("full-screen renders restore text focus and selection", () => {
  assert.match(source, /pendingInputRestore \|\|= captureInputRestore\(document\.activeElement\)/);
  assert.match(source, /restoreInputFocus\(\);/);
  assert.match(source, /input\.setSelectionRange\(/);
});

test("story click-to-advance ignores text editing", () => {
  assert.match(
    source,
    /screen === "story" &&\s+!isTextEditable\(event\.target\)/,
  );
});
