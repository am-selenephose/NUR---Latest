import { describe, expect, it } from "vitest";
import {
  CORE_COPY,
  CRITICAL_COPY,
  LANGUAGE_CONTROL_COPY,
  LOCALE_META,
  POLISHED_BETA_LOCALES,
  SUPPORTED_LOCALES,
  UI_CATALOGS,
  UI_VARIANTS,
  V197_NAV_COPY,
  catalogFor,
  applyCanonicalV197Copy,
  criticalCopyFor,
  dirForLocale,
  resolveLocale,
  resolveWritingVariant,
  writingPreferenceForLocale,
} from "./i18n";

function collectLeaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [String(value(2))];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectLeaves);
}

describe("i18n readiness", () => {
  it("keeps critical UI copy for every declared locale", () => {
    expect(SUPPORTED_LOCALES).toEqual([
      "en", "ur", "hi", "bn", "pa", "ar", "fa", "tr", "id", "ms",
      "zh-Hans", "zh-Hant", "ja", "ko", "vi", "th", "fil", "ta", "te",
      "mr", "gu", "kn", "ml", "ru", "uk", "pl", "de", "fr", "es", "pt",
      "it", "nl", "sv", "ro", "sw",
    ]);
    for (const locale of SUPPORTED_LOCALES) {
      expect(CORE_COPY[locale].askPlaceholder.length).toBeGreaterThan(0);
      expect(CORE_COPY[locale].privateBoundary.length).toBeGreaterThan(0);
      expect(collectLeaves(CRITICAL_COPY[locale]).every(text => text.trim().length > 0)).toBe(true);
      expect(CRITICAL_COPY[locale].talk.title).toBeTruthy();
      expect(CRITICAL_COPY[locale].systems.mapSubtitle).toBeTruthy();
      expect(CRITICAL_COPY[locale].capsule.shareTitle).toBeTruthy();
      expect(CRITICAL_COPY[locale].capsule.createContextCapsule).toBeTruthy();
      expect(collectLeaves(V197_NAV_COPY[locale]).every(text => text.trim().length > 0)).toBe(true);
      expect(collectLeaves(LANGUAGE_CONTROL_COPY[locale]).every(text => text.trim().length > 0)).toBe(true);
    }
  });

  it("resolves locale aliases, RTL scripts, and Roman Urdu preference honestly", () => {
    expect(resolveLocale("zh-CN")).toBe("zh-Hans");
    expect(resolveLocale("ZH_tw")).toBe("zh-Hant");
    expect(resolveLocale("zh-HK")).toBe("zh-Hant");
    expect(resolveLocale("PT_br")).toBe("pt");
    expect(resolveLocale("UR_pk")).toBe("ur");
    expect(resolveLocale("pt-BR")).toBe("pt");
    expect(dirForLocale("ar")).toBe("rtl");
    expect(dirForLocale("fa")).toBe("rtl");
    expect(dirForLocale("ur")).toBe("ltr");
    expect(dirForLocale("en")).toBe("ltr");
    expect(writingPreferenceForLocale("ur-PK")).toBe("roman");
    expect(writingPreferenceForLocale("ar")).toBe("script");
    expect(criticalCopyFor("ur-PK").talk.kicker).toBe(UI_CATALOGS["ur-roman"]["Ask NUR"]);
    expect(criticalCopyFor("not-a-locale")).toEqual(CRITICAL_COPY.en);
  });

  it("labels polished beta locales separately from draft locales", () => {
    expect(POLISHED_BETA_LOCALES).toEqual(["en"]);
    const polished = LOCALE_META.filter(row => row.status === "polished_beta").map(row => row.locale);
    expect(polished).toEqual(Array.from(POLISHED_BETA_LOCALES));
    expect(LOCALE_META.find(row => row.locale === "bn")?.status).toBe("draft_unreviewed");
  });

  it("presents all language choices in their native names", () => {
    expect(Object.fromEntries(LOCALE_META.map(row => [row.locale, row.label]))).toEqual({
      en: "English",
      ur: "اردو",
      hi: "हिन्दी",
      bn: "বাংলা",
      pa: "ਪੰਜਾਬੀ",
      ar: "العربية",
      fa: "فارسی",
      tr: "Türkçe",
      id: "Bahasa Indonesia",
      ms: "Bahasa Melayu",
      "zh-Hans": "简体中文",
      "zh-Hant": "繁體中文",
      ja: "日本語",
      ko: "한국어",
      vi: "Tiếng Việt",
      th: "ไทย",
      fil: "Filipino",
      ta: "தமிழ்",
      te: "తెలుగు",
      mr: "मराठी",
      gu: "ગુજરાતી",
      kn: "ಕನ್ನಡ",
      ml: "മലയാളം",
      ru: "Русский",
      uk: "Українська",
      pl: "Polski",
      de: "Deutsch",
      fr: "Français",
      es: "Español",
      pt: "Português",
      it: "Italiano",
      nl: "Nederlands",
      sv: "Svenska",
      ro: "Română",
      sw: "Kiswahili",
    });
  });

  it("has exact catalog parity without a supported-locale English fallback", () => {
    const englishKeys = Object.keys(UI_CATALOGS.en).sort();
    expect(englishKeys.length).toBeGreaterThan(300);
    expect(Object.keys(UI_CATALOGS)).toHaveLength(37);
    for (const variants of Object.values(UI_VARIANTS)) {
      for (const variant of variants) {
        const catalog = UI_CATALOGS[variant.catalog];
        expect(Object.keys(catalog).sort()).toEqual(englishKeys);
        if (variant.catalog !== "en") expect(catalog).not.toBe(UI_CATALOGS.en);
      }
    }
  });

  it("models only supported writing variants and resolves them strictly", () => {
    expect(UI_VARIANTS.ur.map(row => row.preference)).toEqual(["roman", "script"]);
    expect(UI_VARIANTS.hi.map(row => row.preference)).toEqual(["roman", "script"]);
    expect(UI_VARIANTS.ar.map(row => row.preference)).toEqual(["script"]);
    expect(UI_VARIANTS.fa.map(row => row.preference)).toEqual(["script"]);
    expect(UI_VARIANTS.fr.map(row => row.preference)).toEqual(["default"]);
    expect(resolveWritingVariant("ur-PK", "script").catalog).toBe("ur-script");
    expect(resolveWritingVariant("hi", "roman").catalog).toBe("hi-roman");
    expect(() => resolveWritingVariant("fr", "roman")).toThrow(/Unsupported writing preference/);
    expect(catalogFor("ur", "script")).toBe(UI_CATALOGS["ur-script"]);
  });

  it("keeps only the explicit NUR brand token invariant", () => {
    expect(UI_CATALOGS.en.NUR).toBe("NUR");
    for (const [catalogId, catalog] of Object.entries(UI_CATALOGS) as [string, { NUR: string }][]) {
      expect(catalog.NUR, catalogId).toBe("NUR");
    }
  });

  it("never translates owner-authored content in canonical V197 slots", () => {
    const document = window.document.implementation.createHTMLDocument("NUR");
    document.body.innerHTML = `
      <section id="page-systems"></section>
      <div id="talk-stream"><div data-nur-user-content="true">The front page. This exact owner sentence stays.</div></div>
    `;

    applyCanonicalV197Copy(document, "ko", "default");

    expect(document.querySelector("#talk-stream > div")?.textContent).toBe(
      "The front page. This exact owner sentence stays.",
    );
  });
});
