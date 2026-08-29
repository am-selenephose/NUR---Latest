import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), "utf8");
const themeCopy = {
  "ui.1789": "Appearance",
  "ui.1790": "Original",
  "ui.1791": "Yellow",
  "ui.1792": "Green",
  "ui.1793": "Blue",
  "ui.1794": "Violet",
  "ui.1795": "Red",
  "ui.1796": "Orange",
  "ui.1797": "Indigo",
} as const;

describe("V197 theme settings", () => {
  it("exposes one accessible Settings control backed by the authoritative controller", () => {
    const source = read("apps/web/src/bridge/v197Adjuncts.ts");
    expect(source).toContain('themeSelect.dataset.adjunctControl = "theme-accent"');
    expect(source).toContain("theme.setAccent(accent)");
    expect(source).toContain("themeLabel.append(themeSelect)");
    expect(source).not.toContain("localStorage.setItem");
  });

  it("catalogues every new visible label in all 35 locales and 37 variants", () => {
    const manifest = JSON.parse(read("apps/web/src/i18n/source-manifest.json")) as Array<{
      id: string;
      source: string;
    }>;
    const manifestCopy = Object.fromEntries(
      manifest.filter(row => row.id in themeCopy).map(row => [row.id, row.source]),
    );
    expect(manifestCopy).toEqual(themeCopy);

    const catalogDirectory = resolve(repositoryRoot, "apps/web/src/i18n/catalogs");
    const files = readdirSync(catalogDirectory).filter(file => file.endsWith(".json"));
    expect(files).toHaveLength(37);
    for (const file of files) {
      const catalog = JSON.parse(readFileSync(resolve(catalogDirectory, file), "utf8")) as Record<string, string>;
      for (const key of Object.keys(themeCopy)) expect(catalog[key]?.trim(), `${file}:${key}`).toBeTruthy();
    }

    const urScript = JSON.parse(read("apps/web/src/i18n/catalogs/ur-script.json")) as Record<string, string>;
    const ar = JSON.parse(read("apps/web/src/i18n/catalogs/ar.json")) as Record<string, string>;
    const fa = JSON.parse(read("apps/web/src/i18n/catalogs/fa.json")) as Record<string, string>;
    for (const catalog of [urScript, ar, fa]) {
      expect(catalog["ui.1789"]).toMatch(/[\u0600-\u06ff]/u);
    }
  });
});
