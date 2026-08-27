import { describe, expect, it } from "vitest";
import {
  CATALOG_IDS,
  getCatalog,
  LOCALE_QUALITY,
  LOCALE_VARIANTS,
  SUPPORTED_LOCALES,
  UI_COPY_KEYS,
} from "../i18n";
import {
  CORE_COPY,
  CRITICAL_COPY,
  LANGUAGE_CONTROL_COPY,
  LOCALE_META,
  POLISHED_BETA_LOCALES,
  V197_NAV_COPY,
  criticalCopyFor,
  dirForLocale,
  resolveLocale,
  writingPreferenceForLocale,
} from "./i18n";

function collectLeaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [String(value(2))];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectLeaves);
}

function expectCompleteCatalog(locale: string, variant: "default" | "roman" | "script") {
  const catalog = getCatalog(locale, variant);
  expect(Object.keys(catalog).sort()).toEqual([...UI_COPY_KEYS].sort());
  expect(Object.values(catalog).every(value => typeof value === "string" && value.trim().length > 0)).toBe(true);
  return catalog;
}

describe("canonical 35-locale i18n authority", () => {
  it("declares exactly the required 35 locales and all bundled variants", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(35);
    expect(new Set(SUPPORTED_LOCALES).size).toBe(35);
    expect(CATALOG_IDS).toHaveLength(37);
    expect(LOCALE_META).toHaveLength(35);
    for (const locale of SUPPORTED_LOCALES) {
      const variants = LOCALE_VARIANTS[locale] as readonly ("default" | "roman" | "script")[];
      for (const variant of variants) expectCompleteCatalog(locale, variant);
    }
  });

  it("never falls back to English for a supported locale", () => {
    const english = getCatalog("en", "default");
    for (const locale of SUPPORTED_LOCALES) {
      const variants = LOCALE_VARIANTS[locale] as readonly ("default" | "roman" | "script")[];
      for (const variant of variants) {
        const catalog = getCatalog(locale, variant);
        if (locale !== "en") {
          expect(catalog).not.toBe(english);
          expect(Object.keys(catalog).some(key => catalog[key as keyof typeof catalog] !== english[key as keyof typeof english])).toBe(true);
        }
      }
    }
  });

  it("rejects impossible writing variants and preserves script direction truthfully", () => {
    expect(() => getCatalog("ar", "roman")).toThrow(/not supported/);
    expect(() => getCatalog("en", "script")).toThrow(/not supported/);
    expect(dirForLocale("ar")).toBe("rtl");
    expect(dirForLocale("fa")).toBe("rtl");
    expect(dirForLocale("ur")).toBe("rtl");
    expect(dirForLocale("en")).toBe("ltr");
    expect(writingPreferenceForLocale("ur-PK")).toBe("roman");
    expect(writingPreferenceForLocale("ar")).toBe("script");
    expect(getCatalog("ur", "roman")).not.toBe(getCatalog("ur", "script"));
    expect(resolveLocale("zh-CN")).toBe("zh-Hans");
    expect(resolveLocale("pt-BR")).toBe("pt");
    expect(resolveLocale("not-a-locale")).toBe("en");
  });

  it("keeps compatibility copy complete while exposing technical quality separately from human review", () => {
    expect(POLISHED_BETA_LOCALES).toEqual(["en"]);
    expect(LOCALE_QUALITY.en).toBe("TECHNICALLY_COMPLETE");
    for (const locale of SUPPORTED_LOCALES.filter(item => item !== "en")) expect(LOCALE_QUALITY[locale]).toBe("MACHINE_DRAFT");
    expect(LOCALE_META.every(row => row.quality === LOCALE_QUALITY[row.locale])).toBe(true);
    for (const locale of SUPPORTED_LOCALES) {
      expect(CORE_COPY[locale].askPlaceholder).toBeTruthy();
      expect(CORE_COPY[locale].privateBoundary).toBeTruthy();
      expect(collectLeaves(CRITICAL_COPY[locale]).every(text => text.trim().length > 0)).toBe(true);
      expect(collectLeaves(V197_NAV_COPY[locale]).every(text => text.trim().length > 0)).toBe(true);
      expect(collectLeaves(LANGUAGE_CONTROL_COPY[locale]).every(text => text.trim().length > 0)).toBe(true);
    }
    expect(criticalCopyFor("not-a-locale")).toEqual(CRITICAL_COPY.en);
  });
});
