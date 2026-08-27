#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CATALOG_IDS = [
  "en", "ur-roman", "ur-script", "hi-roman", "hi-script", "bn", "pa", "ar", "fa",
  "tr", "id", "ms", "zh-Hans", "zh-Hant", "ja", "ko", "vi", "th", "fil", "ta",
  "te", "mr", "gu", "kn", "ml", "ru", "uk", "pl", "de", "fr", "es", "pt",
  "it", "nl", "sv", "ro", "sw",
];

function identifier(index) {
  return `catalog${index}`;
}

export function buildCatalogModule(root) {
  const catalogDir = resolve(root, "apps/web/src/lib/i18n/catalogs");
  const english = JSON.parse(readFileSync(resolve(catalogDir, "en.json"), "utf8"));
  const englishKeys = Object.keys(english).sort();
  const missingFiles = CATALOG_IDS.filter(id => !existsSync(resolve(catalogDir, `${id}.json`)));
  if (missingFiles.length) throw new Error(`Missing UI catalogs: ${missingFiles.join(", ")}`);

  for (const id of CATALOG_IDS) {
    const catalog = JSON.parse(readFileSync(resolve(catalogDir, `${id}.json`), "utf8"));
    const keys = Object.keys(catalog).sort();
    if (JSON.stringify(keys) !== JSON.stringify(englishKeys)) {
      throw new Error(`${id}: UI catalog key parity failure`);
    }
  }

  const imports = CATALOG_IDS.map(
    (id, index) => `import ${identifier(index)} from "./catalogs/${id}.json";`,
  ).join("\n");
  const rows = CATALOG_IDS.map(
    (id, index) => `  ${JSON.stringify(id)}: ${identifier(index)},`,
  ).join("\n");
  return `${imports}\n\nexport const UI_CATALOGS = {\n${rows}\n} as const;\n\n`
    + "export type UiCatalogId = keyof typeof UI_CATALOGS;\n"
    + "export type UiCopyKey = keyof typeof catalog0;\n"
    + "export type UiCatalog = Record<UiCopyKey, string>;\n";
}

function main() {
  const root = resolve(import.meta.dirname, "../../..");
  const output = resolve(root, "apps/web/src/lib/i18n/catalogs.generated.ts");
  const rendered = buildCatalogModule(root);
  const check = process.argv.includes("--check");
  if (check) {
    if (!existsSync(output) || readFileSync(output, "utf8") !== rendered) {
      throw new Error("catalogs.generated.ts is stale; rebuild the i18n catalog module");
    }
  } else {
    writeFileSync(output, rendered);
  }
  process.stdout.write(`I18N_MODULE=PASS mode=${check ? "check" : "write"} catalogs=${CATALOG_IDS.length} output=${output}\n`);
}

if (import.meta.main) main();
