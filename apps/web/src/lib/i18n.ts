import canonicalSlots from "./i18n/v197-canonical-slots.json";
import {
  UI_CATALOGS,
  type UiCatalog,
  type UiCatalogId,
  type UiCopyKey,
} from "./i18n/catalogs.generated";

export { UI_CATALOGS };
export type { UiCatalog, UiCatalogId, UiCopyKey };

export const SUPPORTED_LOCALES = [
  "en", "ur", "hi", "bn", "pa", "ar", "fa", "tr", "id", "ms",
  "zh-Hans", "zh-Hant", "ja", "ko", "vi", "th", "fil", "ta", "te",
  "mr", "gu", "kn", "ml", "ru", "uk", "pl", "de", "fr", "es", "pt",
  "it", "nl", "sv", "ro", "sw",
] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
export type WritingPreference = "default" | "roman" | "script";

export type UiWritingVariant = {
  preference: WritingPreference;
  catalog: UiCatalogId;
  script: string;
  dir: "ltr" | "rtl";
};

export const POLISHED_BETA_LOCALES = ["en"] as const;
const POLISHED = new Set<string>(POLISHED_BETA_LOCALES);

export type LocaleMeta = {
  locale: SupportedLocale;
  label: string;
  status: "polished_beta" | "draft_unreviewed";
  dir: "ltr" | "rtl";
};

// Language selectors use stable autonyms so every option remains recognizable
// before and after the active interface catalog changes.
const LOCALE_AUTONYMS: Record<SupportedLocale, string> = {
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
};

const variant = (
  preference: WritingPreference,
  catalog: UiCatalogId,
  script: string,
  dir: "ltr" | "rtl" = "ltr",
): UiWritingVariant => ({ preference, catalog, script, dir });

export const UI_VARIANTS: Record<SupportedLocale, readonly UiWritingVariant[]> = {
  en: [variant("default", "en", "Latn")],
  ur: [variant("roman", "ur-roman", "Latn"), variant("script", "ur-script", "Arab", "rtl")],
  hi: [variant("roman", "hi-roman", "Latn"), variant("script", "hi-script", "Deva")],
  bn: [variant("script", "bn", "Beng")],
  pa: [variant("script", "pa", "Guru")],
  ar: [variant("script", "ar", "Arab", "rtl")],
  fa: [variant("script", "fa", "Arab", "rtl")],
  tr: [variant("default", "tr", "Latn")],
  id: [variant("default", "id", "Latn")],
  ms: [variant("default", "ms", "Latn")],
  "zh-Hans": [variant("script", "zh-Hans", "Hans")],
  "zh-Hant": [variant("script", "zh-Hant", "Hant")],
  ja: [variant("script", "ja", "Jpan")],
  ko: [variant("script", "ko", "Kore")],
  vi: [variant("default", "vi", "Latn")],
  th: [variant("script", "th", "Thai")],
  fil: [variant("default", "fil", "Latn")],
  ta: [variant("script", "ta", "Taml")],
  te: [variant("script", "te", "Telu")],
  mr: [variant("script", "mr", "Deva")],
  gu: [variant("script", "gu", "Gujr")],
  kn: [variant("script", "kn", "Knda")],
  ml: [variant("script", "ml", "Mlym")],
  ru: [variant("script", "ru", "Cyrl")],
  uk: [variant("script", "uk", "Cyrl")],
  pl: [variant("default", "pl", "Latn")],
  de: [variant("default", "de", "Latn")],
  fr: [variant("default", "fr", "Latn")],
  es: [variant("default", "es", "Latn")],
  pt: [variant("default", "pt", "Latn")],
  it: [variant("default", "it", "Latn")],
  nl: [variant("default", "nl", "Latn")],
  sv: [variant("default", "sv", "Latn")],
  ro: [variant("default", "ro", "Latn")],
  sw: [variant("default", "sw", "Latn")],
};

