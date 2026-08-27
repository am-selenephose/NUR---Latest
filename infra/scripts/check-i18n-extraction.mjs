#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

const DOM_COPY_PROPERTIES = new Set([
  "textContent", "nodeValue", "placeholder", "title", "alt", "innerHTML", "outerHTML",
]);
const VISIBLE_STATE_PROPERTIES = new Set(["notice", "error"]);
const DOM_COPY_METHODS = new Set(["append", "prepend", "replaceChildren"]);
const LOCALE_SENSITIVE_ATTRIBUTES = new Set([
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
  "title",
  "alt",
]);
const STRUCTURAL_COPY_INVARIANTS = new Set(["DEDICATED_INSIGHT"]);
const COPY_HELPER_ARGUMENTS = new Map([
  ["element", [3]],
  ["el", [3]],
  ["button", [1]],
  ["empty", [1, 2]],
  ["status", [1]],
  ["field", [1, 2]],
  ["setText", [2]],
  ["setPlaceholder", [2]],
  ["setDirectLabel", [2]],
  ["setLeadingText", [2]],
  ["setTrailingText", [2]],
  ["setTitleParts", [2, 3]],
  ["nurToast", [0]],
  ["renderInsightInspection", [4]],
]);

function parameterReferences(node, parameters) {
  const byName = new Map(parameters.flatMap((parameter, index) => (
    ts.isIdentifier(parameter.name) ? [[parameter.name.text, index]] : []
  )));
  const references = new Set();
  const visit = current => {
    if (ts.isIdentifier(current) && byName.has(current.text)) references.add(byName.get(current.text));
    if (ts.isConditionalExpression(current)) {
      visit(current.whenTrue);
      visit(current.whenFalse);
      return;
    }
    if (ts.isElementAccessExpression(current)) {
      visit(current.expression);
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return references;
}

function inferCopyHelperArguments(sourceFile) {
  const inferred = new Map(
    [...COPY_HELPER_ARGUMENTS].map(([name, indexes]) => [name, new Set(indexes)]),
  );
  const functions = [];
  const collect = node => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      functions.push({ name: node.name.text, parameters: node.parameters, body: node.body });
    } else if (
      ts.isMethodDeclaration(node)
      && node.body
      && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))
    ) {
      functions.push({ name: node.name.text, parameters: node.parameters, body: node.body });
    } else if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      && node.initializer.body
    ) {
      functions.push({ name: node.name.text, parameters: node.initializer.parameters, body: node.initializer.body });
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);

  let changed = true;
  while (changed) {
    changed = false;
    for (const row of functions) {
      const copyIndexes = inferred.get(row.name) ?? new Set();
      const before = copyIndexes.size;
      const inspect = node => {
        if (
          ts.isBinaryExpression(node)
          && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isPropertyAccessExpression(node.left)
          && (
            DOM_COPY_PROPERTIES.has(node.left.name.text)
            || VISIBLE_STATE_PROPERTIES.has(node.left.name.text)
          )
        ) {
          for (const index of parameterReferences(node.right, row.parameters)) copyIndexes.add(index);
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const method = node.expression.name.text;
          if (method === "setAttribute") {
            const attribute = node.arguments[0] ? directLiteral(node.arguments[0]) : null;
            if (attribute && LOCALE_SENSITIVE_ATTRIBUTES.has(attribute) && node.arguments[1]) {
              for (const index of parameterReferences(node.arguments[1], row.parameters)) copyIndexes.add(index);
            }
          } else if (method === "insertAdjacentHTML" && node.arguments[1]) {
            for (const index of parameterReferences(node.arguments[1], row.parameters)) copyIndexes.add(index);
          } else if (DOM_COPY_METHODS.has(method)) {
            for (const argument of node.arguments) {
              for (const index of parameterReferences(argument, row.parameters)) copyIndexes.add(index);
            }
          } else if (
            node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
            || COPY_HELPER_ARGUMENTS.has(method)
          ) {
            const nestedIndexes = inferred.get(method) ?? new Set();
            for (const argumentIndex of nestedIndexes) {
              const argument = node.arguments[argumentIndex];
              if (!argument) continue;
              for (const index of parameterReferences(argument, row.parameters)) copyIndexes.add(index);
            }
          }
        }
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const nestedIndexes = inferred.get(node.expression.text) ?? new Set();
          for (const argumentIndex of nestedIndexes) {
            const argument = node.arguments[argumentIndex];
            if (!argument) continue;
            for (const index of parameterReferences(argument, row.parameters)) copyIndexes.add(index);
          }
        }
        ts.forEachChild(node, inspect);
      };
      inspect(row.body);
      if (copyIndexes.size > before) {
        inferred.set(row.name, copyIndexes);
        changed = true;
      }
    }
  }
  return new Map([...inferred].map(([name, indexes]) => [name, [...indexes].sort()]));
}

