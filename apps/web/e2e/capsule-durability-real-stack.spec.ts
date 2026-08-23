import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { registerRealOwner } from "./helpers/realStack";

const CYCLE_COUNT = 10;

type CapsuleView = {
  capsule_id: string;
  state: string;
  title: string;
  purpose: string;
  grant_id: string | null;
  included: Array<{
    source_id: string;
    source_kind: string;
    representation: string;
    title: string;
    body: string;
  }>;
  excluded_summary: Array<{ source_kind: string; count: number; note: string }>;
};

type CapsuleAuditEvent = {
  event_kind: string;
  actor_user_id: string | null;
  grant_id: string | null;
  meta: Record<string, unknown>;
};

type MintedCapsule = {
  capsuleId: string;
  grantId: string;
  decisionId: string;
  decisionTitle: string;
  decisionBody: string;
  withheldBody: string;
};

async function sessionIdentity(page: Page): Promise<{ id: string; orbitId: string }> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/auth/me", { credentials: "include" });
    if (!response.ok) throw new Error(`/auth/me -> ${response.status}: ${await response.text()}`);
    const session = await response.json() as {
      id: string;
      orbit?: { id?: string };
      profile?: { active_orbit_id?: string | null };
    };
    const orbitId = session.orbit?.id ?? session.profile?.active_orbit_id;
    if (!orbitId) throw new Error("The real owner session has no active Orbit.");
    return { id: session.id, orbitId };
  });
}

async function mintSharedCapsule(
  page: Page,
  orbitId: string,
  recipientEmail: string,
  nonce: string,
): Promise<MintedCapsule> {
  return page.evaluate(async ({ orbitId, recipientEmail, nonce }) => {
    const csrf = decodeURIComponent(
      document.cookie.split("; ").find(row => row.startsWith("nur_csrf="))?.split("=")[1] ?? "",
    );
    if (!csrf) throw new Error("The real owner session has no CSRF cookie.");

    const call = async (path: string, body: Record<string, unknown>) => {
      const response = await fetch(`/api/v1${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`${path} -> ${response.status}: ${await response.text()}`);
      return response.json() as Promise<Record<string, unknown>>;
    };

    const decisionTitle = `Capsule ${nonce} keeps its approved decision durable.`;
    const decisionBody = `Approved rationale ${nonce} survives every real-stack reload.`;
    const withheldBody = `withheld-${nonce}-must-never-cross-the-capsule-boundary`;
    const decision = await call(`/orbits/${orbitId}/decisions`, {
      statement: decisionTitle,
      rationale: decisionBody,
    });
    const reference = await call(`/orbits/${orbitId}/references`, {
      title: `Withheld reference ${nonce}`,
      body: withheldBody,
      kind: "REFERENCE",
    });
    const decisionSource = await call(`/orbits/${orbitId}/sources`, {
      source_kind: "DECISION",
      source_id: decision.id,
    });
    await call(`/orbits/${orbitId}/sources`, {
      source_kind: "REFERENCE",
      source_id: reference.id,
    });
    const capsule = await call(`/orbits/${orbitId}/capsules`, {
      title: `Durability capsule ${nonce}`,
      purpose: `Prove create, share, redeem, reload and isolation for ${nonce}.`,
      capability: "ASK_SCOPED_QUESTIONS",
      orbit_source_ids: [decisionSource.id],
      representations: { [String(decisionSource.id)]: "FULL" },
    });
    const grant = await call(`/capsules/${capsule.id}/grants`, {
      recipient_email: recipientEmail,
      capability: "ASK_SCOPED_QUESTIONS",
    });

    return {
      capsuleId: String(capsule.id),
      grantId: String(grant.id),
      decisionId: String(decision.id),
      decisionTitle,
      decisionBody,
      withheldBody,
    };
  }, { orbitId, recipientEmail, nonce });
}

async function ownerAudit(page: Page, capsuleId: string): Promise<CapsuleAuditEvent[]> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/v1/capsules/${encodeURIComponent(id)}/audit`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error(`/capsules/${id}/audit -> ${response.status}: ${await response.text()}`);
    return response.json() as Promise<CapsuleAuditEvent[]>;
  }, capsuleId);
}

async function ownedCapsuleIds(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/capsules", { credentials: "include" });
    if (!response.ok) throw new Error(`/capsules -> ${response.status}: ${await response.text()}`);
    const capsules = await response.json() as Array<{ id: string }>;
    return capsules.map(capsule => capsule.id);
  });
}

