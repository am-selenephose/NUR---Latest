import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { registerRealOwner } from "./helpers/realStack";

type NotificationRow = {
  id: string;
  title: string;
  read_at: string | null;
};

type ResearchBrief = {
  id: string;
  question: string;
};

type CommunityRoom = {
  id: string;
  title: string;
};

type OwnerLifecycleSnapshot = {
  notifications: NotificationRow[];
  notificationPreferences: {
    frequency: string;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
  };
  researchBriefs: ResearchBrief[];
  communityRooms: CommunityRoom[];
  profilePreferences: {
    locale: string | null;
    writing_preference: string;
    sound_enabled: boolean;
    reduced_effects: boolean;
  };
  billing: {
    subscription: Record<string, unknown> | null;
    provider_configured: boolean;
    portal_available: boolean;
  };
  roomStatus: number;
};

function watchRuntime(page: Page, label: string, serverErrors: string[], pageErrors: string[]): void {
  page.on("response", response => {
    if (response.status() >= 500) {
      serverErrors.push(`${label}: ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  page.on("pageerror", error => pageErrors.push(`${label}: ${error.message}`));
}

async function attachViewport(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function reloadAuthenticated(page: Page): Promise<void> {
  const sessionRestored = page.waitForResponse(response => (
    response.url().includes("/api/v1/auth/me")
      && response.request().method() === "GET"
  ));
  await page.reload({ waitUntil: "load" });
  expect((await sessionRestored).status()).toBe(200);
  await expect(page.locator("#nur-universe-stage")).toHaveClass(/is-visible/);
}

async function ownerSnapshot(page: Page, roomId: string): Promise<OwnerLifecycleSnapshot> {
  return page.evaluate(async expectedRoomId => {
    const readJson = async <T>(path: string): Promise<T> => {
      const response = await fetch(path, { credentials: "include" });
      if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
      return response.json() as Promise<T>;
    };
    const [
      notifications,
      notificationPreferences,
      researchBriefs,
      communityRooms,
      profilePreferences,
      billing,
      roomResponse,
    ] = await Promise.all([
      readJson<NotificationRow[]>("/api/v1/notifications"),
      readJson<OwnerLifecycleSnapshot["notificationPreferences"]>("/api/v1/notifications/preferences"),
      readJson<ResearchBrief[]>("/api/v1/research/briefs"),
      readJson<CommunityRoom[]>("/api/v1/community/rooms"),
      readJson<OwnerLifecycleSnapshot["profilePreferences"]>("/api/v1/profile/preferences"),
      readJson<OwnerLifecycleSnapshot["billing"]>("/api/v1/billing/subscription"),
      fetch(`/api/v1/community/rooms/${encodeURIComponent(expectedRoomId)}`, { credentials: "include" }),
    ]);
    return {
      notifications,
      notificationPreferences,
      researchBriefs,
      communityRooms,
      profilePreferences,
      billing,
      roomStatus: roomResponse.status,
    };
  }, roomId);
}

test("Phase H persists cross-surface owner state and denies it to another owner on the real stack", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The durable two-owner lifecycle runs once on desktop.");
  test.setTimeout(300_000);

  const serverErrors: string[] = [];
  const pageErrors: string[] = [];
  const checkoutRequests: string[] = [];
  watchRuntime(page, "owner-a", serverErrors, pageErrors);
  page.on("request", request => {
    if (request.method() === "POST" && request.url().includes("/api/v1/billing/checkout")) {
      checkoutRequests.push(request.url());
    }
  });

  await registerRealOwner(page, "phase-h-lifecycle-a");
  const universe = page.frameLocator("#nur-universe-stage");

  await page.goto("/settings", { waitUntil: "load" });
  const settings = universe.locator("#nur-v197-adjunct-root");
  await expect(settings).toContainText("Persisted owner preference");
  await settings.locator('[data-adjunct-control="locale"]').selectOption("ur");
  await settings.locator('[data-adjunct-control="writing-preference"]').selectOption("roman");
  await settings.locator('[data-adjunct-control="sound"]').uncheck();
  await settings.locator('[data-adjunct-control="reduced-effects"]').check();
  const settingsSaved = page.waitForResponse(response => (
    response.url().includes("/api/v1/profile/preferences")
      && response.request().method() === "PATCH"
  ));
  await settings.locator('[data-adjunct-action="settings-save"]').click();
  expect((await settingsSaved).status()).toBe(200);
  await expect(settings).toContainText("Saved. NUR will return in this language and writing style.");
  await reloadAuthenticated(page);
  await expect(settings.locator('[data-adjunct-control="locale"]')).toHaveValue("ur");
  await expect(settings.locator('[data-adjunct-control="writing-preference"]')).toHaveValue("roman");
  await expect(settings.locator('[data-adjunct-control="sound"]')).not.toBeChecked();
  await expect(settings.locator('[data-adjunct-control="reduced-effects"]')).toBeChecked();
  await attachViewport(page, testInfo, "settings-persisted-owner-a");

  await page.goto("/notifications", { waitUntil: "load" });
  const notifications = universe.locator("#nur-v197-adjunct-root");
  await expect(notifications).toContainText("Return cues, under your control");
  await notifications.locator('[data-adjunct-control="notification-frequency"]').selectOption("QUIET");
  await notifications.locator('[data-adjunct-control="notification-quiet-start"]').fill("21:15");
  await notifications.locator('[data-adjunct-control="notification-quiet-end"]').fill("06:45");
  const notificationPreferencesSaved = page.waitForResponse(response => (
    response.url().includes("/api/v1/notifications/preferences")
      && response.request().method() === "PATCH"
  ));
  await notifications.locator('[data-adjunct-action="notification-preferences-save"]').click();
  expect((await notificationPreferencesSaved).status()).toBe(200);
  await expect(notifications).toContainText("Notification boundary persisted.");

  const reminderTitle = `Phase H return cue ${Date.now()}`;
  const reminderBody = "Return to the exact owner-scoped release proof.";
  await notifications.locator('[data-adjunct-control="notification-title"]').fill(reminderTitle);
  await notifications.locator('[data-adjunct-control="notification-body"]').fill(reminderBody);
  await notifications.locator('[data-adjunct-control="notification-route"]').fill("/plan");
  const reminderCreated = page.waitForResponse(response => (
    response.url().includes("/api/v1/notifications/reminders")
      && response.request().method() === "POST"
  ));
  await notifications.locator('[data-adjunct-action="notification-reminder-create"]').click();
  const reminderResponse = await reminderCreated;
  expect(reminderResponse.status()).toBe(201);
  const reminder = await reminderResponse.json() as NotificationRow;
  await expect(notifications).toContainText(reminderTitle);

  const reminderRead = page.waitForResponse(response => (
    response.url().includes(`/api/v1/notifications/${reminder.id}/read`)
      && response.request().method() === "POST"
  ));
  await notifications.locator(`[data-adjunct-action="notification-read-${reminder.id}"]`).click();
  expect((await reminderRead).status()).toBe(200);
  await reloadAuthenticated(page);
  await expect(notifications).toContainText(reminderTitle);
  await expect(notifications.locator('[data-adjunct-control="notification-frequency"]')).toHaveValue("QUIET");
  await expect(notifications.locator('[data-adjunct-control="notification-quiet-start"]')).toHaveValue("21:15");
  await expect(notifications.locator('[data-adjunct-control="notification-quiet-end"]')).toHaveValue("06:45");
  await expect(notifications.locator(`[data-adjunct-action="notification-read-${reminder.id}"]`)).toHaveCount(0);
  await attachViewport(page, testInfo, "notifications-persisted-owner-a");

  await page.goto("/universe/research", { waitUntil: "load" });
  await expect(universe.locator("#page-systems")).toBeVisible();
  const researchQuestion = `Which Phase H evidence is durable? ${Date.now()}`;
  await universe.locator("#research-query").fill(researchQuestion);
  const researchCreated = page.waitForResponse(response => (
    response.url().includes("/api/v1/research/briefs")
      && response.request().method() === "POST"
  ));
  await universe.locator("[data-research-submit]").click();
  const researchResponse = await researchCreated;
  expect(researchResponse.status()).toBe(201);
  const researchBrief = await researchResponse.json() as ResearchBrief;
  await expect(universe.locator(".research-results")).toContainText(researchQuestion);
  await reloadAuthenticated(page);
  await expect(universe.locator(".research-results")).toContainText(researchQuestion);
  await attachViewport(page, testInfo, "research-persisted-owner-a");

  await page.goto("/universe/community", { waitUntil: "load" });
  const community = universe.locator("#nur-v197-adjunct-root");
  await expect(universe.locator("#nur-v197-community-controls")).toBeVisible();
  const roomTitle = `Phase H bounded room ${Date.now()}`;
  await universe.locator("#nur-v197-room-title").fill(roomTitle);
  const roomCreated = page.waitForResponse(response => (
    response.url().includes("/api/v1/community/rooms")
      && response.request().method() === "POST"
  ));
  await universe.locator('[data-adjunct-action="community-room-create"]').click();
  const roomResponse = await roomCreated;
  expect(roomResponse.status()).toBe(201);
  const room = await roomResponse.json() as CommunityRoom;
  await expect(page).toHaveURL(new RegExp(`/universe/community/room/${room.id}$`));

  const messageBody = `Owner A durable room line ${Date.now()}`;
  await universe.locator("#nur-v197-room-message").fill(messageBody);
  const messageCreated = page.waitForResponse(response => (
    response.url().includes(`/api/v1/community/rooms/${room.id}/messages`)
      && response.request().method() === "POST"
  ));
  await universe.locator('[data-adjunct-action="community-message-send"]').click();
  expect((await messageCreated).status()).toBe(201);
  await expect(community).toContainText(messageBody);
  await reloadAuthenticated(page);
  await expect(community).toContainText(roomTitle);
  await expect(community).toContainText(messageBody);
  await attachViewport(page, testInfo, "community-persisted-owner-a");

  await page.goto("/billing", { waitUntil: "load" });
  const billing = universe.locator("#nur-v197-adjunct-root");
  await expect(billing).toContainText("Billing without hidden authority");
  await expect(billing).toContainText("Orbit Scan Free");
  await expect(billing).toContainText("Billing provider is disabled");
  await expect(billing.locator('[data-adjunct-action="billing-portal"]')).toBeDisabled();
  const checkoutControls = billing.locator('[data-adjunct-action^="billing-checkout-"]');
  expect(await checkoutControls.count()).toBeGreaterThan(0);
  for (let index = 0; index < await checkoutControls.count(); index += 1) {
    await expect(checkoutControls.nth(index)).toBeDisabled();
  }
  await reloadAuthenticated(page);
  await expect(billing).toContainText("Billing provider is disabled");
  expect(checkoutRequests).toEqual([]);
  await attachViewport(page, testInfo, "billing-fail-closed-owner-a");

  const ownerA = await ownerSnapshot(page, room.id);
  expect(ownerA.notifications.find(row => row.id === reminder.id)).toMatchObject({
    title: reminderTitle,
  });
  expect(ownerA.notifications.find(row => row.id === reminder.id)?.read_at).not.toBeNull();
  expect(ownerA.notificationPreferences).toMatchObject({
    frequency: "QUIET",
    quiet_hours_start: "21:15",
    quiet_hours_end: "06:45",
  });
  expect(ownerA.researchBriefs).toContainEqual(expect.objectContaining({
    id: researchBrief.id,
    question: researchQuestion,
  }));
  expect(ownerA.communityRooms).toContainEqual(expect.objectContaining({ id: room.id, title: roomTitle }));
  expect(ownerA.profilePreferences).toMatchObject({
    locale: "ur",
    writing_preference: "roman",
    sound_enabled: false,
    reduced_effects: true,
  });
  expect(ownerA.billing).toMatchObject({
    subscription: null,
    provider_configured: false,
    portal_available: false,
  });
  expect(ownerA.roomStatus).toBe(200);

  const baseURL = process.env.NUR_REAL_STACK_BASE_URL;
  if (!baseURL) throw new Error("NUR_REAL_STACK_BASE_URL is required.");
  const ownerBContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const ownerBPage = await ownerBContext.newPage();
  watchRuntime(ownerBPage, "owner-b", serverErrors, pageErrors);
  try {
    await registerRealOwner(ownerBPage, "phase-h-lifecycle-b");
    const ownerBUniverse = ownerBPage.frameLocator("#nur-universe-stage");

    await ownerBPage.goto("/notifications", { waitUntil: "load" });
    await expect(ownerBUniverse.locator("#nur-v197-adjunct-root")).not.toContainText(reminderTitle);
    await ownerBPage.goto("/universe/research", { waitUntil: "load" });
    await expect(ownerBUniverse.locator(".research-results")).not.toContainText(researchQuestion);
    await ownerBPage.goto("/universe/community", { waitUntil: "load" });
    await expect(ownerBUniverse.locator("#nur-v197-adjunct-root")).not.toContainText(roomTitle);
    await ownerBPage.goto("/settings", { waitUntil: "load" });
    const ownerBSettings = ownerBUniverse.locator("#nur-v197-adjunct-root");
    await expect(ownerBSettings.locator('[data-adjunct-control="locale"]')).toHaveValue("en");
    await expect(ownerBSettings.locator('[data-adjunct-control="writing-preference"]')).toHaveValue("default");
    await expect(ownerBSettings.locator('[data-adjunct-control="reduced-effects"]')).not.toBeChecked();
    await ownerBPage.goto("/billing", { waitUntil: "load" });
    await expect(ownerBUniverse.locator("#nur-v197-adjunct-root")).toContainText("Billing provider is disabled");

    const ownerB = await ownerSnapshot(ownerBPage, room.id);
    expect(ownerB.notifications.some(row => row.id === reminder.id || row.title === reminderTitle)).toBe(false);
    expect(ownerB.notificationPreferences.frequency).not.toBe("QUIET");
    expect(ownerB.researchBriefs.some(row => row.id === researchBrief.id || row.question === researchQuestion)).toBe(false);
    expect(ownerB.communityRooms.some(row => row.id === room.id || row.title === roomTitle)).toBe(false);
    expect(ownerB.profilePreferences).toMatchObject({
      locale: null,
      writing_preference: "default",
      reduced_effects: false,
    });
    expect(ownerB.billing).toMatchObject({
      subscription: null,
      provider_configured: false,
      portal_available: false,
    });
    expect(ownerB.roomStatus).toBe(404);

    await testInfo.attach("phase-h-owner-lifecycle.json", {
      body: Buffer.from(JSON.stringify({
        ownerA: {
          notificationId: reminder.id,
          researchBriefId: researchBrief.id,
          communityRoomId: room.id,
          roomStatus: ownerA.roomStatus,
          billingProviderConfigured: ownerA.billing.provider_configured,
        },
        ownerB: {
          notificationVisible: ownerB.notifications.some(row => row.id === reminder.id),
          researchBriefVisible: ownerB.researchBriefs.some(row => row.id === researchBrief.id),
          communityRoomVisible: ownerB.communityRooms.some(row => row.id === room.id),
          directRoomStatus: ownerB.roomStatus,
          billingProviderConfigured: ownerB.billing.provider_configured,
        },
      }, null, 2)),
      contentType: "application/json",
    });
    await attachViewport(ownerBPage, testInfo, "owner-b-isolated-state");
  } finally {
    await ownerBContext.close();
  }

  expect(serverErrors, `Unexpected 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
  expect(pageErrors, `Uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
});
