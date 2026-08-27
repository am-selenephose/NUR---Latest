import manifest from "../i18n/source-manifest.json";
import {
  CORE_COPY,
  LOCALE_META,
  criticalCopyFor,
  languageControlCopyFor,
  navigationCopyFor,
  resolveLocale,
  type SupportedLocale,
} from "../lib/i18n";
import { getUiCopy, LOCALE_VARIANTS, resolveWritingPreference, type UiCopyKey } from "../i18n";

export type WritingPreference = "default" | "roman" | "script";

const V197_SOURCE_TO_KEY = new Map(
  (manifest as Array<{ id: UiCopyKey; source: string }>).map(row => [row.source, row.id]),
);
let activeLocale: SupportedLocale = "en";
let activeWritingPreference: WritingPreference = "default";

export function setActiveV197Catalog(
  rawLocale: string | null | undefined,
  writingPreference: WritingPreference = "default",
): void {
  activeLocale = resolveLocale(rawLocale);
  activeWritingPreference = resolveWritingPreference(activeLocale, writingPreference);
}

export function v197Copy(
  source: string,
  params?: Record<string, unknown>,
): string {
  const key = V197_SOURCE_TO_KEY.get(source);
  if (!key) throw new Error(`Uncatalogued V197 copy: ${source}`);
  return getUiCopy(activeLocale, key, activeWritingPreference, params);
}

export const V197_LOCALE_META = LOCALE_META.map(row => ({ ...row }));

export function writingOptionsForLocale(rawLocale: string | null | undefined): readonly WritingPreference[] {
  const locale = resolveLocale(rawLocale);
  return LOCALE_VARIANTS[locale] as readonly WritingPreference[];
}

function setText(document: Document, selector: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(node => {
    node.textContent = value;
  });
}

function setPlaceholder(document: Document, selector: string, value: string): void {
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector).forEach(node => {
    node.placeholder = value;
  });
}

function setDirectLabel(document: Document, selector: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(control => {
    const labels = [...control.children].filter(
      child => child.tagName === "SPAN" && !child.classList.contains("nur-exact-mini-host"),
    );
    const label = labels[labels.length - 1];
    if (label) label.textContent = value;
  });
}

function setLeadingText(document: Document, selector: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(node => {
    const leading = [...node.childNodes].find(child => child.nodeType === 3);
    if (leading) leading.nodeValue = `${value} `;
  });
}

function setTrailingText(document: Document, selector: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(node => {
    const textNodes = [...node.childNodes].filter(child => child.nodeType === 3);
    const trailing = textNodes[textNodes.length - 1];
    if (trailing) trailing.nodeValue = value;
    else node.append(document.createTextNode(value));
  });
}

function setTitleParts(document: Document, selector: string, title: string, emphasis: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(node => {
    const leading = [...node.childNodes].find(child => child.nodeType === 3);
    if (leading) leading.nodeValue = title;
    node.querySelector<HTMLElement>("em")?.replaceChildren(emphasis);
  });
}

export function directionForPreference(locale: string, writingPreference: WritingPreference): "ltr" | "rtl" {
  const resolved = resolveLocale(locale);
  if (resolved === "ur" && writingPreference === "roman") return "ltr";
  return resolved === "ur" || resolved === "ar" || resolved === "fa" ? "rtl" : "ltr";
}

/**
 * Mutates only established V197 copy slots and document language metadata.
 * It does not alter classes, geometry, the master star, or the NUR wordmark.
 */
