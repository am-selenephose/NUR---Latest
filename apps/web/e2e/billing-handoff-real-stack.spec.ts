import { expect, test } from "@playwright/test";

import { registerRealOwner } from "./helpers/realStack";

type BillingState = {
  subscription: Record<string, unknown> | null;
  entitlements: unknown[];
  provider_configured: boolean;
};

test("Billing creates one deterministic provider handoff and grants nothing before a webhook", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The deterministic billing handoff runs once on desktop.");
  test.setTimeout(120_000);

  await page.context().route("https://billing.test/**", route => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Deterministic billing handoff</title>",
  }));
  await registerRealOwner(page, "billing-handoff");
  await page.goto("/billing", { waitUntil: "load" });
  const billing = page.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root");
  await expect(billing).toContainText("Billing without hidden authority");
  const checkout = billing.locator('[data-adjunct-action="billing-checkout-founding_orbit"]');
  await expect(checkout).toBeEnabled();

  const checkoutResponsePromise = page.waitForResponse(response => (
    response.url().includes("/api/v1/billing/checkout")
      && response.request().method() === "POST"
  ));
  const popupPromise = page.waitForEvent("popup");
  await checkout.click();
  const checkoutResponse = await checkoutResponsePromise;
  expect(checkoutResponse.status()).toBe(201);
  const checkoutBody = await checkoutResponse.json() as {
    checkout_url: string;
    is_test: boolean;
    provider: string;
    session_id: string;
  };
  expect(checkoutBody).toMatchObject({ is_test: true, provider: "test" });
  expect(checkoutBody.session_id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(checkoutBody.checkout_url).toMatch(/^https:\/\/billing\.test\//);
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toBe(checkoutBody.checkout_url);
  await popup.waitForLoadState("domcontentloaded");
  expect(popup.url()).toBe(checkoutBody.checkout_url);
  await popup.close();

  await expect(billing).toContainText(
    "Founding Orbit checkout opened through test. No subscription is claimed until the webhook ledger confirms it.",
  );
  const beforeWebhook = await page.evaluate(async () => {
    const response = await fetch("/api/v1/billing/subscription", { credentials: "include" });
    if (!response.ok) throw new Error(`billing state failed: ${response.status}`);
    return response.json() as Promise<BillingState>;
  });
  expect(beforeWebhook).toMatchObject({
    subscription: null,
    entitlements: [],
    provider_configured: true,
  });

  await page.reload({ waitUntil: "load" });
  const rehydrated = page.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root");
  await expect(rehydrated).toContainText("No paid entitlement projection");
  await expect(
    rehydrated.locator('[data-adjunct-action="billing-checkout-founding_orbit"]'),
  ).toBeEnabled();
});
