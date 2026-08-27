#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { UI_SOURCE_TARGETS, findUnextractedCopy } from "./check-i18n-extraction.mjs";

const I18N_MODULE = "../lib/i18n";

function replacementFor(row) {
  const prefixLength = row.rawValue.indexOf(row.value);
  const suffixStart = prefixLength + row.value.length;
  const prefix = prefixLength > 0 ? row.rawValue.slice(0, prefixLength) : "";
  const suffix = suffixStart < row.rawValue.length ? row.rawValue.slice(suffixStart) : "";
  const translated = row.expressions.length > 0
    ? `uiFormat(${JSON.stringify(row.value)}, [${row.expressions.join(", ")}])`
    : `uiCopy(${JSON.stringify(row.value)})`;
  if (!prefix && !suffix) return translated;
  return `(${JSON.stringify(prefix)} + ${translated} + ${JSON.stringify(suffix)})`;
}

function addImports(sourceText, fileName, names) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const existing = sourceFile.statements.find(statement => (
    ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text === I18N_MODULE
  ));
  if (existing && ts.isImportDeclaration(existing)) {
    const bindings = existing.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) {
      throw new Error(`${fileName}: cannot extend non-named ${I18N_MODULE} import`);
    }
    const imported = new Set(bindings.elements.map(element => element.name.text));
    const missing = names.filter(name => !imported.has(name));
    if (missing.length === 0) return sourceText;
    const insertion = bindings.elements.length > 0 ? `, ${missing.join(", ")}` : missing.join(", ");
    const position = bindings.getEnd() - 1;
    return `${sourceText.slice(0, position)}${insertion}${sourceText.slice(position)}`;
  }

  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  const position = imports.at(-1)?.getEnd() ?? 0;
  const declaration = `\nimport { ${names.join(", ")} } from ${JSON.stringify(I18N_MODULE)};`;
  return `${sourceText.slice(0, position)}${declaration}${sourceText.slice(position)}`;
}

export function transformI18nSource(sourceText, fileName = "source.ts") {
  const violations = findUnextractedCopy(sourceText, fileName);
  if (violations.length === 0) return sourceText;
  const names = [
    "uiCopy",
    ...(violations.some(row => row.expressions.length > 0) ? ["uiFormat"] : []),
  ];
  let transformed = sourceText;
  for (const row of [...violations].sort((left, right) => right.start - left.start)) {
    transformed = `${transformed.slice(0, row.start)}${replacementFor(row)}${transformed.slice(row.end)}`;
  }
  transformed = addImports(transformed, fileName, names);
  const remaining = findUnextractedCopy(transformed, fileName);
  if (remaining.length > 0) {
    throw new Error(`${fileName}: codemod left ${remaining.length} raw UI literals`);
  }
  return transformed;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  let changed = 0;
  for (const relativePath of UI_SOURCE_TARGETS) {
    if (relativePath.endsWith("/lib/i18n.ts") || relativePath.endsWith("/bridge/v197I18n.ts")) continue;
    const absolutePath = resolve(root, relativePath);
    const source = readFileSync(absolutePath, "utf8");
    const transformed = transformI18nSource(source, relativePath);
    if (transformed === source) continue;
    writeFileSync(absolutePath, transformed, "utf8");
    changed += 1;
    process.stdout.write(`I18N_MIGRATED=${relativePath}\n`);
  }
  process.stdout.write(`I18N_MIGRATION=PASS files=${changed}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