export function applyV197Locale(
  document: Document,
  rawLocale: string | null | undefined,
  writingPreference: WritingPreference = "default",
): void {
  const locale = resolveLocale(rawLocale);
  const resolvedWritingPreference = resolveWritingPreference(locale, writingPreference);
  setActiveV197Catalog(locale, resolvedWritingPreference);
  const copy = navigationCopyFor(locale);
  const critical = criticalCopyFor(locale);
  const direction = directionForPreference(locale, resolvedWritingPreference);

  document.documentElement.lang = locale;
  document.documentElement.dir = direction;
  document.body.dataset.nurLocale = locale;
  document.body.dataset.nurWritingPreference = resolvedWritingPreference;

  const pageLabels: Array<[string, string]> = [
    ["today", copy.today],
    ["talk", copy.talk],
    ["journal", copy.journal],
    ["plan", copy.plan],
    ["systems", copy.systems],
  ];
  for (const [page, label] of pageLabels) {
    setText(document, `[data-page="${page}"] .clean-nav-title`, label);
    setDirectLabel(document, `.mobile-tabs [data-page="${page}"]`, label);
  }

  const worldLabels: Array<[string, string]> = [
    ["universe", copy.universe],
    ["map", copy.map],
    ["orbits", copy.orbits],
    ["timeline", copy.timeline],
    ["insights", copy.insights],
  ];
  for (const [world, label] of worldLabels) {
    setDirectLabel(document, `[data-world-tab="${world}"]`, label);
  }

  setText(document, '[data-world-focus="research"] .clean-tool-button b', copy.research);
  setText(document, '[data-world-focus="community"] .clean-tool-button b', copy.community);
  setText(document, '[data-send="talk"] > span', critical.talk.send);
  setText(document, '[data-send="today"] > span', copy.send);
  setPlaceholder(document, "#talk-input", CORE_COPY[locale].askPlaceholder);
  setPlaceholder(document, "#today-input", CORE_COPY[locale].askPlaceholder);
  setText(document, ".v172-boundary-current b", CORE_COPY[locale].privateBoundary);

  setText(document, "#page-talk .page-kicker", critical.talk.kicker);
  setTitleParts(document, "#talk-title", critical.talk.title, critical.talk.titleEmphasis);
  setText(document, "#page-talk .page-sub", critical.talk.subtitle);
  setTrailingText(document, "#talk-stream [data-nur-talk-empty]", critical.talk.holdingEmpty);
  setText(document, "#page-talk aside .context-rail-card:nth-of-type(1) h3", critical.talk.currentThread);
  setText(document, "#page-talk aside .context-rail-card:nth-of-type(1) p", critical.talk.currentThreadSub);
  setText(document, '[data-thread-action="private"]', critical.talk.keepPrivate);
  setText(document, '[data-thread-action="journal"]', critical.talk.saveToJournal);
  setText(document, '[data-thread-action="plan"]', critical.talk.makePlan);
  setText(document, "#page-talk aside .context-rail-card:nth-of-type(2) h3", critical.talk.whatNurHolding);
  setText(document, "#talk-scope", critical.talk.changeBoundary);

  setLeadingText(document, "#page-systems .page-kicker", critical.systems.kicker);
  setTitleParts(document, "#systems-title", critical.systems.title, critical.systems.titleEmphasis);
  setTrailingText(document, "#page-systems .universe-hero-stats > span:nth-child(1)", critical.systems.activeSystems);
  setTrailingText(document, "#page-systems .universe-hero-stats > span:nth-child(2)", critical.systems.outcomesReturned);
  setTrailingText(document, "#page-systems .universe-hero-stats > span:nth-child(3)", critical.systems.insightsEvolving);
  document.querySelector("#page-systems .universe-map-panel")?.setAttribute("aria-label", critical.systems.mapLabel);
  setText(document, "#page-systems .universe-map-title small", critical.systems.mapSubtitle);
  setText(document, '#page-systems [data-action="add-system"] > b', critical.systems.addSystem);
  setText(document, '#page-systems [data-action="add-system"] > small', critical.systems.addSystemHint);
  setLeadingText(document, "#page-systems .universe-field-readout > b", critical.systems.systemField);
}

function refreshWritingControl(
  document: Document,
  select: HTMLSelectElement,
  rawLocale: string | null | undefined,
  preferred: WritingPreference,
): WritingPreference {
  const locale = resolveLocale(rawLocale);
  const copy = languageControlCopyFor(locale);
  const allowed = writingOptionsForLocale(locale);
  const selected = resolveWritingPreference(locale, preferred);
  select.replaceChildren(...allowed.map(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "roman" ? copy.writingRoman : value === "script" ? copy.writingScript : copy.writingDefault;
    option.selected = value === selected;
    return option;
  }));
  select.value = selected;
  return selected;
}

