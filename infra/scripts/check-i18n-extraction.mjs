#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

const DOM_COPY_PROPERTIES = new Set(["textContent", "innerText", "placeholder", "title", "innerHTML", "outerHTML"]);
const LOCALE_SENSITIVE_ATTRIBUTES = new Set(["aria-label", "aria-labelledby", "aria-description", "title", "placeholder", "alt"]);
const COPY_HELPER_ARGUMENTS = new Map([
  ["element", [3]],
  ["button", [1]],
  ["panel", [1, 2]],
  ["empty", [1, 2]],
  ["status", [1]],
  ["setStatus", [1]],
  ["fact", [1, 2]],
  ["labeledControl", [1]],
  ["createTextNode", [0]],
  ["text", [1]],
  ["ownText", [1]],
  ["setText", [2]],
  ["setPlaceholder", [2]],
  ["setDirectLabel", [2]],
  ["setLeadingText", [2]],
  ["setTrailingText", [2]],
  ["setTitleParts", [2, 3]],
  ["mount", [1, 2]],
]);

function staticSource(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    node.templateSpans.forEach((span, index) => { value += `{{${index}}}${span.literal.text}`; });
    return value;
  }
  return null;
}

function location(sourceFile, node) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: start.line + 1, column: start.character + 1 };
}

function isCatalogExpression(node) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "v197Copy";
}

function isVisibleCandidate(value) {
  if (!value || value.trim().length < 2) return false;
  const text = value.trim();
  if (text.startsWith("/") || text.startsWith("#") || text.startsWith(".") || text.startsWith("http") || text.startsWith("data:")) return false;
  if (/^(?:nur-|data-|aria-|v197-|f4-|scope-|page-|world-|route-|action-|talk-|today-|live-|owner-|recovery-)/i.test(text)) return false;
  if (/^(?:[A-Za-z]+[-_]){1,}[A-Za-z0-9_-]+$/.test(text) && !text.includes(" ")) return false;
  if (/^[A-Z0-9_:-]+$/.test(text) && text.length > 2) return false;
  if (/^(?:div|span|button|section|article|option|label|header|main|nav|style|input|textarea|alert|status|true|false|null|undefined|GET|POST|PATCH|DELETE)$/.test(text)) return false;
  return /[A-Za-z\u0080-\uFFFF]/.test(text);
}

export function findUnextractedCopy(sourceText, fileName = "source.ts") {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations = [];
  const add = (kind, node, value) => {
    const rendered = value?.trim();
    if (!isVisibleCandidate(rendered)) return;
    violations.push({ file: fileName, kind, value: rendered, ...location(sourceFile, node) });
  };
  const visit = node => {
    if (isCatalogExpression(node)) return;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) && DOM_COPY_PROPERTIES.has(node.left.name.text)) {
      const value = staticSource(node.right);
      if (value !== null) add(node.left.name.text, node.right, value);
    }
    if (ts.isCallExpression(node)) {
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "setAttribute") {
        const attribute = node.arguments[0] ? staticSource(node.arguments[0]) : null;
        const valueNode = node.arguments[2] ?? node.arguments[1];
        const value = valueNode ? staticSource(valueNode) : null;
        if (attribute && value !== null && LOCALE_SENSITIVE_ATTRIBUTES.has(attribute)) add(`attribute:${attribute}`, valueNode, value);
      }
      const name = ts.isIdentifier(node.expression) ? node.expression.text : "";
      const indexes = Object.prototype.hasOwnProperty.call(Object.fromEntries(COPY_HELPER_ARGUMENTS), name) ? COPY_HELPER_ARGUMENTS.get(name) : [];
      for (const index of indexes ?? []) {
        const argument = node.arguments[index];
        const value = argument ? staticSource(argument) : null;
        if (argument && value !== null) add(`${name}:${index}`, argument, value);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

function sourceFiles(root) {
  const bridgeRoot = resolve(root, "apps/web/src/bridge");
  return readdirSync(bridgeRoot).filter(name => name.endsWith(".ts") && !name.endsWith(".test.ts")).sort().map(name => join(bridgeRoot, name));
}

function findFallbackViolations(root) {
  const files = [resolve(root, "apps/web/src/lib/i18n.ts"), resolve(root, "apps/web/src/bridge/v197I18n.ts")].filter(existsSync);
  const patterns = [
    /CORE_COPY\[locale\]\s*\?\?=\s*CORE_COPY\.en/,
    /CRITICAL_COPY\[locale\]\s*\?\?=\s*enCritical/,
    /V197_NAV_COPY\[locale\][^\n]*\?\?\s*enNavigation/,
    /LANGUAGE_CONTROL_COPY\[locale\][^\n]*enLanguageControls/,
    /\?\?\s*enNavigation/,
    /\?\?\s*enLanguageControls/,
    /\?\?\s*enCritical/,
  ];
  return files.flatMap(file => {
    const text = readFileSync(file, "utf8");
    return patterns.filter(pattern => pattern.test(text)).map(pattern => ({ file: file.replace(`${root}/`, ""), kind: "supported-locale-fallback", value: pattern.source, line: text.slice(0, text.search(pattern)).split("\n").length, column: 1 }));
  });
}

export function checkI18nExtraction(root) {
  const targets = sourceFiles(root);
  return {
    scanned: targets.length,
    violations: targets.flatMap(file => findUnextractedCopy(readFileSync(file, "utf8"), file.replace(`${root}/`, ""))).concat(findFallbackViolations(root)),
  };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const result = checkI18nExtraction(root);
  if (result.violations.length > 0) {
    for (const row of result.violations) process.stderr.write(`${row.file}:${row.line}:${row.column} ${row.kind}: ${JSON.stringify(row.value)}\n`);
    process.stderr.write(`I18N_EXTRACTION=FAIL scanned=${result.scanned} violations=${result.violations.length}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`I18N_EXTRACTION=PASS scanned=${result.scanned} violations=0\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
