import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const readiness = readFileSync(resolve(root, ".github/workflows/readiness.yml"), "utf8");

test("exposes deterministic strict-localization gates from the repository root", () => {
  assert.match(packageJson.scripts["web:i18n-source"], /build-i18n-source-catalog\.mjs --check/);
  assert.match(packageJson.scripts["web:i18n-catalogs"], /check-i18n-catalogs\.mjs/);
  assert.match(packageJson.scripts["web:i18n-catalogs"], /build-i18n-catalog-module\.mjs --check/);
  assert.match(packageJson.scripts["web:i18n-matrix"], /v197-localization-matrix\.spec\.ts/);
  assert.match(packageJson.scripts["web:i18n-matrix"], /--project=chromium-desktop/);
  assert.match(packageJson.scripts["web:i18n-matrix"], /--project=chromium-mobile/);
  assert.match(packageJson.scripts["web:i18n-matrix"], /--workers=1/);
});

test("runs every strict-localization gate in NUR Readiness", () => {
  const source = readiness.indexOf("npm run web:i18n-source");
  const catalogs = readiness.indexOf("npm run web:i18n-catalogs");
  const extraction = readiness.indexOf("npm run web:i18n-extraction");
  const build = readiness.indexOf("npm run web:build");
  const matrix = readiness.indexOf("npm run web:i18n-matrix");

  assert.ok(source >= 0, "source-schema check is missing");
  assert.ok(catalogs > source, "catalog gate must run after the source-schema check");
  assert.ok(extraction > catalogs, "whole-UI extraction must run after catalog validation");
  assert.ok(build > extraction, "web build must run after all static localization gates");
  assert.ok(matrix > build, "browser locale matrix must run against a built application");
});
