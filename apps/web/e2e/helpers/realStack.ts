import { expect, type FrameLocator, type Page } from "@playwright/test";

export async function revealRealEntry(page: Page): Promise<FrameLocator> {
  await page.goto("/", { waitUntil: "load" });
  const entry = page.frameLocator("#nur-entry-stage");
  await expect.poll(() => entry.locator("body").evaluate(() => (
    typeof (window as unknown as { nurShowFront?: unknown }).nurShowFront
  ))).toBe("function");
  await entry.locator("body").evaluate(() => {
    (window as unknown as { nurShowFront: () => void }).nurShowFront();
  });
  return entry;
}

export async function registerRealOwner(page: Page, proof: string): Promise<string> {
  const entry = await revealRealEntry(page);
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `${proof}-${suffix}@nurapp.dev`;
  await entry.locator("#f4-begin").click();
  const form = entry.locator("#f4-signup-form");
  const nameInput = form.locator("#f4-name");
  const emailInput = form.locator("#f4-email");
  const passwordInput = form.locator("#f4-password");
  const consent = form.locator("#f4-consent-check");
  const submit = form.locator("button[type='submit']");
  await expect(form).toBeVisible();
  await nameInput.fill(`${proof} Owner`);
  await expect(nameInput).toHaveValue(`${proof} Owner`);
  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email);
  await passwordInput.fill("orbit-pass-2026");
  await expect(passwordInput).toHaveValue("orbit-pass-2026");
  await consent.check();
  await expect(consent).toBeChecked();
  await expect(submit).toBeEnabled();
  const registered = page.waitForResponse(response => (
    response.url().includes("/api/v1/auth/register") && response.request().method() === "POST"
  ));
  await submit.click();
  expect((await registered).status()).toBe(201);
  await expect(page).toHaveURL(/\/today$/);
  return email;
}
