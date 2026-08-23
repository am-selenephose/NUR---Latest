import { expect, test, type Locator, type Page } from "@playwright/test";

import { registerRealOwner } from "./helpers/realStack";

type Approval = {
  id: string;
  workflow_id: string;
  redacted_arguments: Record<string, unknown>;
  argument_digest: string;
  plan_version: number;
  call_version: string;
};

type Plan = {
  title: string;
  steps: Array<{ title: string }>;
};

async function createPendingPlanApproval(
  page: Page,
  proof: string,
  requestedTitle: string,
  expectedTitle: string,
): Promise<{ approval: Approval; card: Locator }> {
  await registerRealOwner(page, proof);
  await page.goto("/agents", { waitUntil: "load" });
  const agency = page.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root");
  await expect(agency.locator("h1")).toHaveText("Agency under your authority.");
  await agency.locator('[data-adjunct-control="agentic-initiative"]').selectOption("SUGGEST");
  await agency.locator('[data-adjunct-control="agentic-max-risk"]').selectOption("R1_PRIVATE_DRAFT");
  await agency.locator('[data-agentic-permit="create_draft_plan"]').check();
  await agency.locator('[data-adjunct-action="agentic-policy-save"]').click();
  await expect(agency.getByText("Owner policy persisted. No workflow was started.")).toBeVisible();

  await page.goto("/talk", { waitUntil: "load" });
  const universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#page-talk")).toBeVisible();
  await universe.locator("#talk-input").fill([
    `Show me a plan for ${requestedTitle}`,
    "- Run the edited readiness gate",
    "- Verify the edited exact commit",
  ].join("\n"));
  await universe.getByRole("button", { name: "Send to NUR" }).click();
  await expect(universe.locator("[data-f5-plan-preview]")).toContainText(`Plan Preview: ${expectedTitle}`);
  await universe.locator('[data-thread-action="plan"]').click();

  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch("/api/v1/agentic/approvals", { credentials: "include" });
    if (!response.ok) return 0;
    return ((await response.json()) as { count: number }).count;
  }), { timeout: 30_000, intervals: [250, 500, 1_000] }).toBe(1);
  const approval = await page.evaluate(async () => {
    const response = await fetch("/api/v1/agentic/approvals", { credentials: "include" });
    if (!response.ok) throw new Error(`Approval list failed: ${response.status}`);
    const body = await response.json() as { approvals: Approval[] };
    if (body.approvals.length !== 1) throw new Error(`Expected one approval, got ${body.approvals.length}`);
    return body.approvals[0];
  });

  await universe.locator("[data-f5-agent-review]").click();
  await expect(page).toHaveURL(/\/agents$/);
  const approvalSurface = page.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root");
  const card = approvalSurface.locator(`[data-agentic-approval-id="${approval.id}"]`);
  await expect(card).toHaveCount(1);
  return { approval, card };
}

async function plans(page: Page): Promise<Plan[]> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/plans", { credentials: "include" });
    if (!response.ok) throw new Error(`Plan list failed: ${response.status}`);
    return response.json() as Promise<Plan[]>;
  });
}

