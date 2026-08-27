import { expect, test, type Page } from "@playwright/test";

import { installNurMocks } from "./helpers/nurMocks";

test.use({ serviceWorkers: "block" });

type LocaleCase = { locale: string; variants: string[]; direction: "ltr" | "rtl" };

const localeCases: LocaleCase[] = [
  { locale: "en", variants: ["default"], direction: "ltr" },
  { locale: "ur", variants: ["roman", "script"], direction: "ltr" },
  { locale: "hi", variants: ["roman", "script"], direction: "ltr" },
  { locale: "bn", variants: ["default"], direction: "ltr" },
  { locale: "pa", variants: ["default"], direction: "ltr" },
  { locale: "ar", variants: ["script"], direction: "rtl" },
  { locale: "fa", variants: ["script"], direction: "rtl" },
  { locale: "tr", variants: ["default"], direction: "ltr" },
  { locale: "id", variants: ["default"], direction: "ltr" },
  { locale: "ms", variants: ["default"], direction: "ltr" },
  { locale: "zh-Hans", variants: ["default"], direction: "ltr" },
  { locale: "zh-Hant", variants: ["default"], direction: "ltr" },
  { locale: "ja", variants: ["default"], direction: "ltr" },
  { locale: "ko", variants: ["default"], direction: "ltr" },
  { locale: "vi", variants: ["default"], direction: "ltr" },
  { locale: "th", variants: ["default"], direction: "ltr" },
  { locale: "fil", variants: ["default"], direction: "ltr" },
  { locale: "ta", variants: ["default"], direction: "ltr" },
  { locale: "te", variants: ["default"], direction: "ltr" },
  { locale: "mr", variants: ["default"], direction: "ltr" },
  { locale: "gu", variants: ["default"], direction: "ltr" },
  { locale: "kn", variants: ["default"], direction: "ltr" },
  { locale: "ml", variants: ["default"], direction: "ltr" },
  { locale: "ru", variants: ["default"], direction: "ltr" },
  { locale: "uk", variants: ["default"], direction: "ltr" },
  { locale: "pl", variants: ["default"], direction: "ltr" },
  { locale: "de", variants: ["default"], direction: "ltr" },
  { locale: "fr", variants: ["default"], direction: "ltr" },
  { locale: "es", variants: ["default"], direction: "ltr" },
  { locale: "pt", variants: ["default"], direction: "ltr" },
  { locale: "it", variants: ["default"], direction: "ltr" },
  { locale: "nl", variants: ["default"], direction: "ltr" },
  { locale: "sv", variants: ["default"], direction: "ltr" },
  { locale: "ro", variants: ["default"], direction: "ltr" },
  { locale: "sw", variants: ["default"], direction: "ltr" },
];

const representativeSurfaceRoutes = [
  { locale: "de", variant: "default", direction: "ltr" },
  { locale: "ar", variant: "script", direction: "rtl" },
  { locale: "ur", variant: "roman", direction: "ltr" },
  { locale: "zh-Hans", variant: "default", direction: "ltr" },
] as const;

const representativeSurfacePaths = [
  ["/universe/map", "#nur-map-root"],
  ["/universe/orbits", "#nur-orbit-root"],
  ["/universe/timeline", "#nur-timeline-root"],
  ["/universe/insights", "#nur-insights-root"],
] as const;

const representativeLayouts = [
  { locale: "de", variant: "default", direction: "ltr" },
  { locale: "fr", variant: "default", direction: "ltr" },
  { locale: "es", variant: "default", direction: "ltr" },
  { locale: "pt", variant: "default", direction: "ltr" },
  { locale: "ar", variant: "script", direction: "rtl" },
  { locale: "fa", variant: "script", direction: "rtl" },
  { locale: "ur", variant: "script", direction: "rtl" },
  { locale: "ur", variant: "roman", direction: "ltr" },
  { locale: "zh-Hans", variant: "default", direction: "ltr" },
  { locale: "zh-Hant", variant: "default", direction: "ltr" },
  { locale: "ja", variant: "default", direction: "ltr" },
  { locale: "ko", variant: "default", direction: "ltr" },
  { locale: "th", variant: "default", direction: "ltr" },
  { locale: "bn", variant: "default", direction: "ltr" },
  { locale: "pa", variant: "default", direction: "ltr" },
  { locale: "ta", variant: "default", direction: "ltr" },
  { locale: "te", variant: "default", direction: "ltr" },
  { locale: "gu", variant: "default", direction: "ltr" },
  { locale: "kn", variant: "default", direction: "ltr" },
  { locale: "ml", variant: "default", direction: "ltr" },
] as const;

async function authenticate(page: Page): Promise<void> {
  await installNurMocks(page);
  await page.context().addCookies([
    { name: "nur_session", value: "localization-35-session", url: "http://localhost:4173", httpOnly: true, sameSite: "Lax" },
    { name: "nur_csrf", value: "localization-35-csrf", url: "http://localhost:4173", httpOnly: false, sameSite: "Lax" },
  ]);
}