export function resolveLocale(raw: string | null | undefined): SupportedLocale {
  const value = (raw || "en").trim().replaceAll("_", "-");
  const lower = value.toLowerCase();
  const exact = SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === lower);
  if (exact) return exact;
  if (["zh-hant", "zh-tw", "zh-hk"].includes(lower)) return "zh-Hant";
  if (lower === "zh" || lower.startsWith("zh-")) return "zh-Hans";
  const base = lower.split("-")[0];
  const supportedBase = SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === base);
  if (supportedBase) return supportedBase;
  return "en";
}

export function dirForLocale(locale: string): "ltr" | "rtl" {
  return UI_VARIANTS[resolveLocale(locale)][0].dir;
}

export function writingPreferenceForLocale(locale: string): "roman" | "script" | "default" {
  return UI_VARIANTS[resolveLocale(locale)][0].preference;
}

export function resolveWritingVariant(
  rawLocale: string | null | undefined,
  preference: WritingPreference | string | null | undefined = "default",
): UiWritingVariant {
  const locale = resolveLocale(rawLocale);
  const variants = UI_VARIANTS[locale];
  const requested = preference?.trim().toLowerCase() || "default";
  if (requested === "default") return variants[0];
  const matched = variants.find(row => row.preference === requested);
  if (!matched) throw new Error(`Unsupported writing preference ${JSON.stringify(preference)} for ${locale}.`);
  return matched;
}

export function catalogFor(
  rawLocale: string | null | undefined,
  preference: WritingPreference | string | null | undefined = "default",
): UiCatalog {
  const { catalog } = resolveWritingVariant(rawLocale, preference);
  return UI_CATALOGS[catalog] as UiCatalog;
}

export function coreCopyFor(
  rawLocale: string | null | undefined,
  preference: WritingPreference | string | null | undefined = "default",
): { privateBoundary: string; askPlaceholder: string } {
  return translateTree(CORE_COPY.en, catalogFor(rawLocale, preference));
}

const LOCALE_META_ORDER = [
  ...POLISHED_BETA_LOCALES,
  ...SUPPORTED_LOCALES.filter(locale => !POLISHED.has(locale)),
] as SupportedLocale[];

export const LOCALE_META: LocaleMeta[] = LOCALE_META_ORDER.map(locale => ({
  locale,
  label: LOCALE_AUTONYMS[locale],
  status: POLISHED.has(locale) ? "polished_beta" : "draft_unreviewed",
  dir: dirForLocale(locale),
}));

export const CORE_COPY: Record<string, { privateBoundary: string; askPlaceholder: string }> = {
  en: { privateBoundary: "Private Orbit", askPlaceholder: "Say it plainly..." },
};

export type NavigationCopy = {
  today: string;
  talk: string;
  journal: string;
  plan: string;
  systems: string;
  universe: string;
  map: string;
  orbits: string;
  timeline: string;
  insights: string;
  research: string;
  community: string;
  send: string;
};

const enNavigation: NavigationCopy = {
  today: "Today",
  talk: "Talk",
  journal: "Journal",
  plan: "Plan",
  systems: "Systems",
  universe: "Universe",
  map: "Map",
  orbits: "Orbits",
  timeline: "Timeline",
  insights: "Insights",
  research: "Research",
  community: "Community",
  send: "Send",
};

export type LanguageControlCopy = {
  chooseLanguage: string;
  languageAndWriting: string;
  settingsNote: string;
  providerStatus: string;
  providerConfigured: string;
  providerDisabled: string;
  providerConfiguredNote: string;
  providerDisabledNote: string;
  language: string;
  languageAria: string;
  reviewed: string;
  draft: string;
  writingPreference: string;
  writingPreferenceAria: string;
  writingRoman: string;
  writingScript: string;
  writingDefault: string;
  saveLanguage: string;
  savingPrivately: string;
  saved: (label: string) => string;
  saveError: string;
};

