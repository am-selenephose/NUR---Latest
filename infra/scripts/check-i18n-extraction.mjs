#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

const DOM_COPY_PROPERTIES = new Set(["textContent", "placeholder", "title"]);
const LOCALE_SENSITIVE_ATTRIBUTES = new Set(["aria-label", "title"]);
const COPY_HELPER_ARGUMENTS = new Map([
  ["setText", [2]],
  ["setPlaceholder", [2]],
  ["setDirectLabel", [2]],
  ["setLeadingText", [2]],
  ["setTrailingText", [2]],
  ["setTitleParts", [2, 3]],
]);

function directLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function location(sourceFile, node) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: start.line + 1, column: start.character + 1 };
}

export function findUnextractedCopy(sourceText, fileName = "source.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations = [];

  const add = (kind, node, value) => {
    const rendered = value.trim();
    if (!rendered) return;
    violations.push({ file: fileName, kind, value: rendered, ...location(sourceFile, node) });
  };

  const visit = node => {
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && DOM_COPY_PROPERTIES.has(node.left.name.text)
    ) {
      const value = directLiteral(node.right);
      if (value !== null) add(node.left.name.text, node.right, value);
    }

    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "setAttribute"
    ) {
      const attribute = node.arguments[0] ? directLiteral(node.arguments[0]) : null;
      const value = node.arguments[1] ? directLiteral(node.arguments[1]) : null;
      if (attribute && value !== null && LOCALE_SENSITIVE_ATTRIBUTES.has(attribute)) {
        add(attribute, node.arguments[1], value);
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const indexes = COPY_HELPER_ARGUMENTS.get(node.expression.text) ?? [];
      for (const index of indexes) {
        const argument = node.arguments[index];
        const value = argument ? directLiteral(argument) : null;
        if (argument && value !== null) add(node.expression.text, argument, value);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

export function checkI18nExtraction(root) {
  const targets = ["apps/web/src/bridge/v197I18n.ts"];
  return targets.flatMap(relativePath => {
    const absolutePath = resolve(root, relativePath);
    return findUnextractedCopy(readFileSync(absolutePath, "utf8"), relativePath);
  });
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const violations = checkI18nExtraction(root);
  if (violations.length > 0) {
    for (const row of violations) {
      process.stderr.write(`${row.file}:${row.line}:${row.column} ${row.kind}: ${JSON.stringify(row.value)}\n`);
    }
    process.stderr.write(`I18N_EXTRACTION=FAIL scanned=1 violations=${violations.length}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("I18N_EXTRACTION=PASS scanned=1 violations=0\n");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