async function saveLocale(page: Page, locale: string, variant: string): Promise<void> {
  const universe = page.frameLocator("#nur-universe-stage");
  await page.goto("/settings");
  const localeControl = universe.locator('[data-adjunct-control="locale"]');
  const writingControl = universe.locator('[data-adjunct-control="writing-preference"]');
  await expect(localeControl).toBeVisible({ timeout: 20_000 });
  await localeControl.selectOption(locale);
  await writingControl.selectOption(variant);
  await universe.locator('[data-adjunct-action="settings-save"]').click();
  await expect(universe.locator("html")).toHaveAttribute("lang", locale);
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const universe = page.frameLocator("#nur-universe-stage");
  const metrics = await universe.locator("html").evaluate((html) => {
    const body = html.ownerDocument.body;
    return {
      documentOverflow: html.scrollWidth - html.clientWidth,
      bodyOverflow: body ? body.scrollWidth - body.clientWidth : 0,
      clippedControls: [...html.querySelectorAll<HTMLElement>("button, select, input, textarea, [role=dialog]")]
        .filter((node) => node.scrollWidth > node.clientWidth + 4)
        .slice(0, 10)
        .map((node) => `${node.tagName}.${node.className}[${node.textContent?.trim().slice(0, 90) ?? ""}](${node.clientWidth}x${node.scrollWidth})`),
    };
  });
  expect(metrics.documentOverflow, "document horizontal overflow").toBeLessThanOrEqual(4);
  expect(metrics.bodyOverflow, "body horizontal overflow").toBeLessThanOrEqual(4);
  expect(metrics.clippedControls, "controls with clipped text").toEqual([]);
}

test.describe("NUR static 35-locale offline localization", () => {
  for (const localeCase of localeCases) {
    for (const variant of localeCase.variants) {
      test(`${localeCase.locale}:${variant} persists after reload with valid writing options`, async ({ page }) => {
        test.slow();
        await authenticate(page);
        await saveLocale(page, localeCase.locale, variant);
        const universe = page.frameLocator("#nur-universe-stage");
        const expectedDirection = localeCase.locale === "ur" && variant === "script" ? "rtl" : localeCase.direction;
        await expect(universe.locator("html")).toHaveAttribute("dir", expectedDirection);
        const localeControl = universe.locator('[data-adjunct-control="locale"]');
        const writingControl = universe.locator('[data-adjunct-control="writing-preference"]');
        await expect(localeControl).toHaveValue(localeCase.locale);
        await expect(writingControl).toHaveValue(variant);
        await expect(writingControl.locator("option")).toHaveCount(localeCase.variants.length === 1 ? 1 : 2);
        await page.reload({ waitUntil: "load" });
        const reloadedUniverse = page.frameLocator("#nur-universe-stage");
        const reloadedLocaleControl = reloadedUniverse.locator('[data-adjunct-control="locale"]');
        await expect(reloadedLocaleControl).toBeVisible({ timeout: 20_000 });
        await expect(reloadedLocaleControl).toHaveValue(localeCase.locale);
        await expect(reloadedUniverse.locator('[data-adjunct-control="writing-preference"]')).toHaveValue(variant);
        await expect(reloadedUniverse.locator("html")).toHaveAttribute("lang", localeCase.locale);
      });
    }
  }

  test("preserves persisted user/model content while static labels change", async ({ page }) => {
    await authenticate(page);
    const userAuthored = "Persist this already.";
    const modelAuthored = "Persisted answer.";
    await saveLocale(page, "de", "default");
    const universe = page.frameLocator("#nur-universe-stage");
    await page.goto("/talk");
    await expect(universe.locator("body")).toContainText(userAuthored);
    await expect(universe.locator("body")).toContainText(modelAuthored);
    const before = await universe.locator("body").innerText();
    await saveLocale(page, "ur", "script");
    await page.goto("/talk");
    await expect(universe.locator("body")).toContainText(userAuthored);
    await expect(universe.locator("body")).toContainText(modelAuthored);
    expect(await universe.locator("body").innerText()).toContain(userAuthored);
    expect(await universe.locator("body").innerText()).toContain(modelAuthored);
    expect(before).toContain(userAuthored);
    expect(before).toContain(modelAuthored);
  });

  for (const layout of representativeLayouts) {
    test(`${layout.locale}:${layout.variant} has no representative overflow`, async ({ page }) => {
      await authenticate(page);
      await saveLocale(page, layout.locale, layout.variant);
      const universe = page.frameLocator("#nur-universe-stage");
      await expect(universe.locator("html")).toHaveAttribute("lang", layout.locale);
      await expect(universe.locator("html")).toHaveAttribute("dir", layout.direction);
      await page.goto("/settings");
      await assertNoHorizontalOverflow(page);
      await page.goto("/universe/omega");
      await assertNoHorizontalOverflow(page);
    });
  }

  for (const layout of representativeSurfaceRoutes) {
    for (const [route, rootSelector] of representativeSurfacePaths) {
      test(`${layout.locale}:${layout.variant} localizes ${route} without overflow`, async ({ page }) => {
        await authenticate(page);
        await saveLocale(page, layout.locale, layout.variant);
        const universe = page.frameLocator("#nur-universe-stage");
        await page.goto(route);
        await expect(universe.locator("html")).toHaveAttribute("lang", layout.locale);
        await expect(universe.locator("html")).toHaveAttribute("dir", layout.direction);
        await expect(universe.locator(rootSelector)).toBeVisible({ timeout: 20_000 });
        await assertNoHorizontalOverflow(page);
      });
    }
  }
});