const enLanguageControls: LanguageControlCopy = {
  chooseLanguage: "Choose NUR language",
  languageAndWriting: "Language and writing",
  settingsNote: "Saved privately. NUR uses this language for interface copy and Talk.",
  providerStatus: "AI provider status",
  providerConfigured: "OPENAI_CONFIGURED · server-side only",
  providerDisabled: "DISABLED · AI not connected",
  providerConfiguredNote: "Talk calls OpenAI through the NUR backend. No key is sent to this browser.",
  providerDisabledNote: "Run the local OpenAI setup, then start NUR in openai mode.",
  language: "Language",
  languageAria: "NUR language",
  reviewed: "beta reviewed",
  draft: "draft",
  writingPreference: "Writing preference",
  writingPreferenceAria: "NUR writing preference",
  writingRoman: "Roman / transliterated",
  writingScript: "Native script",
  writingDefault: "Locale default",
  saveLanguage: "Save language",
  savingPrivately: "Saving privately...",
  saved: label => `Saved: ${label}.`,
  saveError: "Language could not be saved.",
};

export const V197_NAV_COPY: Record<string, NavigationCopy> = {};
export const LANGUAGE_CONTROL_COPY: Record<string, LanguageControlCopy> = {};

export function navigationCopyFor(
  rawLocale: string | null | undefined,
  preference: WritingPreference = "default",
): NavigationCopy {
  return translateTree(enNavigation, catalogFor(rawLocale, preference));
}

export function languageControlCopyFor(
  rawLocale: string | null | undefined,
  preference: WritingPreference = "default",
): LanguageControlCopy {
  return languageControlsFromCatalog(catalogFor(rawLocale, preference));
}

export type CriticalCopy = {
  talk: {
    kicker: string;
    title: string;
    titleEmphasis: string;
    subtitle: string;
    seed: string;
    send: string;
    holding: string;
    modeTalk: string;
    thinkDeeper: string;
    challenge: string;
    summarize: string;
    observed: string;
    inferred: string;
    hypotheses: string;
    uncertainty: string;
    nextMove: string;
    useMoveInPlan: string;
    currentThread: string;
    currentThreadSub: string;
    keepPrivate: string;
    saveToJournal: string;
    makePlan: string;
    recordWhatChanged: string;
    outcomePlaceholder: string;
    outcomeSave: string;
    outcomeSaving: string;
    onlyThisOrbit: string;
    changeBoundary: string;
    whatNurHolding: string;
    holdingPopulated: (count: number) => string;
    holdingEmpty: string;
    correctModel: string;
    correctionSub: string;
    correctionPlaceholder: string;
    saveCorrection: string;
    intentionalMixedRomanUrdu: string | null;
  };
  systems: {
    kicker: string;
    title: string;
    titleEmphasis: string;
    subtitle: string;
    activeSystems: string;
    outcomesReturned: string;
    insightsEvolving: string;
    mapLabel: string;
    mapSubtitle: string;
    addSystem: string;
    addSystemHint: string;
    systemField: string;
    ownerLedger: string;
    shareOrbit: string;
    researchField: string;
  };
  capsule: {
    kicker: string;
    activeLine: string;
    revokedLine: string;
    expiredLine: string;
    purpose: string;
    access: string;
    expires: string;
    noExpiry: string;
    included: string;
    includedSub: string;
    excluded: string;
    askTitle: string;
    askSub: string;
    askPlaceholder: string;
    ask: string;
    inactiveNote: string;
    shareTitle: string;
    shareSub: string;
    purposeLabel: string;
    purposePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    capabilityLabel: string;
    readOnly: string;
    askScoped: string;
    expiryLabel: string;
    noExpiryShort: string;
    in7Days: string;
    in30Days: string;
    includedSources: string;
    emptySources: string;
    excludedNote: (count: number) => string;
    captureIntoOrbit: string;
    decisionPlaceholder: string;
    referencePlaceholder: string;
    keepDecision: string;
    keepReference: string;
    createContextCapsule: string;
    capsuleLive: string;
    roomAddress: string;
    roomSignIn: string;
    existingCapsules: string;
    revoked: string;
    activeNoExpiry: string;
    audit: string;
    revoke: string;
    accessAudit: string;
    createNeeds: string;
    createdToast: string;
    createError: string;
    revokedToast: string;
  };
};

