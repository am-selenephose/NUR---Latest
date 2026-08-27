#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { JSDOM } from "jsdom";
import ts from "typescript";

import { findUnextractedCopy, UI_SOURCE_TARGETS } from "./check-i18n-extraction.mjs";

const FRAME_SOURCES = {
  entry: "docs/reference/entry_decoded_v197.html",
  universe: "docs/reference/universe_decoded_v197.html",
};
const COPY_ATTRIBUTES = ["aria-label", "placeholder", "title"];
const LEGACY_COPY_CONSTANTS = new Set(["enNavigation", "enLanguageControls", "enCritical"]);

function normalizeCopy(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function hasWords(value) {
  return /[\p{L}\p{N}]/u.test(value);
}

function selectorFor(element) {
  if (element.id) return `[id=${JSON.stringify(element.id)}]`;
  const parts = [];
  let current = element;
  while (current && current.localName !== "html") {
    if (current.id) {
      parts.unshift(`[id=${JSON.stringify(current.id)}]`);
      break;
    }
    const parent = current.parentElement;
    if (!parent) break;
    const sameTag = [...parent.children].filter(child => child.localName === current.localName);
    const index = sameTag.indexOf(current) + 1;
    parts.unshift(`${current.localName}:nth-of-type(${index})`);
    current = parent;
  }
  return parts.join(" > ");
}

function parseFrame(root, frame) {
  const relativePath = FRAME_SOURCES[frame];
  const source = readFileSync(resolve(root, relativePath), "utf8")
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/giu, "$1$2")
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/giu, "$1$2");
  const document = new JSDOM(source).window.document;
  const slots = [];
  const elements = [document.querySelector("title"), ...document.body.querySelectorAll("*")].filter(Boolean);

  for (const element of elements) {
    if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) continue;
    const selector = selectorFor(element);
    const textNodes = [...element.childNodes].filter(node => node.nodeType === 3);
    textNodes.forEach((node, textIndex) => {
      const sourceCopy = normalizeCopy(node.nodeValue ?? "");
      if (!sourceCopy || !hasWords(sourceCopy)) return;
      slots.push({ frame, selector, kind: "text", textIndex, source: sourceCopy });
    });
    for (const attribute of COPY_ATTRIBUTES) {
      const sourceCopy = normalizeCopy(element.getAttribute(attribute) ?? "");
      if (!sourceCopy || !hasWords(sourceCopy)) continue;
      slots.push({ frame, selector, kind: "attribute", attribute, source: sourceCopy });
    }
  }
  return { document, slots };
}

function collectConstCopy(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const values = new Set();

  function collect(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = normalizeCopy(node.text);
      if (value && hasWords(value)) values.add(value);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const value = normalizeCopy(node.templateSpans.reduce(
        (result, span, index) => `${result}{${index}}${span.literal.text}`,
        node.head.text,
      ));
      if (value && hasWords(value)) values.add(value);
      return;
    }
    ts.forEachChild(node, collect);
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !LEGACY_COPY_CONSTANTS.has(declaration.name.text)) continue;
      if (declaration.initializer) collect(declaration.initializer);
    }
  }
  return values;
}

export function collectCatalogCalls(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const values = new Set();
  const visit = node => {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && ["uiCopy", "uiFormat", "uiSource"].includes(node.expression.text)
    ) {
      const source = node.arguments[0];
      if (!source || !(ts.isStringLiteral(source) || ts.isNoSubstitutionTemplateLiteral(source))) {
        if (node.expression.text === "uiCopy") return;
        throw new Error(`${fileName}: ${node.expression.text} requires a static source key`);
      }
      const value = normalizeCopy(source.text);
      if (value && hasWords(value)) values.add(value);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return values;
}

export function buildV197CanonicalSlots(root) {
  return Object.keys(FRAME_SOURCES).flatMap(frame => parseFrame(root, frame).slots);
}

export function validateCanonicalSlots(root, slots) {
  const failures = [];
  for (const frame of Object.keys(FRAME_SOURCES)) {
    const { document } = parseFrame(root, frame);
    for (const slot of slots.filter(row => row.frame === frame)) {
      const element = document.querySelector(slot.selector);
      if (!element) {
        failures.push(`${frame}: missing ${slot.selector}`);
        continue;
      }
      if (slot.kind === "text") {
        const textNodes = [...element.childNodes].filter(node => node.nodeType === 3);
        const actual = normalizeCopy(textNodes[slot.textIndex]?.nodeValue ?? "");
        if (actual !== slot.source) failures.push(`${frame}: stale text ${slot.selector}#${slot.textIndex}`);
      } else if (normalizeCopy(element.getAttribute(slot.attribute) ?? "") !== slot.source) {
        failures.push(`${frame}: stale ${slot.attribute} ${slot.selector}`);
      }
    }
  }
  return failures;
}

export function buildEnglishSourceCatalog(root) {
  const sources = new Set(["NUR", "Private Orbit", "Say it plainly..."]);
  for (const target of UI_SOURCE_TARGETS) {
    const sourceText = readFileSync(resolve(root, target), "utf8");
    for (const violation of findUnextractedCopy(sourceText, target)) sources.add(normalizeCopy(violation.value));
    for (const value of collectCatalogCalls(sourceText, target)) sources.add(value);
  }
  for (const slot of buildV197CanonicalSlots(root)) sources.add(slot.source);
  const legacyPath = resolve(root, "apps/web/src/lib/i18n.ts");
  for (const value of collectConstCopy(readFileSync(legacyPath, "utf8"), legacyPath)) sources.add(value);

  return Object.fromEntries([...sources].filter(hasWords).sort((a, b) => a.localeCompare(b)).map(source => [source, source]));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderJson(value));
}

function renderJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertCurrent(path, expected) {
  const actual = readFileSync(path, "utf8");
  if (actual !== expected) throw new Error(`${relative(process.cwd(), path)} is stale; rebuild the i18n source catalog`);
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const catalog = buildEnglishSourceCatalog(root);
  const slots = buildV197CanonicalSlots(root);
  const failures = validateCanonicalSlots(root, slots);
  if (failures.length) throw new Error(failures.join("\n"));

  const catalogPath = resolve(root, "apps/web/src/lib/i18n/catalogs/en.json");
  const slotsPath = resolve(root, "apps/web/src/lib/i18n/v197-canonical-slots.json");
  const check = process.argv.includes("--check");
  if (check) {
    assertCurrent(catalogPath, renderJson(catalog));
    assertCurrent(slotsPath, renderJson(slots));
  } else {
    writeJson(catalogPath, catalog);
    writeJson(slotsPath, slots);
  }
  process.stdout.write(
    `I18N_SOURCE=PASS mode=${check ? "check" : "write"} keys=${Object.keys(catalog).length} slots=${slots.length} `
    + `catalog=${relative(root, catalogPath)} slots_file=${relative(root, slotsPath)}\n`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
