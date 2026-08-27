#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const schemaText = readFileSync(join(repo, "apps/web/src/i18n/schema.ts"), "utf8");
const manifest = JSON.parse(readFileSync(join(repo, "apps/web/src/i18n/source-manifest.json"), "utf8"));
const catalogDir = join(repo, "apps/web/src/i18n/catalogs");
const locales = ["en", "ur", "hi", "bn", "pa", "ar", "fa", "tr", "id", "ms", "zh-Hans", "zh-Hant", "ja", "ko", "vi", "th", "fil", "ta", "te", "mr", "gu", "kn", "ml", "ru", "uk", "pl", "de", "fr", "es", "pt", "it", "nl", "sv", "ro", "sw"];
const variantMap = { en: ["default"], ur: ["roman", "script"], hi: ["roman", "script"], bn: ["default"], pa: ["default"], ar: ["script"], fa: ["script"], tr: ["default"], id: ["default"], ms: ["default"], "zh-Hans": ["default"], "zh-Hant": ["default"], ja: ["default"], ko: ["default"], vi: ["default"], th: ["default"], fil: ["default"], ta: ["default"], te: ["default"], mr: ["default"], gu: ["default"], kn: ["default"], ml: ["default"], ru: ["default"], uk: ["default"], pl: ["default"], de: ["default"], fr: ["default"], es: ["default"], pt: ["default"], it: ["default"], nl: ["default"], sv: ["default"], ro: ["default"], sw: ["default"] };
const errors = [];
const keys = manifest.map((row) => row.id);
const sourceByKey = new Map(manifest.map((row) => [row.id, row.source]));
const parsedLocales = [...schemaText.matchAll(/export const SUPPORTED_LOCALES = \[([\s\S]*?)\] as const;/g)][0]?.[1]?.match(/"([^"]+)"/g)?.map((value) => value.slice(1, -1)) ?? [];
if (parsedLocales.join("|") !== locales.join("|")) errors.push(`supported locale order mismatch: ${parsedLocales.join(",")}`);
if (locales.length !== 35 || new Set(locales).size !== 35) errors.push(`expected exactly 35 locales, got ${locales.length}`);
  if (manifest.length !== 944 || new Set(keys).size !== manifest.length) errors.push(`expected 944 unique manifest keys, got ${manifest.length}`);
const loaded = new Map();
for (const locale of locales) {
  for (const variant of variantMap[locale]) {
    const file = locale === "ur" || locale === "hi" ? `${locale}-${variant}.json` : `${locale}.json`;
    const catalog = JSON.parse(readFileSync(join(catalogDir, file), "utf8"));
    loaded.set(`${locale}:${variant}`, catalog);
    const actual = Object.keys(catalog).sort();
    const expected = [...keys].sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) errors.push(`${locale}:${variant} key parity mismatch`);
    for (const key of keys) {
      const value = catalog[key];
      if (typeof value !== "string" || !value.trim()) errors.push(`${locale}:${variant}:${key} blank/non-string value`);
      const source = sourceByKey.get(key) ?? "";
      const sourcePlaceholders = [...source.matchAll(/\{\{\d+\}\}/g)].map((match) => match[0]).sort();
      const targetPlaceholders = [...String(value).matchAll(/\{\{\d+\}\}/g)].map((match) => match[0]).sort();
      if (sourcePlaceholders.join("|") !== targetPlaceholders.join("|")) errors.push(`${locale}:${variant}:${key} placeholder mismatch`);
      if (source.includes("NUR") && !String(value).includes("NUR")) errors.push(`${locale}:${variant}:${key} changed protected NUR brand`);
    }
  }
}
const english = loaded.get("en:default");
for (const [id, catalog] of loaded) {
  const [locale] = id.split(":");
  if (locale !== "en" && JSON.stringify(catalog) === JSON.stringify(english)) errors.push(`${id} is identical to English catalog`);
}
for (const id of ["ur:roman", "hi:roman"]) {
  const catalog = loaded.get(id);
  for (const [key, value] of Object.entries(catalog)) {
    if (/[\u0600-\u06ff\u0750-\u077f\u0900-\u097f]/u.test(value)) errors.push(`${id}:${key} contains native-script text in Roman variant`);
  }
}
const result = { locales: locales.length, variants: loaded.size, keys: keys.length, errors };
if (errors.length) {
  for (const error of errors) process.stderr.write(`${error}\n`);
  process.stderr.write(`I18N_CATALOG_PARITY=FAIL locales=${locales.length} variants=${loaded.size} keys=${keys.length} errors=${errors.length}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`I18N_CATALOG_PARITY=PASS locales=${locales.length} variants=${loaded.size} keys=${keys.length} errors=0\n`);
}
export { result };