test("Agency EDIT invalidates the displayed binding and executes only edited arguments", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The real worker approval lifecycle runs once on desktop.");
  test.setTimeout(180_000);

  const { approval, card } = await createPendingPlanApproval(
    page,
    "agency-edit",
    "edit binding candidate",
    "Edit binding candidate",
  );
  const editedArguments = {
    ...approval.redacted_arguments,
    title: "Edited binding candidate",
    steps: ["Run the edited readiness gate", "Verify the edited exact commit"],
  };

  await card.locator(`[data-adjunct-action="agentic-approval-edit-${approval.id}"]`).click();
  const editor = card.getByLabel("Edit the owner-visible approval arguments as JSON");
  await expect(editor).toBeVisible();
  await editor.fill(JSON.stringify(editedArguments, null, 2));
  const decisionResponsePromise = page.waitForResponse(response => (
    response.url().includes(`/api/v1/agentic/approvals/${approval.id}/decide`)
    && response.request().method() === "POST"
  ));
  await card.locator(`[data-adjunct-action="agentic-approval-submit-edit-${approval.id}"]`).click();
  const decisionResponse = await decisionResponsePromise;
  expect(decisionResponse.status()).toBe(200);
  expect(await decisionResponse.json()).toMatchObject({
    approval_id: approval.id,
    decision: "EDIT",
    step_state: "QUEUED",
  });

  const staleReplay = await page.evaluate(async ({ current, id }) => {
    const csrf = document.cookie
      .split(";")
      .map(value => value.trim())
      .find(value => value.startsWith("nur_csrf="))
      ?.slice("nur_csrf=".length);
    if (!csrf) throw new Error("Missing CSRF cookie for stale approval replay.");
    const response = await fetch(`/api/v1/agentic/approvals/${encodeURIComponent(id)}/decide`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "X-CSRF-Token": decodeURIComponent(csrf),
      },
      body: JSON.stringify({
        decision: "APPROVE",
        seen_digest: current.argument_digest,
        seen_plan_version: current.plan_version,
        seen_call_version: current.call_version,
        note: null,
        edited_arguments: null,
      }),
    });
    return { status: response.status, body: await response.text() };
  }, { current: approval, id: approval.id });
  expect(staleReplay.status).toBe(409);

  await expect.poll(async () => (await plans(page)).length, {
    timeout: 90_000,
    intervals: [500, 1_000, 2_000],
  }).toBe(1);
  const editedPlans = await plans(page);
  expect(editedPlans).toHaveLength(1);
  expect(editedPlans[0]).toMatchObject({
    title: "Edited binding candidate",
    steps: [
      { title: "Run the edited readiness gate" },
      { title: "Verify the edited exact commit" },
    ],
  });
  const workflow = await page.evaluate(async id => {
    const response = await fetch(`/api/v1/agentic/workflows/${encodeURIComponent(id)}`, { credentials: "include" });
    if (!response.ok) throw new Error(`Workflow detail failed: ${response.status}`);
    return response.json() as Promise<{ state: string }>;
  }, approval.workflow_id);
  expect(workflow.state).toBe("SUCCEEDED");
  const events = await page.evaluate(async id => {
    const response = await fetch(`/api/v1/agentic/workflows/${encodeURIComponent(id)}/events`, { credentials: "include" });
    if (!response.ok) throw new Error(`Workflow events failed: ${response.status}`);
    return response.json() as Promise<{ events: Array<{ event_type: string }> }>;
  }, approval.workflow_id);
  expect(events.events.map(row => row.event_type)).toContain("APPROVAL_EDITED");

  await page.goto("/plan", { waitUntil: "load" });
  await expect(page.frameLocator("#nur-universe-stage").locator("#page-plan .panel-title").first())
    .toHaveText("Edited binding candidate");
  await page.reload({ waitUntil: "load" });
  await expect(page.frameLocator("#nur-universe-stage").locator("#page-plan .panel-title").first())
    .toHaveText("Edited binding candidate");
});

test("Agency REJECT is terminal and produces no dispatch or tool effect", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The real worker approval lifecycle runs once on desktop.");
  test.setTimeout(180_000);

  const { approval, card } = await createPendingPlanApproval(
    page,
    "agency-reject",
    "rejected binding candidate",
    "Rejected binding candidate",
  );
  const decisionResponsePromise = page.waitForResponse(response => (
    response.url().includes(`/api/v1/agentic/approvals/${approval.id}/decide`)
    && response.request().method() === "POST"
  ));
  await card.locator(`[data-adjunct-action="agentic-approval-reject-${approval.id}"]`).click();
  const decisionResponse = await decisionResponsePromise;
  expect(decisionResponse.status()).toBe(200);
  expect(await decisionResponse.json()).toMatchObject({
    approval_id: approval.id,
    decision: "REJECT",
    step_state: "CANCELLED",
    workflow_state: "CANCELLED",
    outbox_intent_id: null,
  });

  const workflow = await page.evaluate(async id => {
    const response = await fetch(`/api/v1/agentic/workflows/${encodeURIComponent(id)}`, { credentials: "include" });
    if (!response.ok) throw new Error(`Workflow detail failed: ${response.status}`);
    return response.json() as Promise<{ state: string; steps: Array<{ state: string }> }>;
  }, approval.workflow_id);
  expect(workflow.state).toBe("CANCELLED");
  expect(workflow.steps.map(step => step.state)).toEqual(["CANCELLED"]);
  expect(await plans(page)).toEqual([]);

  const events = await page.evaluate(async id => {
    const response = await fetch(`/api/v1/agentic/workflows/${encodeURIComponent(id)}/events`, { credentials: "include" });
    if (!response.ok) throw new Error(`Workflow events failed: ${response.status}`);
    return response.json() as Promise<{ events: Array<{ event_type: string }> }>;
  }, approval.workflow_id);
  const eventTypes = events.events.map(row => row.event_type);
  expect(eventTypes).toContain("APPROVAL_REJECTED");
  expect(eventTypes.some(value => /(DISPATCHED|EXECUTED|SUCCEEDED|TOOL_CALL)/.test(value))).toBe(false);

  await page.goto(`/agents/${approval.workflow_id}`, { waitUntil: "load" });
  const agency = page.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root");
  await expect(agency.getByText("CANCELLED", { exact: true }).first()).toBeVisible();
  await page.reload({ waitUntil: "load" });
  await expect(
    page.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root").getByText("CANCELLED", { exact: true }).first(),
  ).toBeVisible();
  expect(await plans(page)).toEqual([]);
});
