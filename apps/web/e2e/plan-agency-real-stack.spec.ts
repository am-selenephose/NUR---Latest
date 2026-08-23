import { expect, test } from "@playwright/test";

import { registerRealOwner } from "./helpers/realStack";

test("Talk preview becomes exactly one approved, worker-verified durable Plan", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The durable worker lifecycle runs once on desktop.");
  test.setTimeout(180_000);

  await registerRealOwner(page, "plan-agency");
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
    "Show me a plan for release candidate",
    "- Run readiness gates",
    "- Verify the exact commit",
  ].join("\n"));
  await universe.getByRole("button", { name: "Send to NUR" }).click();
  await expect(universe.locator("[data-f5-plan-preview]")).toContainText("Plan Preview: Release candidate");

  const beforeSave = await page.evaluate(async () => {
    const response = await fetch("/api/v1/agentic/workflows", { credentials: "include" });
    if (!response.ok) throw new Error(`workflow list failed: ${response.status}`);
    return response.json() as Promise<{ count: number }>;
  });
  expect(beforeSave.count).toBe(0);

  await universe.locator('[data-thread-action="plan"]').click();
  const reviewInAgency = universe.locator("[data-f5-agent-review]");
  await expect(reviewInAgency).toHaveText("Review in Agency");

  await expect.poll(async () => page.evaluate(async () => {
    const [workflowResponse, approvalResponse] = await Promise.all([
      fetch("/api/v1/agentic/workflows", { credentials: "include" }),
      fetch("/api/v1/agentic/approvals", { credentials: "include" }),
    ]);
    if (!workflowResponse.ok || !approvalResponse.ok) return { workflows: -1, approvals: -1 };
    const workflows = await workflowResponse.json() as { count: number };
    const approvals = await approvalResponse.json() as { count: number };
    return { workflows: workflows.count, approvals: approvals.count };
  }), { timeout: 30_000, intervals: [250, 500, 1_000] }).toEqual({ workflows: 1, approvals: 1 });

  await reviewInAgency.click();
  await expect(page).toHaveURL(/\/agents$/);
  const agencySurface = page.frameLocator("#nur-universe-stage").locator("#nur-v197-adjunct-root");
  const approval = agencySurface.locator("[data-agentic-approval-id]");
  await expect(approval).toHaveCount(1);
  await expect(approval.locator(".nur-adjunct-fact").filter({ hasText: "Risk" }))
    .toContainText("Creates a private draft you can discard.");
  await expect(approval.locator(".nur-adjunct-fact").filter({ hasText: "Cost" })).toContainText("No cost");
  await approval.locator('[data-adjunct-action^="agentic-approval-approve-"]').click();

  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch("/api/v1/plans", { credentials: "include" });
    if (!response.ok) return [] as Array<{ title: string; steps: Array<{ title: string }> }>;
    return response.json() as Promise<Array<{ title: string; steps: Array<{ title: string }> }>>;
  }), { timeout: 90_000, intervals: [500, 1_000, 2_000] }).toHaveLength(1);
  const plans = await page.evaluate(async () => {
    const response = await fetch("/api/v1/plans", { credentials: "include" });
    if (!response.ok) throw new Error(`plan list failed: ${response.status}`);
    return response.json() as Promise<Array<{ title: string; steps: Array<{ title: string }> }>>;
  });
  expect(plans).toHaveLength(1);
  expect(plans[0]?.title).toBe("Release candidate");
  expect(plans[0]?.steps.map(step => step.title)).toEqual([
    "Run readiness gates",
    "Verify the exact commit",
  ]);

  await page.goto("/plan", { waitUntil: "load" });
  const plan = page.frameLocator("#nur-universe-stage").locator("#page-plan");
  await expect(plan.locator(".panel-title").first()).toHaveText("Release candidate");
  await page.reload({ waitUntil: "load" });
  await expect(page.frameLocator("#nur-universe-stage").locator("#page-plan .panel-title").first())
    .toHaveText("Release candidate");
});