test("ten real-stack Capsule cycles survive redemption and reload without crossing owners", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The ten-cycle durability proof runs once on desktop.");
  test.setTimeout(300_000);

  const baseURL = process.env.NUR_REAL_STACK_BASE_URL?.trim();
  if (!baseURL) throw new Error("NUR_REAL_STACK_BASE_URL is required for the Capsule durability proof.");

  const recipientContext: BrowserContext = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 720 },
    serviceWorkers: "block",
  });
  const strangerContext: BrowserContext = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 720 },
    serviceWorkers: "block",
  });
  const recipientPage = await recipientContext.newPage();
  const strangerPage = await strangerContext.newPage();

  try {
    await registerRealOwner(page, "capsule-durability-owner");
    const recipientEmail = await registerRealOwner(recipientPage, "capsule-durability-recipient");
    await registerRealOwner(strangerPage, "capsule-durability-stranger");
    const owner = await sessionIdentity(page);
    const recipient = await sessionIdentity(recipientPage);
    const mintedCapsules: MintedCapsule[] = [];
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    for (let cycle = 1; cycle <= CYCLE_COUNT; cycle += 1) {
      const minted = await mintSharedCapsule(
        page,
        owner.orbitId,
        recipientEmail,
        `${stamp}-cycle-${cycle}`,
      );
      mintedCapsules.push(minted);

      const firstViewResponse = recipientPage.waitForResponse(response => (
        response.url().includes(`/api/v1/capsules/${minted.capsuleId}/view`)
        && response.request().method() === "GET"
      ));
      await recipientPage.goto(`/capsule/${minted.capsuleId}`, { waitUntil: "load" });
      const firstView = await firstViewResponse;
      expect(firstView.status(), `cycle ${cycle} recipient redemption status`).toBe(200);
      const redeemed = await firstView.json() as CapsuleView;
      expect(redeemed.state, `cycle ${cycle} state at redemption`).toBe("ACTIVE");
      expect(redeemed.grant_id, `cycle ${cycle} claimed grant`).toBe(minted.grantId);
      expect(redeemed.included, `cycle ${cycle} approved allowlist`).toEqual([expect.objectContaining({
        source_id: minted.decisionId,
        source_kind: "DECISION",
        representation: "FULL",
        title: minted.decisionTitle,
        body: minted.decisionBody,
      })]);
      expect(redeemed.excluded_summary, `cycle ${cycle} withheld source ledger`)
        .toContainEqual(expect.objectContaining({ source_kind: "REFERENCE" }));
      expect(JSON.stringify(redeemed), `cycle ${cycle} withheld body isolation`)
        .not.toContain(minted.withheldBody);

      const recipientRoom = recipientPage.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root");
      await expect(recipientRoom, `cycle ${cycle} recipient UI`).toContainText("ACTIVE");
      await expect(recipientRoom).toContainText(minted.decisionTitle);
      await expect(recipientRoom).toContainText(minted.decisionBody);
      await expect(recipientRoom).not.toContainText(minted.withheldBody);

      const reloadResponse = recipientPage.waitForResponse(response => (
        response.url().includes(`/api/v1/capsules/${minted.capsuleId}/view`)
        && response.request().method() === "GET"
      ));
      await recipientPage.reload({ waitUntil: "load" });
      const reloaded = await reloadResponse;
      expect(reloaded.status(), `cycle ${cycle} durable reload status`).toBe(200);
      const reloadedView = await reloaded.json() as CapsuleView;
      expect(reloadedView.capsule_id).toBe(minted.capsuleId);
      expect(reloadedView.grant_id).toBe(minted.grantId);
      expect(reloadedView.included).toHaveLength(1);
      expect(reloadedView.included[0]?.body).toBe(minted.decisionBody);
      await expect(recipientPage.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root"))
        .toContainText(minted.decisionBody);

      const deniedViewResponse = strangerPage.waitForResponse(response => (
        response.url().includes(`/api/v1/capsules/${minted.capsuleId}/view`)
        && response.request().method() === "GET"
      ));
      await strangerPage.goto(`/capsule/${minted.capsuleId}`, { waitUntil: "load" });
      const denied = await deniedViewResponse;
      expect(denied.status(), `cycle ${cycle} ungranted owner isolation status`).toBe(404);
      const strangerRoom = strangerPage.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root");
      await expect(strangerRoom, `cycle ${cycle} bounded stranger UI`).toContainText("No active grant");
      await expect(strangerRoom).not.toContainText(minted.decisionTitle);
      await expect(strangerRoom).not.toContainText(minted.decisionBody);
      await expect(strangerRoom).not.toContainText(minted.withheldBody);

      const audit = await ownerAudit(page, minted.capsuleId);
      expect(audit.some(event => event.grant_id === minted.grantId && event.meta.granted === true),
        `cycle ${cycle} persisted grant audit`).toBe(true);
      expect(audit.filter(event => (
        event.event_kind === "VIEWED"
        && event.grant_id === minted.grantId
        && event.actor_user_id === recipient.id
      )).length, `cycle ${cycle} redemption and reload audit`).toBeGreaterThanOrEqual(2);
    }

    const expectedCapsuleIds = mintedCapsules.map(capsule => capsule.capsuleId).sort();
    expect((await ownedCapsuleIds(page)).sort()).toEqual(expectedCapsuleIds);
    expect(await ownedCapsuleIds(recipientPage)).toEqual([]);
    expect(await ownedCapsuleIds(strangerPage)).toEqual([]);

    const first = mintedCapsules[0];
    if (!first) throw new Error("The ten-cycle proof did not mint its first Capsule.");
    await recipientPage.goto(`/capsule/${first.capsuleId}`, { waitUntil: "load" });
    await expect(recipientPage.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root"))
      .toContainText(first.decisionTitle);
  } finally {
    await recipientContext.close();
    await strangerContext.close();
  }
});
