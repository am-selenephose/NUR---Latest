import sourceCatalogJson from "../src/lib/i18n/catalogs/en.json" with { type: "json" };

import {
  expect,
  test,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";

import { installNurMocks } from "./helpers/nurMocks";

type Locale =
  | "en" | "ur" | "hi" | "bn" | "pa" | "ar" | "fa" | "tr" | "id" | "ms"
  | "zh-Hans" | "zh-Hant" | "ja" | "ko" | "vi" | "th" | "fil" | "ta"
  | "te" | "mr" | "gu" | "kn" | "ml" | "ru" | "uk" | "pl" | "de" | "fr"
  | "es" | "pt" | "it" | "nl" | "sv" | "ro" | "sw";
type WritingPreference = "default" | "roman" | "script";
type CatalogId =
  | Exclude<Locale, "ur" | "hi">
  | "ur-roman" | "ur-script" | "hi-roman" | "hi-script";
type SourceKey = keyof typeof sourceCatalogJson;
type Catalog = Record<SourceKey, string>;

type CatalogVariant = {
  label: string;
  locale: Locale;
  writingPreference: WritingPreference;
  catalog: CatalogId;
  dir: "ltr" | "rtl";
};

type RouteCase = {
  path: string;
  root: string;
  text: string;
  source: SourceKey;
  activeClass?: boolean;
  readyAttribute?: string;
  preservedEvidence?: { selector: string; text: string };
};

type RouteGroup = {
  name: string;
  persistThroughDialog: boolean;
  routes: readonly RouteCase[];
};

const CATALOG_VARIANTS = [
  { label: "English", locale: "en", writingPreference: "default", catalog: "en", dir: "ltr" },
  { label: "Urdu Roman", locale: "ur", writingPreference: "roman", catalog: "ur-roman", dir: "ltr" },
  { label: "Urdu script", locale: "ur", writingPreference: "script", catalog: "ur-script", dir: "rtl" },
  { label: "Hindi Roman", locale: "hi", writingPreference: "roman", catalog: "hi-roman", dir: "ltr" },
  { label: "Hindi script", locale: "hi", writingPreference: "script", catalog: "hi-script", dir: "ltr" },
  { label: "Bengali", locale: "bn", writingPreference: "script", catalog: "bn", dir: "ltr" },
  { label: "Punjabi", locale: "pa", writingPreference: "script", catalog: "pa", dir: "ltr" },
  { label: "Arabic", locale: "ar", writingPreference: "script", catalog: "ar", dir: "rtl" },
  { label: "Persian", locale: "fa", writingPreference: "script", catalog: "fa", dir: "rtl" },
  { label: "Turkish", locale: "tr", writingPreference: "default", catalog: "tr", dir: "ltr" },
  { label: "Indonesian", locale: "id", writingPreference: "default", catalog: "id", dir: "ltr" },
  { label: "Malay", locale: "ms", writingPreference: "default", catalog: "ms", dir: "ltr" },
  { label: "Chinese simplified", locale: "zh-Hans", writingPreference: "script", catalog: "zh-Hans", dir: "ltr" },
  { label: "Chinese traditional", locale: "zh-Hant", writingPreference: "script", catalog: "zh-Hant", dir: "ltr" },
  { label: "Japanese", locale: "ja", writingPreference: "script", catalog: "ja", dir: "ltr" },
  { label: "Korean", locale: "ko", writingPreference: "script", catalog: "ko", dir: "ltr" },
  { label: "Vietnamese", locale: "vi", writingPreference: "default", catalog: "vi", dir: "ltr" },
  { label: "Thai", locale: "th", writingPreference: "script", catalog: "th", dir: "ltr" },
  { label: "Filipino", locale: "fil", writingPreference: "default", catalog: "fil", dir: "ltr" },
  { label: "Tamil", locale: "ta", writingPreference: "script", catalog: "ta", dir: "ltr" },
  { label: "Telugu", locale: "te", writingPreference: "script", catalog: "te", dir: "ltr" },
  { label: "Marathi", locale: "mr", writingPreference: "script", catalog: "mr", dir: "ltr" },
  { label: "Gujarati", locale: "gu", writingPreference: "script", catalog: "gu", dir: "ltr" },
  { label: "Kannada", locale: "kn", writingPreference: "script", catalog: "kn", dir: "ltr" },
  { label: "Malayalam", locale: "ml", writingPreference: "script", catalog: "ml", dir: "ltr" },
  { label: "Russian", locale: "ru", writingPreference: "script", catalog: "ru", dir: "ltr" },
  { label: "Ukrainian", locale: "uk", writingPreference: "script", catalog: "uk", dir: "ltr" },
  { label: "Polish", locale: "pl", writingPreference: "default", catalog: "pl", dir: "ltr" },
  { label: "German", locale: "de", writingPreference: "default", catalog: "de", dir: "ltr" },
  { label: "French", locale: "fr", writingPreference: "default", catalog: "fr", dir: "ltr" },
  { label: "Spanish", locale: "es", writingPreference: "default", catalog: "es", dir: "ltr" },
  { label: "Portuguese", locale: "pt", writingPreference: "default", catalog: "pt", dir: "ltr" },
  { label: "Italian", locale: "it", writingPreference: "default", catalog: "it", dir: "ltr" },
  { label: "Dutch", locale: "nl", writingPreference: "default", catalog: "nl", dir: "ltr" },
  { label: "Swedish", locale: "sv", writingPreference: "default", catalog: "sv", dir: "ltr" },
  { label: "Romanian", locale: "ro", writingPreference: "default", catalog: "ro", dir: "ltr" },
  { label: "Swahili", locale: "sw", writingPreference: "default", catalog: "sw", dir: "ltr" },
] as const satisfies readonly CatalogVariant[];

const ROUTE_GROUPS = [
  {
    name: "core routes",
    persistThroughDialog: true,
    routes: [
      { path: "/today", root: "#page-today", text: '[data-page="today"]:visible .clean-nav-title', source: "Today", activeClass: true },
      {
        path: "/talk",
        root: "#page-talk",
        text: '[data-page="talk"]:visible .clean-nav-title',
        source: "Talk",
        activeClass: true,
        preservedEvidence: { selector: "#talk-stream", text: "Persist this already." },
      },
      { path: "/journal", root: "#page-journal", text: '[data-page="journal"]:visible .clean-nav-title', source: "Journal", activeClass: true },
      { path: "/plan", root: "#page-plan", text: '[data-page="plan"]:visible .clean-nav-title', source: "Plan", activeClass: true },
      { path: "/systems", root: "#page-systems", text: '[data-page="systems"]:visible .clean-nav-title', source: "Systems", activeClass: true },
    ],
  },
  {
    name: "dedicated universe routes",
    persistThroughDialog: false,
    routes: [
      { path: "/universe/map", root: "#nur-map-root", text: "#nur-map-root .nur-map-title h1", source: "Map", readyAttribute: "data-map-loaded" },
      { path: "/universe/orbits", root: "#nur-orbit-root", text: "#nur-orbit-root .nur-orbit-title", source: "Orbit" },
      {
        path: "/universe/timeline",
        root: "#nur-timeline-root",
        text: "#nur-timeline-root .nur-timeline-title h1",
        source: "Timeline",
        readyAttribute: "data-timeline-loaded",
        preservedEvidence: { selector: "#nur-timeline-root", text: "The owner returned a visible outcome." },
      },
      {
        path: "/universe/insights",
        root: "#nur-insights-root",
        text: "#nur-insights-root .nur-insights-heading h1",
        source: "Insights",
        readyAttribute: "data-insights-loaded",
        preservedEvidence: { selector: "#nur-insights-root .nur-insights-provenance", text: "omega_owner_ledger" },
      },
    ],
  },
  {
    name: "owner adjunct routes",
    persistThroughDialog: false,
    routes: [
      { path: "/settings", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Your NUR, held on your terms." },
      { path: "/memory", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Memory stays proposed until you choose it." },
      { path: "/teach-nur", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Teach NUR without surrendering authority." },
      { path: "/billing", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Billing without hidden authority." },
      { path: "/capsules", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Share a room, never your whole mind." },
    ],
  },
  {
    name: "execution adjunct routes",
    persistThroughDialog: false,
    routes: [
      { path: "/agents", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Agency under your authority." },
      { path: "/projects", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Intent becomes evidence, then a shipped result." },
      { path: "/glow", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Movement becomes visible light." },
      { path: "/notifications", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Return cues, under your control." },
    ],
  },
  {
    name: "universe adjunct routes",
    persistThroughDialog: false,
    routes: [
      { path: "/universe/omega", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Evidence changes the model, deliberately." },
      { path: "/universe/insights/candidates", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Candidate insight, never silent truth." },
      { path: "/universe/consultation", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "A question moves when context returns." },
      { path: "/universe/community", root: "#nur-v197-adjunct-root", text: "#nur-v197-adjunct-root .nur-adjunct-hero h1", source: "Shared signal without private spill." },
    ],
  },
] as const satisfies readonly RouteGroup[];

const RESPONSIVE_VARIANTS = CATALOG_VARIANTS.filter(({ catalog }) => [
  "de", "fr", "zh-Hans", "ja", "th", "hi-script", "ur-script", "ar", "fa", "ur-roman",
].includes(catalog));

const sourceCatalog = sourceCatalogJson as Catalog;
const catalogCache = new Map<CatalogId, Promise<Catalog>>();

function catalogFor(id: CatalogId): Promise<Catalog> {
  const cached = catalogCache.get(id);
  if (cached) return cached;
  const imported = import(
    new URL(`../src/lib/i18n/catalogs/${id}.json`, import.meta.url).href,
    { with: { type: "json" } }
  ).then(module => module.default as Catalog);
  catalogCache.set(id, imported);
  return imported;
}

function copy(catalog: Catalog, source: SourceKey): string {
  expect(sourceCatalog[source], `English source catalog retains ${String(source)}`).toBe(source);
  const translated = catalog[source];
  expect(translated, `active catalog contains ${String(source)}`).toEqual(expect.any(String));
  expect(translated.trim(), `active catalog has nonempty ${String(source)}`).not.toBe("");
  return translated;
}

function formatCopy(pattern: string, values: readonly string[]): string {
  return pattern.replace(/\{(\d+)\}/gu, (token, index: string) => values[Number(index)] ?? token);
}

function routePattern(path: string): RegExp {
  return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "u");
}

async function openUniverse(page: Page): Promise<FrameLocator> {
  await page.goto("/systems", { waitUntil: "load" });
  await expect(page.locator("#nur-universe-stage")).toHaveClass(/is-visible/u);
  const universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#page-systems")).toBeVisible();
  return universe;
}

async function assertCatalogMetadata(
  universe: FrameLocator,
  variant: CatalogVariant,
): Promise<void> {
  await expect(universe.locator("html")).toHaveAttribute("lang", variant.locale);
  await expect(universe.locator("html")).toHaveAttribute("dir", variant.dir);
  await expect(universe.locator("body")).toHaveAttribute("data-nur-locale", variant.locale);
  await expect(universe.locator("body")).toHaveAttribute(
    "data-nur-writing-preference",
    variant.writingPreference,
  );
  await expect(universe.locator("body")).toHaveAttribute("data-nur-catalog", variant.catalog);

  const provenance = await universe.locator("[data-nur-copy-catalog]").evaluateAll(nodes => (
    [...new Set(nodes.map(node => node.getAttribute("data-nur-copy-catalog")))]
  ));
  expect(provenance.length, `${variant.catalog} has catalog-owned canonical slots`).toBeGreaterThan(0);
  expect(provenance, `${variant.catalog} is the only active canonical-slot catalog`).toEqual([
    variant.catalog,
  ]);
}

async function openLanguageDialog(universe: FrameLocator): Promise<void> {
  await universe.locator("#nur-v197-language-open").click();
  await expect(universe.locator("#scope-modal")).toHaveClass(/open/u);
  await expect(universe.locator("#nur-v197-language-settings")).toBeVisible();
  await expect(universe.locator("#nur-v197-locale")).toBeFocused();
}

async function persistVariant(
  page: Page,
  variant: CatalogVariant,
): Promise<{ catalog: Catalog; universe: FrameLocator }> {
  const state = await installNurMocks(page);
  let universe = await openUniverse(page);
  const catalog = await catalogFor(variant.catalog);

  await openLanguageDialog(universe);
  const localeSelect = universe.locator("#nur-v197-locale");
  const writingSelect = universe.locator("#nur-v197-writing-preference");
  await expect(localeSelect).toHaveAccessibleName(/\S/u);
  await expect(writingSelect).toHaveAccessibleName(/\S/u);
  await localeSelect.selectOption(variant.locale);
  await writingSelect.selectOption(variant.writingPreference);
  const localeLabel = await localeSelect.locator(`option[value="${variant.locale}"]`).textContent();
  const autonym = localeLabel?.split(" · ")[0]?.trim() || variant.locale;

  const save = universe.locator("#nur-v197-language-save");
  await expect(save).toHaveAccessibleName(/\S/u);
  await save.click();
  await expect.poll(() => state.preferences.locale).toBe(variant.locale);
  await expect.poll(() => state.preferences.writing_preference).toBe(variant.writingPreference);
  await expect(universe.locator("#nur-v197-language-status")).toHaveText(formatCopy(
    copy(catalog, "Saved: {0}."),
    [autonym],
  ));
  await universe.locator("#scope-close").click();
  await expect(universe.locator("#scope-modal")).not.toHaveClass(/open/u);

  await page.reload({ waitUntil: "load" });
  await expect(page.locator("#nur-universe-stage")).toHaveClass(/is-visible/u);
  universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#page-systems")).toBeVisible();
  expect(state.preferences.locale, "mock backend retained locale after reload").toBe(variant.locale);
  expect(
    state.preferences.writing_preference,
    "mock backend retained writing preference after reload",
  ).toBe(variant.writingPreference);
  await assertCatalogMetadata(universe, variant);
  return { catalog, universe };
}

async function startSeededVariant(
  page: Page,
  variant: CatalogVariant,
): Promise<{ catalog: Catalog; universe: FrameLocator }> {
  const state = await installNurMocks(page);
  state.preferences.locale = variant.locale;
  state.preferences.writing_preference = variant.writingPreference;
  const [catalog, universe] = await Promise.all([
    catalogFor(variant.catalog),
    openUniverse(page),
  ]);
  await assertCatalogMetadata(universe, variant);
  return { catalog, universe };
}

async function pushSpaRoute(page: Page, path: string): Promise<void> {
  await page.evaluate(nextPath => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await expect(page).toHaveURL(routePattern(path));
}

async function assertAccessibleControls(root: Locator, context: string): Promise<void> {
  const controls = root.locator([
    "button:visible",
    "a[href]:visible",
    "input:not([type='hidden']):visible",
    "select:visible",
    "textarea:visible",
    "[role='button']:visible",
    "[role='tab']:visible",
  ].join(", "));
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    const identity = await control.evaluate(node => ({
      tag: node.tagName.toLowerCase(),
      id: node.id,
      action: node.getAttribute("data-action")
        ?? node.getAttribute("data-adjunct-action")
        ?? node.getAttribute("data-page")
        ?? node.getAttribute("data-world-tab"),
    }));
    await expect(
      control,
      `${context}: ${identity.tag}#${identity.id || "(no-id)"}[${identity.action || "no-action"}]`,
    ).toHaveAccessibleName(/\S/u);
  }
}

async function assertRoute(
  page: Page,
  universe: FrameLocator,
  variant: CatalogVariant,
  catalog: Catalog,
  route: RouteCase,
): Promise<void> {
  await pushSpaRoute(page, route.path);
  const root = universe.locator(route.root);
  await expect(root).toBeVisible();
  if (route.activeClass) await expect(root).toHaveClass(/active/u);
  if (route.readyAttribute) await expect(root).toHaveAttribute(route.readyAttribute, "true");
  await expect(universe.locator(route.text).first()).toHaveText(copy(catalog, route.source));
  if (route.preservedEvidence) {
    await expect(universe.locator(route.preservedEvidence.selector)).toContainText(
      route.preservedEvidence.text,
    );
  }
  await assertCatalogMetadata(universe, variant);
  await assertAccessibleControls(root, `${variant.catalog} ${route.path}`);
}

async function assertResponsiveFit(
  universe: FrameLocator,
  rootSelector: string,
  context: string,
): Promise<void> {
  const report = await universe.locator(rootSelector).evaluate(root => {
    const documentRoot = root.ownerDocument.documentElement;
    const viewportWidth = documentRoot.clientWidth;
    const rootRect = root.getBoundingClientRect();
    const visible = (node: HTMLElement): boolean => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity) !== 0
        && rect.width > 0
        && rect.height > 0;
    };
    const identity = (node: HTMLElement): string => (
      `${node.tagName.toLowerCase()}#${node.id || "(no-id)"}.${node.className || "(no-class)"}`
    );
    const controls = [...root.querySelectorAll<HTMLElement>(
      "button, a[href], input:not([type='hidden']), select, textarea, [role='button'], [role='tab']",
    )].filter(visible);
    const textContainers = [...root.querySelectorAll<HTMLElement>(
      "button, a[href], h1, h2, h3, label, [role='button'], [role='tab']",
    )].filter(visible);
    const outsideViewport = controls.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.right > viewportWidth + 1;
    }).map(identity);
    const clippedText = textContainers.filter(node => {
      const style = getComputedStyle(node);
      const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
      const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
      return (clipsX && node.scrollWidth > node.clientWidth + 1)
        || (clipsY && node.scrollHeight > node.clientHeight + 1);
    }).map(identity);
    return {
      documentOverflow: documentRoot.scrollWidth - viewportWidth,
      rootOutsideViewport: rootRect.left < -1 || rootRect.right > viewportWidth + 1,
      rootOverflow: root.scrollWidth - root.clientWidth,
      outsideViewport,
      clippedText,
    };
  });

  expect(report.documentOverflow, `${context}: ${JSON.stringify(report)}`).toBeLessThanOrEqual(1);
  expect(report.rootOutsideViewport, `${context}: ${JSON.stringify(report)}`).toBe(false);
  expect(report.rootOverflow, `${context}: ${JSON.stringify(report)}`).toBeLessThanOrEqual(1);
  expect(report.outsideViewport, `${context}: ${JSON.stringify(report)}`).toEqual([]);
  expect(report.clippedText, `${context}: ${JSON.stringify(report)}`).toEqual([]);
}

test.use({ serviceWorkers: "block" });

test("catalog matrix definition contains exactly 35 locales and 37 writing variants", () => {
  expect(new Set(CATALOG_VARIANTS.map(row => row.locale)).size).toBe(35);
  expect(new Set(CATALOG_VARIANTS.map(row => row.catalog)).size).toBe(37);
  expect(CATALOG_VARIANTS.filter(row => row.locale === "ur").map(row => row.writingPreference)).toEqual([
    "roman", "script",
  ]);
  expect(CATALOG_VARIANTS.filter(row => row.locale === "hi").map(row => row.writingPreference)).toEqual([
    "roman", "script",
  ]);
});

test.describe("desktop catalog route matrix", () => {
  test.describe.configure({ mode: "parallel" });
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || Boolean(isMobile),
    "Desktop route shards run in desktop Chromium.",
  );

  for (const variant of CATALOG_VARIANTS) {
    for (const group of ROUTE_GROUPS) {
      test(`${variant.catalog} | ${group.name}`, async ({ page }) => {
        const { catalog, universe } = group.persistThroughDialog
          ? await persistVariant(page, variant)
          : await startSeededVariant(page, variant);
        for (const route of group.routes) {
          await assertRoute(page, universe, variant, catalog, route);
        }
      });
    }

    test(`${variant.catalog} | language, scope and add-system dialogs`, async ({ page }) => {
      const { catalog, universe } = await startSeededVariant(page, variant);

      await universe.locator("#scope-open").click();
      const scopeModal = universe.locator("#scope-modal");
      await expect(scopeModal).toHaveClass(/open/u);
      await expect(scopeModal.locator(".scope-option[data-scope]")).toHaveCount(4);
      await expect(scopeModal.locator("#nur-v197-language-title")).toHaveText(
        copy(catalog, "Language and writing"),
      );
      await assertAccessibleControls(scopeModal, `${variant.catalog} scope dialog`);
      await universe.locator("#scope-close").click();
      await expect(scopeModal).not.toHaveClass(/open/u);

      await openLanguageDialog(universe);
      await expect(universe.locator("#nur-v197-language-title")).toHaveText(
        copy(catalog, "Language and writing"),
      );
      await universe.locator("#scope-close").click();

      await universe.locator('#page-systems [data-action="add-system"]').click();
      const addSystem = universe.locator("#nur-v197-system-create");
      await expect(addSystem).toHaveAttribute("open", "");
      await expect(addSystem.locator("#nur-v197-system-create-title")).toHaveText(
        copy(catalog, "Name the field."),
      );
      await expect(addSystem.locator("#nur-v197-system-title")).toBeFocused();
      await assertAccessibleControls(addSystem, `${variant.catalog} add-system dialog`);
      await addSystem.locator('[data-action="system-create-cancel"]').click();
      await expect(addSystem).not.toHaveAttribute("open", "");
    });
  }
});

test.describe("deterministic localized states", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || Boolean(isMobile),
    "State proof runs once in desktop Chromium.",
  );

  test("loading, empty and error states are observable and catalog-owned", async ({ page }) => {
    const variant = CATALOG_VARIANTS[0];
    const { catalog, universe } = await startSeededVariant(page, variant);
    let releaseMapRequest = (): void => undefined;
    const mapGate = new Promise<void>(resolve => {
      releaseMapRequest = resolve;
    });
    await page.route("**/api/v1/map/views", async route => {
      await mapGate;
      await route.fallback();
    });

    try {
      await pushSpaRoute(page, "/universe/map");
      const loading = universe.locator('#nur-map-root [data-map-loading="true"]');
      await expect(loading).toBeVisible();
      await expect(loading).toContainText(copy(catalog, "Assembling your Systems and routes…"));
    } finally {
      releaseMapRequest();
    }
    await expect(universe.locator("#nur-map-root")).toHaveAttribute("data-map-loaded", "true");

    await assertRoute(page, universe, variant, catalog, {
      path: "/agents",
      root: "#nur-v197-adjunct-root",
      text: "#nur-v197-adjunct-root .nur-adjunct-hero h1",
      source: "Agency under your authority.",
    });
    await expect(universe.locator("#nur-v197-adjunct-root")).toContainText(
      copy(catalog, "No approval is waiting"),
    );

    await pushSpaRoute(page, "/today");
    await expect(universe.locator("#page-today")).toHaveClass(/active/u);
    await page.route("**/api/v1/agentic/tools", route => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Deterministic test outage" }),
    }));
    await pushSpaRoute(page, "/agents");
    const errorRoot = universe.locator("#nur-v197-adjunct-root");
    await expect(errorRoot.locator(".nur-adjunct-hero h1")).toHaveText(
      copy(catalog, "This chamber could not open."),
    );
    await assertCatalogMetadata(universe, variant);
    await assertAccessibleControls(errorRoot, "deterministic error state");
  });
});

for (const project of ["chromium-desktop", "chromium-mobile"] as const) {
  test.describe(`${project} clipping and overflow matrix`, () => {
    test.describe.configure({ mode: "parallel" });
    test.skip(
      ({ browserName, isMobile }) => (
        browserName !== "chromium" || Boolean(isMobile) !== (project === "chromium-mobile")
      ),
      `Geometry shards run only in ${project}.`,
    );

    for (const variant of RESPONSIVE_VARIANTS) {
      test(`${variant.catalog} fits systems, Map and Settings`, async ({ page }) => {
        const { catalog, universe } = await startSeededVariant(page, variant);
        await assertRoute(page, universe, variant, catalog, ROUTE_GROUPS[0].routes[4]);
        await assertResponsiveFit(universe, "#page-systems", `${project} ${variant.catalog} /systems`);

        await assertRoute(page, universe, variant, catalog, ROUTE_GROUPS[1].routes[0]);
        await assertResponsiveFit(universe, "#nur-map-root", `${project} ${variant.catalog} /universe/map`);

        await assertRoute(page, universe, variant, catalog, ROUTE_GROUPS[2].routes[0]);
        await assertResponsiveFit(universe, "#nur-v197-adjunct-root", `${project} ${variant.catalog} /settings`);
      });
    }
  });
}