const enCritical: CriticalCopy = {
  talk: {
    kicker: "Ask NUR",
    title: "Talk in a room",
    titleEmphasis: "that stays yours.",
    subtitle: "NUR does not carry this anywhere unless you choose it.",
    seed: "Start where the pressure is, not where the plan is.",
    send: "Send",
    holding: "Holding",
    modeTalk: "talk",
    thinkDeeper: "Think deeper",
    challenge: "challenge",
    summarize: "summarize",
    observed: "Observed",
    inferred: "Inferred",
    hypotheses: "Hypotheses",
    uncertainty: "Uncertainty",
    nextMove: "Next move",
    useMoveInPlan: "Use this move in Plan",
    currentThread: "Current thread",
    currentThreadSub: "Design continuity without burying the voice underneath it.",
    keepPrivate: "Keep private",
    saveToJournal: "Save to Journal",
    makePlan: "Make a Plan",
    recordWhatChanged: "Record what changed",
    outcomePlaceholder: "What changed in the real world?",
    outcomeSave: "Return outcome",
    outcomeSaving: "Returning",
    onlyThisOrbit: "only this Orbit",
    changeBoundary: "change boundary",
    whatNurHolding: "What NUR is holding",
    holdingPopulated: count => count === 1
      ? `${count} persisted Talk turn is available in this private ledger.`
      : `${count} persisted Talk turns are available in this private ledger.`,
    holdingEmpty: "No persisted Talk turns yet. Say one true line to begin.",
    correctModel: "Correct the model",
    correctionSub: "Corrections are saved as owner-scoped evidence, not hidden prompt magic.",
    correctionPlaceholder: "What should NUR stop assuming?",
    saveCorrection: "Save correction",
    intentionalMixedRomanUrdu: null,
  },
  systems: {
    kicker: "Systems universe",
    title: "A living universe for",
    titleEmphasis: "what you are becoming.",
    subtitle: "A private Orbit when you need it. Shared systems when you choose them.",
    activeSystems: "active systems",
    outcomesReturned: "outcomes returned",
    insightsEvolving: "insights evolving",
    mapLabel: "NUR systems constellation map",
    mapSubtitle: "Neural Upgrade Rewiring",
    addSystem: "Add system",
    addSystemHint: "When a life problem needs its own sky.",
    systemField: "System field",
    ownerLedger: "owner ledger",
    shareOrbit: "Share this Orbit",
    researchField: "Research field",
  },
  capsule: {
    kicker: "Approved Context Capsule",
    activeLine: "held open, deliberately.",
    revokedLine: "has been revoked.",
    expiredLine: "has expired.",
    purpose: "Purpose",
    access: "Access",
    expires: "Expires",
    noExpiry: "No expiry — revocable at any time",
    included: "What is included",
    includedSub: "Only these approved sources exist inside this room.",
    excluded: "What is excluded",
    askTitle: "Ask about this context",
    askSub: "Answers draw only on the included sources — nothing else can be reached.",
    askPlaceholder: "Ask within the approved boundary…",
    ask: "Ask",
    inactiveNote: "The owner's boundary now closes this room. Nothing here is cached, and no answers remain readable.",
    shareTitle: "Share this Orbit, deliberately.",
    shareSub: "A Context Capsule carries only what you approve — never your life, never your voice.",
    purposeLabel: "purpose",
    purposePlaceholder: "e.g. Get a designer useful in 20 minutes",
    emailLabel: "who can access",
    emailPlaceholder: "their email — named, never public",
    capabilityLabel: "what they can do",
    readOnly: "Read only",
    askScoped: "Ask scoped questions",
    expiryLabel: "expires",
    noExpiryShort: "No expiry (revocable)",
    in7Days: "In 7 days",
    in30Days: "In 30 days",
    includedSources: "Included sources",
    emptySources: "Nothing shareable yet — capture a decision or reference below.",
    excludedNote: count => count === 1
      ? `${count} source stays excluded — the recipient sees the boundary, never the content.`
      : `${count} sources stay excluded — the recipient sees the boundary, never the content.`,
    captureIntoOrbit: "Capture into this Orbit",
    decisionPlaceholder: "a decision already made…",
    referencePlaceholder: "a reference or constraint…",
    keepDecision: "keep decision",
    keepReference: "keep reference",
    createContextCapsule: "Create Context Capsule",
    capsuleLive: "Capsule live",
    roomAddress: "Room address",
    roomSignIn: "They sign in with their own Orbit; the room opens only for them.",
    existingCapsules: "Existing capsules",
    revoked: "revoked",
    activeNoExpiry: "active · no expiry",
    audit: "audit",
    revoke: "revoke",
    accessAudit: "Access audit",
    createNeeds: "A capsule needs a purpose, a named recipient, and at least one source.",
    createdToast: "Capsule created. The boundary is visible and revocable.",
    createError: "The capsule could not be created.",
    revokedToast: "Revoked. The room closed immediately.",
  },
};