export function ensureV197LanguageControls(
  document: Document,
  rawLocale: string | null | undefined,
  writingPreference: WritingPreference,
  save: (locale: SupportedLocale, writingPreference: WritingPreference) => Promise<void>,
  aiProvider = "disabled",
): void {
  const currentLocale = resolveLocale(rawLocale);
  const copy = languageControlCopyFor(currentLocale);
  const providerLabel = aiProvider === "openai"
    ? copy.providerConfigured
    : copy.providerDisabled;
  const resolvedWritingPreference = resolveWritingPreference(currentLocale, writingPreference);
  let topbarButton = document.querySelector<HTMLButtonElement>("#nur-v197-language-open");
  if (!topbarButton) {
    topbarButton = document.createElement("button");
    topbarButton.id = "nur-v197-language-open";
    topbarButton.type = "button";
    topbarButton.className = "nur-scope nur-v197-language-open";
    topbarButton.setAttribute("aria-label", copy.chooseLanguage);
    topbarButton.addEventListener("click", () => {
      document.querySelector<HTMLElement>("#scope-open")?.click();
      window.setTimeout(() => document.querySelector<HTMLSelectElement>("#nur-v197-locale")?.focus(), 0);
    });
    const scopeButton = document.querySelector("#scope-open");
    scopeButton?.parentElement?.insertBefore(topbarButton, scopeButton);
  }
  const currentMeta = V197_LOCALE_META.find(row => row.locale === currentLocale);
  topbarButton.textContent = currentMeta?.label ?? currentLocale;
  topbarButton.title = copy.chooseLanguage;

  const existingLocale = document.querySelector<HTMLSelectElement>("#nur-v197-locale");
  const existingWriting = document.querySelector<HTMLSelectElement>("#nur-v197-writing-preference");
  if (existingLocale && existingWriting) {
    existingLocale.value = currentLocale;
    const selected = refreshWritingControl(document, existingWriting, currentLocale, resolvedWritingPreference);
    existingWriting.value = selected;
    existingLocale.labels[0]?.replaceChildren(copy.language);
    existingWriting.labels[0]?.replaceChildren(copy.writingPreference);
    setText(document, "#nur-v197-language-title", copy.languageAndWriting);
    setText(document, "#nur-v197-language-note", copy.settingsNote);
    setText(document, "#nur-v197-provider-status strong", providerLabel);
    setText(document, "#nur-v197-language-save", copy.saveLanguage);
    return;
  }

  const chamber = document.querySelector<HTMLElement>("#scope-modal .scope-modal");
  if (!chamber) return;
  const section = document.createElement("section");
  section.id = "nur-v197-language-settings";
  section.className = "scope-options";
  section.setAttribute("aria-labelledby", "nur-v197-language-title");

  const title = document.createElement("h3");
  title.id = "nur-v197-language-title";
  title.textContent = copy.languageAndWriting;
  const note = document.createElement("p");
  note.id = "nur-v197-language-note";
  note.textContent = copy.settingsNote;

  const providerStatus = document.createElement("div");
  providerStatus.id = "nur-v197-provider-status";
  providerStatus.className = "nur-v197-provider-status";
  const providerTitle = document.createElement("span");
  providerTitle.textContent = copy.providerStatus;
  const providerValue = document.createElement("strong");
  providerValue.textContent = providerLabel;
  const providerNote = document.createElement("small");
  providerNote.textContent = aiProvider === "openai"
    ? copy.providerConfiguredNote
    : copy.providerDisabledNote;
  providerStatus.append(providerTitle, providerValue, providerNote);

  const localeLabel = document.createElement("label");
  localeLabel.setAttribute("for", "nur-v197-locale");
  localeLabel.textContent = copy.language;
  const localeSelect = document.createElement("select");
  localeSelect.id = "nur-v197-locale";
  localeSelect.className = "scope-option nur-v197-select";
  localeSelect.setAttribute("aria-label", copy.languageAria);
  V197_LOCALE_META.forEach(row => {
    const option = document.createElement("option");
    option.value = row.locale;
    option.textContent = v197Copy("{{0}} · {{1}}", { 0: row.label, 1: row.status === "polished_beta" ? copy.reviewed : copy.draft });
    localeSelect.append(option);
  });
  localeSelect.value = currentLocale;
  const localeShell = document.createElement("div");
  localeShell.className = "nur-v197-select-shell";
  localeShell.append(localeSelect);

  const writingLabel = document.createElement("label");
  writingLabel.setAttribute("for", "nur-v197-writing-preference");
  writingLabel.textContent = copy.writingPreference;
  const writingSelect = document.createElement("select");
  writingSelect.id = "nur-v197-writing-preference";
  writingSelect.className = "scope-option nur-v197-select";
  writingSelect.setAttribute("aria-label", copy.writingPreferenceAria);
  refreshWritingControl(document, writingSelect, currentLocale, resolvedWritingPreference);
  const writingShell = document.createElement("div");
  writingShell.className = "nur-v197-select-shell";
  writingShell.append(writingSelect);
  localeSelect.addEventListener("change", () => {
    refreshWritingControl(document, writingSelect, localeSelect.value, writingSelect.value as WritingPreference);
  });

  const saveButton = document.createElement("button");
  saveButton.id = "nur-v197-language-save";
  saveButton.type = "button";
  saveButton.className = "scope-option";
  saveButton.textContent = copy.saveLanguage;
  const status = document.createElement("p");
  status.id = "nur-v197-language-status";
  status.setAttribute("aria-live", "polite");

  saveButton.addEventListener("click", async () => {
    const locale = resolveLocale(localeSelect.value);
    const preference = writingSelect.value as WritingPreference;
    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
    status.textContent = copy.savingPrivately;
    try {
      await save(locale, preference);
      applyV197Locale(document, locale, preference);
      const label = V197_LOCALE_META.find(row => row.locale === locale)?.label ?? locale;
      if (topbarButton) topbarButton.textContent = label;
      status.textContent = copy.saved(V197_LOCALE_META.find(row => row.locale === locale)?.label ?? locale);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : copy.saveError;
    } finally {
      saveButton.disabled = false;
      saveButton.removeAttribute("aria-busy");
    }
  });

  section.append(
    title,
    note,
    providerStatus,
    localeLabel,
    localeShell,
    writingLabel,
    writingShell,
    saveButton,
    status,
  );
  chamber.append(section);
}
