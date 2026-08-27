import manifest from "../i18n/source-manifest.json";
import {
  LOCALE_LABELS,
  LOCALE_QUALITY,
  SUPPORTED_LOCALES,
  directionFor,
  getUiCopy,
  normalizeLocale,
  resolveWritingPreference,
  type CatalogQuality,
  type SupportedLocale,
  type TextDirection,
  type UiCopyKey,
  type WritingPreference,
} from "../i18n";

export { SUPPORTED_LOCALES, normalizeLocale as resolveLocale, type SupportedLocale };
export type { WritingPreference };

export type LocaleMeta = {
  locale: SupportedLocale;
  label: string;
  /** Deprecated display status retained for existing V197 consumers; use quality for review truth. */
  status: "polished_beta" | "draft_unreviewed";
  dir: TextDirection;
  quality: CatalogQuality;
};

export const POLISHED_BETA_LOCALES = ["en"] as const;

const sourceToKey = new Map((manifest as Array<{ id: UiCopyKey; source: string }>).map(row => [row.source, row.id]));

function textFor(locale: SupportedLocale, variant: WritingPreference | undefined, source: string, params?: Record<string, string | number>): string {
  const key = sourceToKey.get(source);
  if (!key) throw new Error(`Uncatalogued compatibility copy: ${source}`);
  return getUiCopy(locale, key, variant, params);
}

function localizeTree(value: unknown, locale: SupportedLocale, variant: WritingPreference): unknown {
  if (typeof value === "string") return textFor(locale, variant, value);
  if (Array.isArray(value)) return value.map(item => localizeTree(item, locale, variant));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, localizeTree(child, locale, variant)]));
  }
  return value;
}

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
    holdingPopulated: count => `${count} persisted Talk turns are available in this private ledger.`,
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
    excludedNote: count => `${count} source${count === 1 ? "" : "s"} stay${count === 1 ? "s" : ""} excluded — the recipient sees the boundary, never the content.`,
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



function defaultVariant(locale: SupportedLocale): WritingPreference {
  return resolveWritingPreference(locale, undefined);
}

export function writingPreferenceForLocale(locale: string): WritingPreference {
  return defaultVariant(normalizeLocale(locale));
}

export function dirForLocale(locale: string): TextDirection {
  const resolved = normalizeLocale(locale);
  return directionFor(resolved, resolved === "ur" ? "script" : defaultVariant(resolved));
}

const localeMetaRows = SUPPORTED_LOCALES.map((locale): LocaleMeta => ({
  locale,
  label: LOCALE_LABELS[locale],
  status: LOCALE_QUALITY[locale] === "TECHNICALLY_COMPLETE" ? "polished_beta" : "draft_unreviewed",
  quality: LOCALE_QUALITY[locale],
  dir: dirForLocale(locale),
}));
export const LOCALE_META: LocaleMeta[] = localeMetaRows;

const privateBoundarySource = "Private Orbit";
const askPlaceholderSource = "Say it plainly...";
export const CORE_COPY = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => {
  const variant = defaultVariant(locale);
  return [locale, {
    privateBoundary: textFor(locale, variant, privateBoundarySource),
    askPlaceholder: textFor(locale, variant, askPlaceholderSource),
  }];
})) as Record<SupportedLocale, { privateBoundary: string; askPlaceholder: string }>;

export function coreCopyFor(
  rawLocale: string | null | undefined,
  requested: WritingPreference = "default",
): { privateBoundary: string; askPlaceholder: string } {
  const locale = normalizeLocale(rawLocale);
  const variant = resolveWritingPreference(locale, requested);
  if (locale === "en" && variant === "default") return CORE_COPY.en;
  return {
    privateBoundary: textFor(locale, variant, privateBoundarySource),
    askPlaceholder: textFor(locale, variant, askPlaceholderSource),
  };
}

export const V197_NAV_COPY = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => {
  const variant = defaultVariant(locale);
  return [locale, localizeTree(enNavigation, locale, variant)];
})) as Record<SupportedLocale, NavigationCopy>;

export const LANGUAGE_CONTROL_COPY = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => {
  const variant = defaultVariant(locale);
  const localized = localizeTree(enLanguageControls, locale, variant) as LanguageControlCopy;
  return [locale, {
    ...localized,
    saved: (label: string) => textFor(locale, variant, "Saved: {{0}}.", { 0: label }),
  }];
})) as Record<SupportedLocale, LanguageControlCopy>;

export const CRITICAL_COPY = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => {
  const variant = defaultVariant(locale);
  const localized = localizeTree(enCritical, locale, variant) as CriticalCopy;
  return [locale, {
    ...localized,
    talk: {
      ...localized.talk,
      holdingPopulated: (count: number) => textFor(locale, variant, "{{0}} persisted Talk turns are available in this private ledger.", { 0: count }),
    },
    capsule: {
      ...localized.capsule,
      excludedNote: (count: number) => textFor(locale, variant, count === 1 ? "{{0}} source stays excluded — the recipient sees the boundary, never the content." : "{{0}} sources stay excluded — the recipient sees the boundary, never the content.", { 0: count }),
    },
  }];
})) as Record<SupportedLocale, CriticalCopy>;

export function navigationCopyFor(
  rawLocale: string | null | undefined,
  requested: WritingPreference = "default",
): NavigationCopy {
  const locale = normalizeLocale(rawLocale);
  const variant = resolveWritingPreference(locale, requested);
  if (locale === "en" && variant === "default") return V197_NAV_COPY.en;
  return localizeTree(enNavigation, locale, variant) as NavigationCopy;
}

export function languageControlCopyFor(
  rawLocale: string | null | undefined,
  requested: WritingPreference = "default",
): LanguageControlCopy {
  const locale = normalizeLocale(rawLocale);
  const variant = resolveWritingPreference(locale, requested);
  if (locale === "en" && variant === "default") return LANGUAGE_CONTROL_COPY.en;
  const localized = localizeTree(enLanguageControls, locale, variant) as LanguageControlCopy;
  return {
    ...localized,
    saved: (label: string) => textFor(locale, variant, "Saved: {{0}}.", { 0: label }),
  };
}

export function criticalCopyFor(
  rawLocale: string | null | undefined,
  requested: WritingPreference = "default",
): CriticalCopy {
  const locale = normalizeLocale(rawLocale);
  const variant = resolveWritingPreference(locale, requested);
  if (locale === "en" && variant === "default") return CRITICAL_COPY.en;
  const localized = localizeTree(enCritical, locale, variant) as CriticalCopy;
  return {
    ...localized,
    talk: {
      ...localized.talk,
      holdingPopulated: (count: number) => textFor(locale, variant, "{{0}} persisted Talk turns are available in this private ledger.", { 0: count }),
    },
    capsule: {
      ...localized.capsule,
      excludedNote: (count: number) => textFor(locale, variant, count === 1 ? "{{0}} source stays excluded — the recipient sees the boundary, never the content." : "{{0}} sources stay excluded — the recipient sees the boundary, never the content.", { 0: count }),
    },
  };
}