export const CRITICAL_COPY: Record<string, CriticalCopy> = { en: enCritical };

export function criticalCopyFor(
  rawLocale: string | null | undefined,
  preference: WritingPreference = "default",
): CriticalCopy {
  return criticalFromCatalog(catalogFor(rawLocale, preference));
}

function catalogLookup(catalog: UiCatalog, source: string): string {
  const translated = catalog[source as UiCopyKey];
  if (typeof translated !== "string" || !translated.trim()) {
    throw new Error(`Missing NUR UI copy key: ${JSON.stringify(source)}`);
  }
  return translated;
}

function catalogFormat(catalog: UiCatalog, source: string, values: readonly unknown[]): string {
  const translated = catalogLookup(catalog, source);
  return translated.replace(/\{(\d+)\}/gu, (_match, rawIndex: string) => {
    const index = Number(rawIndex);
    if (index >= values.length) throw new Error(`Missing NUR UI copy value {${index}} for ${JSON.stringify(source)}`);
    return String(values[index]);
  });
}

function translateTree<T>(value: T, catalog: UiCatalog): T {
  if (typeof value === "string") return catalogLookup(catalog, value) as T;
  if (typeof value === "function" || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(row => translateTree(row, catalog)) as T;
  if (typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, row]) => [key, translateTree(row, catalog)]),
  ) as T;
}

function languageControlsFromCatalog(catalog: UiCatalog): LanguageControlCopy {
  const copy = translateTree(enLanguageControls, catalog);
  copy.saved = label => catalogFormat(catalog, "Saved: {0}.", [label]);
  return copy;
}

function criticalFromCatalog(catalog: UiCatalog): CriticalCopy {
  const copy = translateTree(enCritical, catalog);
  copy.talk.holdingPopulated = count => catalogFormat(
    catalog,
    count === 1
      ? "{0} persisted Talk turn is available in this private ledger."
      : "{0} persisted Talk turns are available in this private ledger.",
    [count],
  );
  copy.capsule.excludedNote = count => catalogFormat(
    catalog,
    count === 1
      ? "{0} source stays excluded — the recipient sees the boundary, never the content."
      : "{0} sources stay excluded — the recipient sees the boundary, never the content.",
    [count],
  );
  return copy;
}

let activeVariant: UiWritingVariant = UI_VARIANTS.en[0];
let activeLocale: SupportedLocale = "en";

export function activateUiLocale(
  rawLocale: string | null | undefined,
  preference: WritingPreference | string | null | undefined = "default",
): UiWritingVariant {
  activeLocale = resolveLocale(rawLocale);
  activeVariant = resolveWritingVariant(activeLocale, preference);
  return activeVariant;
}

export function activeUiLocale(): SupportedLocale {
  return activeLocale;
}

export function activeUiCatalog(): UiCatalog {
  return UI_CATALOGS[activeVariant.catalog] as UiCatalog;
}

/** Marks deferred product copy while keeping translation lookup at render time. */
export function uiSource(source: string): UiCopyKey {
  return source as UiCopyKey;
}

export function uiCopy(source: UiCopyKey): string {
  return catalogLookup(activeUiCatalog(), source);
}

export function uiFormat(source: UiCopyKey, values: readonly unknown[]): string {
  return catalogFormat(activeUiCatalog(), source, values);
}

export function verbatimUserText<T extends string>(value: T): T {
  return value;
}

