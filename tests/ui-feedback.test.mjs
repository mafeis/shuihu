import assert from "node:assert/strict";
import test from "node:test";

import {
  clickFeedbackOrigin,
  currencyFeedback,
} from "../src/ui-feedback.js";

test("currency feedback distinguishes spending and gaining", () => {
  assert.deepEqual(currencyFeedback(320, 250), {
    delta: -70,
    tone: "spend",
    label: "-70",
  });
  assert.deepEqual(currencyFeedback(250, 390), {
    delta: 140,
    tone: "gain",
    label: "+140",
  });
  assert.equal(currencyFeedback(250, 250), null);
  assert.equal(currencyFeedback(null, 250), null);
});

test("click feedback follows the pointer while staying inside its control", () => {
  const element = {
    getBoundingClientRect: () => ({
      left: 20,
      top: 40,
      right: 180,
      bottom: 100,
      width: 160,
      height: 60,
    }),
  };
  assert.deepEqual(
    clickFeedbackOrigin(element, { clientX: 82, clientY: 64 }),
    { x: 82, y: 64, width: 160, height: 60 },
  );
  assert.deepEqual(
    clickFeedbackOrigin(element, { clientX: 500, clientY: 4 }),
    { x: 180, y: 40, width: 160, height: 60 },
  );
  assert.deepEqual(clickFeedbackOrigin(element), {
    x: 100,
    y: 70,
    width: 160,
    height: 60,
  });
  assert.equal(clickFeedbackOrigin(null), null);
});
