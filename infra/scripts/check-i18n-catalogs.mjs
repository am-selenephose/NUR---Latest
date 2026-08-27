#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SUPPORTED_LOCALES = [
  "en", "ur", "hi", "bn", "pa", "ar", "fa", "tr", "id", "ms",
  "zh-Hans", "zh-Hant", "ja", "ko", "vi", "th", "fil", "ta", "te",
  "mr", "gu", "kn", "ml", "ru", "uk", "pl", "de", "fr", "es", "pt",
  "it", "nl", "sv", "ro", "sw",
];

export const CATALOG_TARGETS = SUPPORTED_LOCALES.flatMap(locale => {
  if (locale === "ur" || locale === "hi") {
    return [
      { locale, catalog: `${locale}-roman`, preference: "roman" },
      { locale, catalog: `${locale}-script`, preference: "script" },
    ];
  }
  return [{
    locale,
    catalog: locale,
    preference: locale === "en" ? "default" : "locale-default",
  }];
});

const PLACEHOLDER = /\{\d+\}/gu;
const ROMAN_SCRIPT_LEAKAGE = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u097f]/u;
const APPROVED_SOURCE_INVARIANTS = new Set([
  "NUR",
  "OpenAI",
  "Amina Rahman",
  "Naval Ravikant",
  "Seth Godin",
  "Sharon Salzberg",
  "Adrienne Maree Brown",
  "you@example.com",
  "NUR DIAG RM:{0}",
]);
const ADDRESS_OR_PATH = /^(?:https?:\/\/|[^\s@]+@[^\s@]+\.[^\s@]+|\/[A-Za-z0-9_./-]+$)/u;
const INVARIANT_UNIT = /^\{\d+\}\s*(?:B|KB|MB|GB|TB)$/u;
const CRYPTOGRAPHIC_IDENTIFIER = /^[\s·:()\[\]-]*(?:sha-?256|sha-?512|md5)[\s·:()\[\]-]*$/iu;

function placeholders(value) {
  return [...value.matchAll(PLACEHOLDER)].map(match => match[0]).sort();
}

export function isApprovedSourceInvariant(source) {
  if (APPROVED_SOURCE_INVARIANTS.has(source)) return true;
  if (ADDRESS_OR_PATH.test(source) || INVARIANT_UNIT.test(source) || CRYPTOGRAPHIC_IDENTIFIER.test(source)) return true;
  const semantic = source
    .replaceAll(PLACEHOLDER, "")
    .replace(/[\p{P}\p{S}\p{N}\s]/gu, "");
  return semantic.length === 0;
}

export function validateCatalogSet(catalogs, targets = CATALOG_TARGETS, expectedLocaleCount = 35) {
  const locales = new Set(targets.map(target => target.locale));
  const catalogIds = targets.map(target => target.catalog);
  if (locales.size !== expectedLocaleCount) {
    throw new Error(`locale count failure: expected ${expectedLocaleCount}, got ${locales.size}`);
  }
  if (new Set(catalogIds).size !== catalogIds.length) throw new Error("duplicate catalog target");
  const actualIds = Object.keys(catalogs).sort();
  const expectedIds = [...catalogIds].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`catalog set failure: expected=${expectedIds.join(",")} actual=${actualIds.join(",")}`);
  }

  const english = catalogs.en;
  if (!english || typeof english !== "object" || Array.isArray(english)) {
    throw new Error("English source catalog is missing");
  }
  const englishKeys = Object.keys(english).sort();
  for (const id of catalogIds) {
    const catalog = catalogs[id];
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
      throw new Error(`${id}: catalog is not an object`);
    }
    if (id !== "en" && catalog === english) throw new Error(`${id}: English fallback object detected`);
    const keys = Object.keys(catalog).sort();
    if (JSON.stringify(keys) !== JSON.stringify(englishKeys)) {
      throw new Error(`${id}: key parity failure`);
    }
    if (catalog.NUR !== "NUR") throw new Error(`${id}: NUR invariant changed`);
    for (const source of englishKeys) {
      const value = catalog[source];
      if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${id}: empty translation for ${JSON.stringify(source)}`);
      }
      if (JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(source))) {
        throw new Error(`${id}: placeholder parity failure for ${JSON.stringify(source)}`);
      }
      if (id !== "en" && value === source && !isApprovedSourceInvariant(source)) {
        throw new Error(`${id}: unexplained English source-identical translation for ${JSON.stringify(source)}`);
      }
      if (["ur-roman", "hi-roman"].includes(id) && ROMAN_SCRIPT_LEAKAGE.test(value)) {
        throw new Error(`${id}: native-script leakage in ${JSON.stringify(value)}`);
      }
    }
  }
  return { locales: locales.size, catalogs: catalogIds.length, keys: englishKeys.length };
}

export function loadCatalogSet(root, targets = CATALOG_TARGETS) {
  const directory = resolve(root, "apps/web/src/lib/i18n/catalogs");
  return Object.fromEntries(targets.map(target => [
    target.catalog,
    JSON.parse(readFileSync(resolve(directory, `${target.catalog}.json`), "utf8")),
  ]));
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const result = validateCatalogSet(loadCatalogSet(root));
  process.stdout.write(
    `I18N_CATALOGS=PASS locales=${result.locales} catalogs=${result.catalogs} keys=${result.keys} fallback=0\n`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