/**
 * Writes owner-authored or externally sourced content without ever passing it
 * through the UI catalog. The marker also protects the node from later
 * canonical V197 copy passes during route changes and language switches.
 */
export function setVerbatimUserText(node: Element | null, value: string): void {
  if (!node) return;
  markVerbatimUserContent(node);
  node.textContent = verbatimUserText(value);
}

export function markVerbatimUserContent(node: Element | null): void {
  if (node && "dataset" in node) (node as HTMLElement).dataset.nurUserContent = "true";
}

/** Marks an internal state token that is never intended as interface copy. */
export function structuralValue<T extends string>(value: T): T {
  return value;
}

type CanonicalSlot = {
  frame: "entry" | "universe";
  selector: string;
  kind: "text" | "attribute";
  textIndex?: number;
  attribute?: string;
  source: string;
};

export type CanonicalCopyResult = {
  frame: "entry" | "universe" | "unknown";
  applied: number;
  missing: number;
};

export function applyCanonicalV197Copy(
  document: Document,
  rawLocale: string | null | undefined,
  preference: WritingPreference | string | null | undefined = "default",
): CanonicalCopyResult {
  const resolved = resolveLocale(rawLocale);
  const selected = activateUiLocale(resolved, preference);
  const catalog = UI_CATALOGS[selected.catalog] as UiCatalog;
  const frame = document.querySelector("#page-systems")
    ? "universe"
    : document.querySelector("#nur-front-v61")
      ? "entry"
      : "unknown";
  let applied = 0;
  let missing = 0;
  if (frame !== "unknown") {
    for (const slot of (canonicalSlots as unknown as CanonicalSlot[]).filter(row => row.frame === frame)) {
      const element = document.querySelector<HTMLElement>(slot.selector);
      if (!element) {
        missing += 1;
        continue;
      }
      const translated = catalogLookup(catalog, slot.source);
      if (element.closest('[data-nur-user-content="true"]')) continue;
      const previousCatalogId = element.dataset.nurCopyCatalog as UiCatalogId | undefined;
      const previousCatalog = previousCatalogId && previousCatalogId in UI_CATALOGS
        ? UI_CATALOGS[previousCatalogId] as UiCatalog
        : null;
      const expected = previousCatalog
        ? catalogLookup(previousCatalog, slot.source)
        : slot.source;
      if (slot.kind === "attribute" && slot.attribute) {
        const current = element.getAttribute(slot.attribute) ?? "";
        if (current !== expected && current !== translated) {
          element.dataset.nurUserContent = "true";
          continue;
        }
        element.setAttribute(slot.attribute, translated);
      } else {
        const textNodes = [...element.childNodes].filter(node => node.nodeType === 3);
        const node = textNodes[slot.textIndex ?? -1];
        if (!node) {
          missing += 1;
          continue;
        }
        const original = node.nodeValue ?? "";
        const leading = original.match(/^\s*/u)?.[0] ?? "";
        const trailing = original.match(/\s*$/u)?.[0] ?? "";
        const contentEnd = trailing.length ? original.length - trailing.length : original.length;
        const current = original.slice(leading.length, contentEnd);
        if (current !== expected && current !== translated) {
          element.dataset.nurUserContent = "true";
          continue;
        }
        node.nodeValue = `${leading}${translated}${trailing}`;
      }
      element.dataset.nurCopyCatalog = selected.catalog;
      applied += 1;
    }
  }
  document.documentElement.lang = resolved;
  document.documentElement.dir = selected.dir;
  document.body.dataset.nurLocale = resolved;
  document.body.dataset.nurWritingPreference = selected.preference;
  document.body.dataset.nurCatalog = selected.catalog;
  return { frame, applied, missing };
}

for (const locale of SUPPORTED_LOCALES) {
  const catalog = catalogFor(locale, writingPreferenceForLocale(locale));
  CORE_COPY[locale] = translateTree(CORE_COPY.en, catalog);
  CRITICAL_COPY[locale] = criticalFromCatalog(catalog);
  V197_NAV_COPY[locale] = translateTree(enNavigation, catalog);
  LANGUAGE_CONTROL_COPY[locale] = languageControlsFromCatalog(catalog);
}
