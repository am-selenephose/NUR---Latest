import assert from "node:assert/strict";
import test from "node:test";

import { findUnextractedCopy } from "../scripts/check-i18n-extraction.mjs";

test("rejects direct locale-sensitive DOM copy literals", () => {
  const violations = findUnextractedCopy(`
    function paint(node, input, button) {
      node.textContent = "Raw visible copy";
      input.placeholder = "Raw placeholder";
      button.title = "Raw title";
      button.setAttribute("aria-label", "Raw accessible name");
      setText(document, "#status", "Raw helper copy");
    }
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.kind),
    ["textContent", "placeholder", "title", "aria-label", "setText"],
  );
});

test("accepts catalog-backed DOM copy expressions and structural literals", () => {
  const violations = findUnextractedCopy(`
    function paint(document, node, input, button, copy) {
      node.textContent = copy.heading;
      input.placeholder = copy.placeholder;
      button.title = copy.title;
      button.setAttribute("aria-label", copy.accessibleName);
      setText(document, "#status", copy.status);
      node.id = "structural-id";
      node.className = "structural-class";
    }
  `, "fixture.ts");

  assert.deepEqual(violations, []);
});
