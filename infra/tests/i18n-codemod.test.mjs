import assert from "node:assert/strict";
import test from "node:test";

import { findUnextractedCopy } from "../scripts/check-i18n-extraction.mjs";
import { transformI18nSource } from "../scripts/migrate-i18n-copy.mjs";

test("migrates literal and interpolated UI copy without changing structural literals", () => {
  const source = `
import { api } from "../lib/api";

function paint(document, ownerName) {
  const node = document.createElement("div");
  node.className = "stable-geometry";
  node.textContent = "Raw visible copy";
  node.setAttribute("aria-label", \`Open \${ownerName}'s settings\`);
  return element(document, "p", "copy", "Bounded helper copy");
}
`;

  const transformed = transformI18nSource(source, "apps/web/src/bridge/example.ts");

  assert.match(transformed, /import \{ uiCopy, uiFormat \} from "\.\.\/lib\/i18n";/);
  assert.match(transformed, /uiCopy\("Raw visible copy"\)/);
  assert.match(transformed, /uiFormat\("Open \{0\}'s settings", \[ownerName\]\)/);
  assert.match(transformed, /className = "stable-geometry"/);
  assert.deepEqual(findUnextractedCopy(transformed, "example.ts"), []);
});
