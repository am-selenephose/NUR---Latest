import assert from "node:assert/strict";
import test from "node:test";

import { validateCatalogSet } from "../scripts/check-i18n-catalogs.mjs";

const targets = [
  { locale: "en", catalog: "en", preference: "default" },
  { locale: "ur", catalog: "ur-roman", preference: "roman" },
  { locale: "ur", catalog: "ur-script", preference: "script" },
];

test("accepts strict key parity with complete writing variants", () => {
  const catalogs = {
    en: { NUR: "NUR", "Saved {0}": "Saved {0}", Open: "Open" },
    "ur-roman": { NUR: "NUR", "Saved {0}": "{0} mehfooz", Open: "Kholo" },
    "ur-script": { NUR: "NUR", "Saved {0}": "{0} محفوظ", Open: "کھولیں" },
  };

  assert.deepEqual(validateCatalogSet(catalogs, targets, 2), {
    locales: 2,
    catalogs: 3,
    keys: 3,
  });
});

test("rejects silent gaps, placeholder drift, and Roman native-script leakage", () => {
  const valid = {
    en: { NUR: "NUR", "Saved {0}": "Saved {0}", Open: "Open" },
    "ur-roman": { NUR: "NUR", "Saved {0}": "{0} mehfooz", Open: "Kholo" },
    "ur-script": { NUR: "NUR", "Saved {0}": "{0} محفوظ", Open: "کھولیں" },
  };

  assert.throws(
    () => validateCatalogSet({ ...valid, "ur-script": { NUR: "NUR", Open: "کھولیں" } }, targets, 2),
    /key parity/,
  );
  assert.throws(
    () => validateCatalogSet({ ...valid, "ur-script": { ...valid["ur-script"], "Saved {0}": "محفوظ" } }, targets, 2),
    /placeholder parity/,
  );
  assert.throws(
    () => validateCatalogSet({ ...valid, "ur-roman": { ...valid["ur-roman"], Open: "کھولیں" } }, targets, 2),
    /native-script leakage/,
  );
});

test("rejects unexplained English while allowing explicit invariants", () => {
  const untranslated = {
    en: { NUR: "NUR", "No persisted Timeline event yet.": "No persisted Timeline event yet." },
    "ur-roman": { NUR: "NUR", "No persisted Timeline event yet.": "No persisted Timeline event yet." },
    "ur-script": { NUR: "NUR", "No persisted Timeline event yet.": "ابھی کوئی محفوظ ٹائم لائن واقعہ نہیں۔" },
  };

  assert.throws(
    () => validateCatalogSet(untranslated, targets, 2),
    /unexplained English source-identical translation/,
  );
});

test("allows cryptographic identifiers without allowing ordinary English", () => {
  const catalogs = {
    en: { NUR: "NUR", "· sha256": "· sha256", "SHA-256": "SHA-256", Open: "Open" },
    "ur-roman": { NUR: "NUR", "· sha256": "· sha256", "SHA-256": "SHA-256", Open: "Kholo" },
    "ur-script": { NUR: "NUR", "· sha256": "· sha256", "SHA-256": "SHA-256", Open: "کھولیں" },
  };

  assert.deepEqual(validateCatalogSet(catalogs, targets, 2), {
    locales: 2,
    catalogs: 3,
    keys: 4,
  });
});
