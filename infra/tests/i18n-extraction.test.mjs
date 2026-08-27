import assert from "node:assert/strict";
import test from "node:test";

import { checkI18nExtraction, findUnextractedCopy } from "../scripts/check-i18n-extraction.mjs";


test("rejects raw visible copy across every supported DOM construction path", () => {
  const violations = findUnextractedCopy(`
    function paint(document, node, input, button) {
      node.textContent = "Raw visible copy";
      input.placeholder = "Raw placeholder";
      button.title = \`Raw title \${count}\`;
      button.setAttribute("aria-label", "Raw accessible name");
      button.setAttribute("alt", "Raw alternative");
      setText(document, "#status", "Raw helper copy");
      ownText(node, "Raw own text");
      mount(document, "Raw mount title", "Raw mount subtitle");
      element(document, "div", "structural-class", "Raw element copy");
      node.innerHTML = "<b>Raw inserted copy</b>";
    }
  `, "fixture.ts");

  assert.deepEqual(
    violations.map(row => row.kind),
    ["textContent", "placeholder", "title", "attribute:aria-label", "attribute:alt", "setText:2", "ownText:1", "mount:1", "mount:2", "element:3", "innerHTML"],
  );
});


test("accepts catalog-backed expressions and structural literals", () => {
  const violations = findUnextractedCopy(`
    function paint(document, node, input, button, copy) {
      node.textContent = v197Copy("Heading");
      input.placeholder = v197Copy("Placeholder");
      button.title = v197Copy("Title", { 0: count });
      button.setAttribute("aria-label", v197Copy("Accessible name"));
      setText(document, "#status", v197Copy("Status"));
      ownText(node, v197Copy("Own text"));
      mount(document, v197Copy("Mount title"), v197Copy("Mount subtitle"));
      element(document, "div", "structural-class", v197Copy("Element copy"));
      node.id = "structural-id";
      node.className = "structural-class";
    }
  `, "fixture.ts");

  assert.deepEqual(violations, []);
});


test("repository-wide extraction and fallback gate is clean", () => {
  const root = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
  const result = checkI18nExtraction(root);
  assert.equal(result.scanned, 29);
  assert.deepEqual(result.violations, []);
});
