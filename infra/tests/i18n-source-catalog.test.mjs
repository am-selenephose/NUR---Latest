import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import {
  buildEnglishSourceCatalog,
  buildV197CanonicalSlots,
  collectCatalogCalls,
  validateCanonicalSlots,
} from "../scripts/build-i18n-source-catalog.mjs";

const root = resolve(import.meta.dirname, "../..");

test("builds one broad English UI-copy authority", () => {
  const catalog = buildEnglishSourceCatalog(root);
  const keys = Object.keys(catalog);

  assert.ok(keys.length > 500, `expected more than 500 UI keys, got ${keys.length}`);
  assert.equal(catalog.NUR, "NUR");
  assert.equal(catalog.Today, "Today");
  assert.equal(catalog["Choose NUR language"], "Choose NUR language");
  assert.equal(catalog["There is a universe"], "There is a universe");
});

test("keeps migrated uiCopy and uiFormat source keys in the canonical schema", () => {
  assert.deepEqual(
    [...collectCatalogCalls(`
      node.textContent = uiCopy("Persisted label");
      node.title = uiFormat("Saved {0} items", [count]);
      const label = uiSource("Deferred product label");
      node.id = structural("not-ui-copy");
    `, "fixture.ts")],
    ["Persisted label", "Saved {0} items", "Deferred product label"],
  );
});

test("generates stable canonical slots without changing source geometry", () => {
  const slots = buildV197CanonicalSlots(root);
  const frames = new Set(slots.map(slot => slot.frame));

  assert.deepEqual(frames, new Set(["entry", "universe"]));
  assert.ok(slots.length > 250, `expected more than 250 canonical slots, got ${slots.length}`);
  assert.ok(slots.every(slot => slot.source.trim().length > 0));
  assert.deepEqual(validateCanonicalSlots(root, slots), []);
});
