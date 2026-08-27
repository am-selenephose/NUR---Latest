import assert from "node:assert/strict";
import test from "node:test";

import { result } from "../scripts/check-i18n-catalog-parity.mjs";

test("bundled static catalogs have exact 35-locale parity", () => {
  assert.equal(result.locales, 35);
  assert.equal(result.variants, 37);
  assert.equal(result.keys, 944);
  assert.deepEqual(result.errors, []);
});