function inferReturnedArguments(sourceFile) {
  const inferred = new Map();
  const functions = [];
  const collect = node => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      functions.push({ name: node.name.text, parameters: node.parameters, body: node.body });
    } else if (
      ts.isMethodDeclaration(node)
      && node.body
      && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))
    ) {
      functions.push({ name: node.name.text, parameters: node.parameters, body: node.body });
    } else if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      functions.push({
        name: node.name.text,
        parameters: node.initializer.parameters,
        body: node.initializer.body,
      });
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);

  const valueReferences = (node, parameters, target) => {
    const byName = new Map(parameters.flatMap((parameter, index) => (
      ts.isIdentifier(parameter.name) ? [[parameter.name.text, index]] : []
    )));
    const visit = current => {
      if (ts.isIdentifier(current)) {
        if (byName.has(current.text)) target.add(byName.get(current.text));
        return;
      }
      if (
        ts.isParenthesizedExpression(current)
        || ts.isAsExpression(current)
        || ts.isTypeAssertionExpression(current)
        || ts.isNonNullExpression(current)
        || ts.isSatisfiesExpression(current)
      ) {
        visit(current.expression);
        return;
      }
      if (ts.isConditionalExpression(current)) {
        visit(current.whenTrue);
        visit(current.whenFalse);
        return;
      }
      if (ts.isBinaryExpression(current)) {
        if ([
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(current.operatorToken.kind)) {
          visit(current.left);
          visit(current.right);
        }
        return;
      }
      if (ts.isTemplateExpression(current)) {
        for (const span of current.templateSpans) visit(span.expression);
        return;
      }
      if (ts.isCallExpression(current)) {
        const helperName = ts.isIdentifier(current.expression)
          ? current.expression.text
          : ts.isPropertyAccessExpression(current.expression)
            ? current.expression.name.text
            : null;
        const returned = helperName ? inferred.get(helperName) ?? [] : [];
        if (returned.length) {
          for (const index of returned) {
            const argument = current.arguments[index];
            if (argument) visit(argument);
          }
        } else if (
          ts.isPropertyAccessExpression(current.expression)
          && ["trim", "toLowerCase", "toUpperCase", "replace", "replaceAll"]
            .includes(current.expression.name.text)
        ) {
          visit(current.expression.expression);
        }
        return;
      }
      if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
        visit(current.expression);
        return;
      }
      if (ts.isArrayLiteralExpression(current)) {
        for (const element of current.elements) visit(element);
        return;
      }
      if (ts.isObjectLiteralExpression(current)) {
        for (const property of current.properties) {
          if (ts.isPropertyAssignment(property)) visit(property.initializer);
          if (ts.isShorthandPropertyAssignment(property)) visit(property.name);
        }
      }
    };
    visit(node);
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const row of functions) {
      const indexes = new Set(inferred.get(row.name) ?? []);
      const before = indexes.size;
      if (!ts.isBlock(row.body)) {
        valueReferences(row.body, row.parameters, indexes);
      } else {
        const inspect = node => {
          if (ts.isReturnStatement(node) && node.expression) {
            valueReferences(node.expression, row.parameters, indexes);
            return;
          }
          ts.forEachChild(node, inspect);
        };
        inspect(row.body);
      }
      if (indexes.size > before) {
        inferred.set(row.name, [...indexes].sort());
        changed = true;
      }
    }
  }
  return inferred;
}

function directLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.templateSpans.reduce(
      (value, span, index) => `${value}{${index}}${span.literal.text}`,
      node.head.text,
    );
  }
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
  const violationLocations = new Set();
  const helperArguments = inferCopyHelperArguments(sourceFile);
  const returnedArguments = inferReturnedArguments(sourceFile);
  const declarations = new Map();
  const bindingDeclarations = new Map();

  const lexicalScope = node => {
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isSourceFile(current) || ts.isBlock(current) || ts.isFunctionLike(current)) return current;
    }
    return sourceFile;
  };

  const collectDeclarations = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const rows = declarations.get(node.name.text) ?? [];
      rows.push({ declaration: node, initializer: node.initializer, scope: lexicalScope(node) });
      declarations.set(node.name.text, rows);
    }
    if (
      ts.isBindingElement(node)
      && ts.isIdentifier(node.name)
      && ts.isArrayBindingPattern(node.parent)
      && ts.isVariableDeclaration(node.parent.parent)
      && ts.isVariableDeclarationList(node.parent.parent.parent)
      && ts.isForOfStatement(node.parent.parent.parent.parent)
    ) {
      const statement = node.parent.parent.parent.parent;
      const rows = bindingDeclarations.get(node.name.text) ?? [];
      rows.push({
        declaration: node,
        expression: statement.expression,
        index: node.parent.elements.indexOf(node),
        scope: lexicalScope(statement),
      });
      bindingDeclarations.set(node.name.text, rows);
    }
    ts.forEachChild(node, collectDeclarations);
  };
  collectDeclarations(sourceFile);

  const declarationFor = identifier => {
    const position = identifier.getStart(sourceFile);
    return (declarations.get(identifier.text) ?? [])
      .filter(row => (
        row.declaration.getStart(sourceFile) < position
        && row.scope.getStart(sourceFile) <= position
        && row.scope.getEnd() >= position
      ))
      .sort((left, right) => {
        const leftWidth = left.scope.getEnd() - left.scope.getStart(sourceFile);
        const rightWidth = right.scope.getEnd() - right.scope.getStart(sourceFile);
        return leftWidth - rightWidth
          || right.declaration.getStart(sourceFile) - left.declaration.getStart(sourceFile);
      })[0];
  };

  const bindingFor = identifier => {
    const position = identifier.getStart(sourceFile);
    return (bindingDeclarations.get(identifier.text) ?? [])
      .filter(row => (
        row.declaration.getStart(sourceFile) < position
        && row.scope.getStart(sourceFile) <= position
        && row.scope.getEnd() >= position
      ))
      .sort((left, right) => (
        right.declaration.getStart(sourceFile) - left.declaration.getStart(sourceFile)
      ))[0];
  };

  const deferredValues = (node, seen = new Set()) => {
    if (seen.has(node)) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(node);
    if (
      ts.isParenthesizedExpression(node)
      || ts.isAsExpression(node)
      || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node)
      || ts.isSatisfiesExpression(node)
    ) {
      return deferredValues(node.expression, nextSeen);
    }
    if (ts.isIdentifier(node)) {
      const binding = bindingFor(node);
      if (binding) {
        return deferredValues(binding.expression, nextSeen).flatMap(collection => {
          if (!ts.isArrayLiteralExpression(collection)) return [node];
          return collection.elements.flatMap(entry => (
            deferredValues(entry, nextSeen).flatMap(tuple => {
              if (!ts.isArrayLiteralExpression(tuple)) return [];
              const selected = tuple.elements[binding.index];
              return selected ? deferredValues(selected, nextSeen) : [];
            })
          ));
        });
      }
      const row = declarationFor(node);
      return row ? deferredValues(row.initializer, nextSeen) : [node];
    }
    if (ts.isConditionalExpression(node)) {
      return [
        ...deferredValues(node.whenTrue, nextSeen),
        ...deferredValues(node.whenFalse, nextSeen),
      ];
    }
    if (ts.isPropertyAccessExpression(node)) {
      const propertyName = node.name.text;
      return deferredValues(node.expression, nextSeen).flatMap(container => {
        if (!ts.isObjectLiteralExpression(container)) return [node];
        const property = container.properties.find(row => (
          ts.isPropertyAssignment(row)
          && ((ts.isIdentifier(row.name) && row.name.text === propertyName)
            || (ts.isStringLiteralLike(row.name) && row.name.text === propertyName))
        ));
        return property && ts.isPropertyAssignment(property)
          ? deferredValues(property.initializer, nextSeen)
          : [node];
      });
    }
    if (ts.isElementAccessExpression(node)) {
      const rawKey = node.argumentExpression ? directLiteral(node.argumentExpression) : null;
      const numericKey = node.argumentExpression && ts.isNumericLiteral(node.argumentExpression)
        ? Number(node.argumentExpression.text)
        : null;
      return deferredValues(node.expression, nextSeen).flatMap(container => {
        if (ts.isArrayLiteralExpression(container)) {
          if (numericKey !== null) {
            const selected = container.elements[numericKey];
            return selected ? deferredValues(selected, nextSeen) : [node];
          }
          return container.elements.flatMap(row => deferredValues(row, nextSeen));
        }
        if (ts.isObjectLiteralExpression(container)) {
          const properties = container.properties.filter(ts.isPropertyAssignment);
          const selected = rawKey === null
            ? properties
            : properties.filter(row => (
                (ts.isIdentifier(row.name) && row.name.text === rawKey)
                || (ts.isStringLiteralLike(row.name) && row.name.text === rawKey)
              ));
          return selected.flatMap(row => deferredValues(row.initializer, nextSeen));
        }
        return [node];
      });
    }
    return [node];
  };

  const add = (kind, node, value) => {
    const rendered = value.trim();
    if (STRUCTURAL_COPY_INVARIANTS.has(rendered)) return;
    const lexicalCopy = rendered.replace(/\{\d+\}/gu, "");
    const copyPattern = kind === "uiFormat-value" ? /\p{L}/u : /[\p{L}\p{N}]/u;
    if (!rendered || !copyPattern.test(lexicalCopy)) return;
    const locationKey = `${node.getStart(sourceFile)}:${node.getEnd()}`;
    if (violationLocations.has(locationKey)) return;
    violationLocations.add(locationKey);
    violations.push({
      file: fileName,
      kind,
      value: rendered,
      rawValue: value,
      start: node.getStart(sourceFile),
      end: node.getEnd(),
      expressions: ts.isTemplateExpression(node)
        ? node.templateSpans.map(span => span.expression.getText(sourceFile))
        : [],
      ...location(sourceFile, node),
    });
  };

  const addCopyExpression = (kind, node, seen = new Set()) => {
    if (seen.has(node)) return;
    const nextSeen = new Set(seen);
    nextSeen.add(node);
    const value = directLiteral(node);
    if (value !== null) {
      add(kind, node, value);
      return;
    }
    if (
      ts.isParenthesizedExpression(node)
      || ts.isAsExpression(node)
      || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node)
      || ts.isSatisfiesExpression(node)
    ) {
      addCopyExpression(kind, node.expression, nextSeen);
      return;
    }
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && ["uiCopy", "uiFormat", "uiSource", "verbatimUserText", "structuralValue"]
        .includes(node.expression.text)
    ) {
      return;
    }
    if (ts.isCallExpression(node)) {
      const helperName = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : null;
      if (helperName) {
        for (const index of returnedArguments.get(helperName) ?? []) {
          const argument = node.arguments[index];
          if (argument) addCopyExpression(kind, argument, nextSeen);
        }
      }
      return;
    }
    if (ts.isIdentifier(node) || ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) {
      const values = deferredValues(node, seen);
      for (const resolved of values) {
        if (resolved !== node) addCopyExpression(kind, resolved, nextSeen);
      }
      return;
    }
    if (ts.isConditionalExpression(node)) {
      addCopyExpression(kind, node.whenTrue, nextSeen);
      addCopyExpression(kind, node.whenFalse, nextSeen);
      return;
    }
    if (
      ts.isBinaryExpression(node)
      && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken]
        .includes(node.operatorToken.kind)
    ) {
      addCopyExpression(kind, node.left, nextSeen);
      addCopyExpression(kind, node.right, nextSeen);
      return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) addCopyExpression(kind, element, nextSeen);
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) addCopyExpression(kind, property.initializer, nextSeen);
        if (ts.isShorthandPropertyAssignment(property)) addCopyExpression(kind, property.name, nextSeen);
      }
    }
  };

  const catalogFragments = node => {
    if (
      ts.isParenthesizedExpression(node)
      || ts.isAsExpression(node)
      || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node)
      || ts.isSatisfiesExpression(node)
    ) {
      return catalogFragments(node.expression);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return [...catalogFragments(node.left), ...catalogFragments(node.right)];
    }
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && ["uiCopy", "uiFormat"].includes(node.expression.text)
      && node.arguments[0]
    ) {
      const value = directLiteral(node.arguments[0]);
      return value === null ? [] : [value];
    }
    return [];
  };

  const visit = node => {
    let declaredName = null;
    let declaredParameters = null;
    if (ts.isFunctionDeclaration(node) && node.name) {
      declaredName = node.name.text;
      declaredParameters = node.parameters;
    } else if (
      ts.isMethodDeclaration(node)
      && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))
    ) {
      declaredName = node.name.text;
      declaredParameters = node.parameters;
    } else if (
      (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
      && ts.isVariableDeclaration(node.parent)
      && ts.isIdentifier(node.parent.name)
    ) {
      declaredName = node.parent.name.text;
      declaredParameters = node.parameters;
    }
    if (declaredName && declaredParameters) {
      for (const index of helperArguments.get(declaredName) ?? []) {
        const initializer = declaredParameters[index]?.initializer;
        if (initializer) addCopyExpression(`${declaredName}-default`, initializer);
      }
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && (
        DOM_COPY_PROPERTIES.has(node.left.name.text)
        || VISIBLE_STATE_PROPERTIES.has(node.left.name.text)
      )
    ) {
      addCopyExpression(node.left.name.text, node.right);
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.PlusToken
      && !(
        ts.isBinaryExpression(node.parent)
        && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken
      )
    ) {
      const fragments = catalogFragments(node);
      if (fragments.length > 1) add("fragmented-ui-copy", node, fragments.join(" "));
    }

    if (
      ts.isNewExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text.endsWith("Error")
      && node.arguments?.[0]
    ) {
      addCopyExpression("Error", node.arguments[0]);
    }

    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === "uiFormat"
      && ts.isArrayLiteralExpression(node.arguments[1])
    ) {
      for (const value of node.arguments[1].elements) addCopyExpression("uiFormat-value", value);
    }

    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && DOM_COPY_METHODS.has(node.expression.name.text)
    ) {
      for (const argument of node.arguments) addCopyExpression(node.expression.name.text, argument);
    }

    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "createTextNode"
      && node.arguments[0]
    ) {
      addCopyExpression("createTextNode", node.arguments[0]);
    }

    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "setAttribute"
    ) {
      const attribute = node.arguments[0] ? directLiteral(node.arguments[0]) : null;
      if (attribute && node.arguments[1] && LOCALE_SENSITIVE_ATTRIBUTES.has(attribute)) {
        addCopyExpression(attribute, node.arguments[1]);
      }
    }

    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "insertAdjacentHTML"
    ) {
      if (node.arguments[1]) addCopyExpression("insertAdjacentHTML", node.arguments[1]);
    }

    if (ts.isCallExpression(node) && node.arguments[0]) {
      const dialogMethod = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : null;
      if (dialogMethod && ["prompt", "confirm", "alert"].includes(dialogMethod)) {
        addCopyExpression(dialogMethod, node.arguments[0]);
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const indexes = helperArguments.get(node.expression.text) ?? [];
      for (const index of indexes) {
        const argument = node.arguments[index];
        if (argument) addCopyExpression(node.expression.text, argument);
      }
    }

    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && (
        node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
        || COPY_HELPER_ARGUMENTS.has(node.expression.name.text)
      )
    ) {
      const method = node.expression.name.text;
      const indexes = helperArguments.get(method) ?? [];
      for (const index of indexes) {
        const argument = node.arguments[index];
        if (argument) addCopyExpression(method, argument);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

export const UI_SOURCE_TARGETS = [
    "apps/web/src/bridge/v197Accessibility.ts",
    "apps/web/src/bridge/v197Adjuncts.ts",
    "apps/web/src/bridge/v197Agentic.ts",
    "apps/web/src/bridge/v197ApiClient.ts",
    "apps/web/src/bridge/v197Bindings.ts",
    "apps/web/src/bridge/v197Brand.ts",
    "apps/web/src/bridge/v197Bridge.ts",
    "apps/web/src/bridge/v197CapabilityReducer.ts",
    "apps/web/src/bridge/v197CelestialRuntime.ts",
    "apps/web/src/bridge/v197Diagnose.ts",
    "apps/web/src/bridge/v197Events.ts",
    "apps/web/src/bridge/v197Fonts.ts",
    "apps/web/src/bridge/v197Hydration.ts",
    "apps/web/src/bridge/v197I18n.ts",
    "apps/web/src/bridge/v197Insights.ts",
    "apps/web/src/bridge/v197LogoutReturn.ts",
    "apps/web/src/bridge/v197Map.ts",
    "apps/web/src/bridge/v197Mutations.ts",
    "apps/web/src/bridge/v197Orbit.ts",
    "apps/web/src/bridge/v197PerformanceProfile.ts",
    "apps/web/src/bridge/v197Polish.ts",
    "apps/web/src/bridge/v197Rewards.ts",
    "apps/web/src/bridge/v197SearchInput.ts",
    "apps/web/src/bridge/v197Selectors.ts",
    "apps/web/src/bridge/v197StarBrain.ts",
    "apps/web/src/bridge/v197StarSeal.ts",
    "apps/web/src/bridge/v197StreamClient.ts",
    "apps/web/src/bridge/v197SurfaceHost.ts",
    "apps/web/src/bridge/v197Timeline.ts",
];

export function checkI18nExtraction(root) {
  return UI_SOURCE_TARGETS.flatMap(relativePath => {
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
    process.stderr.write(`I18N_EXTRACTION=FAIL scanned=${UI_SOURCE_TARGETS.length} violations=${violations.length}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`I18N_EXTRACTION=PASS scanned=${UI_SOURCE_TARGETS.length} violations=0\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
