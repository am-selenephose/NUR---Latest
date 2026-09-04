import { expect, test } from "@playwright/test";

import { installNurMocks, mockClaim } from "./helpers/nurMocks";

test.use({ serviceWorkers: "block" });

const RAW_SENTINEL = "RAW_PRIVATE_REASONING_SENTINEL";

test("Insight exposes governed epistemic receipt and opens canonical WhyChanged without raw reasoning", async ({ page }) => {
  await installNurMocks(page);
  await page.goto("/universe/insights");

  const universe = page.frameLocator("#nur-universe-stage");
  const detail = universe.locator(".nur-insights-detail");
  await expect(detail).toContainText("INFERRED");
  await expect(detail).toContainText("OWNER_CONFIRMED");
  await expect(detail).toContainText("82% confidence");

  const why = universe.locator(`[data-cognition-receipt="${mockClaim.id}"]`);
  await expect(why).toHaveText("Why changed");
  await expect(universe.locator("body")).not.toContainText(RAW_SENTINEL);

  await why.click();
  await expect(page).toHaveURL(new RegExp(`/universe/omega/why-changed/${mockClaim.id}$`));
  await expect(universe.locator("body")).toContainText("Why NUR changed its mind.");
  await expect(universe.locator("body")).not.toContainText(RAW_SENTINEL);
});

test("Map NUR tab carries ambient contradiction prediction and learning receipts without re-skinning", async ({ page }) => {
  await installNurMocks(page);
  await page.goto("/universe/map");

  const universe = page.frameLocator("#nur-universe-stage");
  await universe.getByRole("button", { name: "Center on You" }).click();
  await universe.locator('[data-map-tab="nur"]').click();

  const ambient = universe.locator('[data-cognition-ambient="true"]');
  await expect(ambient).toContainText("Governed cognition");
  await expect(ambient).toContainText("INFERRED");
  await expect(ambient).toContainText("OWNER_CONFIRMED");
  await expect(ambient).toContainText("1 open contradiction");
  await expect(ambient).toContainText("1 open prediction");
  await expect(ambient).toContainText("1 learning proposal awaiting owner decision");
  await expect(universe.locator("body")).not.toContainText(RAW_SENTINEL);
});

test("Timeline NUR tab carries the same governed ambient state in its existing detail surface", async ({ page }) => {
  await installNurMocks(page);
  await page.goto("/universe/timeline");

  const universe = page.frameLocator("#nur-universe-stage");
  const first = universe.locator("[data-timeline-entry]").first();
  await expect(first).toBeVisible();
  await first.click();
  await universe.locator('[data-timeline-tab="nur"]').click();

  const ambient = universe.locator('[data-cognition-ambient="true"]');
  await expect(ambient).toContainText("Governed cognition");
  await expect(ambient).toContainText("INFERRED");
  await expect(ambient).toContainText("OWNER_CONFIRMED");
  await expect(ambient).toContainText("1 open contradiction");
  await expect(ambient).toContainText("1 open prediction");
  await expect(ambient).toContainText("1 learning proposal awaiting owner decision");
  await expect(universe.locator("body")).not.toContainText(RAW_SENTINEL);

  const why = ambient.locator(`[data-cognition-receipt="${mockClaim.id}"]`);
  await expect(why).toHaveText("Why changed");
  await why.click();
  await expect(page).toHaveURL(new RegExp(`/universe/omega/why-changed/${mockClaim.id}$`));
  await expect(universe.locator("body")).toContainText("Why NUR changed its mind.");
  await expect(universe.locator("body")).not.toContainText(RAW_SENTINEL);
});
