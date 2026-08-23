import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { registerRealOwner } from "./helpers/realStack";

type ApiResult<T> = {
  status: number;
  body: T;
};

type Identified = {
  id: string;
};

type PlanRecord = Identified & {
  title: string;
  steps: Array<Identified & { title: string; done: boolean }>;
};

type InsightRecord = Identified & {
  title: string;
  claim: string;
  status: string;
};

type ProjectRecord = Identified & {
  title: string;
  objective: string;
};

type MemoryRecord = Identified & {
  canonical_text: string;
};

type OrbitField = {
  people: Array<Identified & { display_name: string }>;
  groups: Array<Identified & { name: string }>;
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

async function apiRead<T>(page: Page, path: string): Promise<ApiResult<T>> {
  return page.evaluate(async target => {
    const response = await fetch(target, { credentials: "include" });
    const body = await response.json() as T;
    return { status: response.status, body };
  }, path);
}

async function apiWrite<T>(
  page: Page,
  path: string,
  method: "POST" | "PATCH",
  payload: Record<string, unknown> = {},
): Promise<ApiResult<T>> {
  return page.evaluate(async ({ target, writeMethod, body }) => {
    const csrf = document.cookie
      .split(";")
      .map(part => part.trim())
      .find(part => part.startsWith("nur_csrf="))
      ?.slice("nur_csrf=".length);
    if (!csrf) throw new Error("The real owner session is missing its CSRF cookie.");
    const response = await fetch(target, {
      method: writeMethod,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": decodeURIComponent(csrf),
      },
      body: JSON.stringify(body),
    });
    const responseBody = await response.json() as T;
    return { status: response.status, body: responseBody };
  }, { target: path, writeMethod: method, body: payload });
}

async function expectSuccessfulResponse(response: Promise<import("@playwright/test").Response>): Promise<void> {
  const resolved = await response;
  expect(resolved.status(), `${resolved.request().method()} ${resolved.url()} should succeed`).toBeLessThan(400);
}

test("core NUR lifecycle persists across canonical surfaces and remains owner isolated", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The two-owner core lifecycle runs once on desktop.");
  test.setTimeout(420_000);

  const serverErrors: string[] = [];
  const pageErrors: string[] = [];
  watchRuntime(page, "owner-a", serverErrors, pageErrors);

  await registerRealOwner(page, "core-lifecycle-a");
  const universe = page.frameLocator("#nur-universe-stage");
  const stamp = Date.now();

  await page.goto("/today", { waitUntil: "load" });
  await expect(universe.locator("#page-today")).toHaveClass(/active/);
  await universe.locator('[data-action="checkin"]').click();
  await expect(universe.locator("#nur-v197-today-checkin")).toBeVisible();
  await universe.locator("#nur-checkin-energy").fill("8");
  await universe.locator("#nur-checkin-pain").fill("2");
  await universe.locator("#nur-checkin-sleep").fill("7");
  await universe.locator("#nur-checkin-nourishment").fill("8");
  await universe.locator("#nur-checkin-movement").fill("6");
  await universe.locator("#nur-checkin-load").fill("4");
  await universe.locator("#nur-checkin-clarity").fill("9");
  await universe.locator("#nur-checkin-note").fill(`Core lifecycle check-in ${stamp}`);
  const checkInSaved = page.waitForResponse(response => (
    response.url().includes("/api/v1/today/check-in") && response.request().method() === "POST"
  ));
  await universe.locator('[data-action="save-today-checkin"]').click();
  await expectSuccessfulResponse(checkInSaved);
  await expect(universe.locator("#nur-v197-today-checkin")).toBeHidden();
  await reloadAuthenticated(page);
  const today = await apiRead<{
    body: { sources: { today_checkin: unknown } };
    mind: { sources: { today_checkin: unknown } };
  }>(page, "/api/v1/today");
  expect(today.status).toBe(200);
  expect(today.body.body.sources.today_checkin).not.toBeNull();
  expect(today.body.mind.sources.today_checkin).not.toBeNull();

  const journalLine = `A durable canonical journal line ${stamp}`;
  await page.goto("/journal", { waitUntil: "load" });
  await universe.locator("#journal-input").fill(journalLine);
  const journalSaved = page.waitForResponse(response => (
    response.url().endsWith("/api/v1/journal") && response.request().method() === "POST"
  ));
  await universe.locator("#journal-save").click();
  await expectSuccessfulResponse(journalSaved);
  await expect(universe.locator("#page-journal .journal-prompt")).toContainText(journalLine);
  await reloadAuthenticated(page);
  await expect(universe.locator("#page-journal .journal-prompt")).toContainText(journalLine);

  await page.goto("/systems", { waitUntil: "load" });
  const systems = universe.locator(".universe-system-node[data-orbit-id]:visible");
  await expect(systems.first()).toBeVisible();
  expect(await systems.count()).toBeGreaterThanOrEqual(2);
  const activeSystem = systems.nth(1);
  const activeOrbitId = await activeSystem.getAttribute("data-orbit-id");
  if (!activeOrbitId) throw new Error("The canonical Systems surface did not expose an owner Orbit id.");
  const preferenceSaved = page.waitForResponse(response => (
    response.url().includes("/api/v1/profile/preferences") && response.request().method() === "PATCH"
  ));
  await activeSystem.click();
  await expectSuccessfulResponse(preferenceSaved);
  await expect(activeSystem).toHaveAttribute("aria-pressed", "true");
  await reloadAuthenticated(page);
  await expect(universe.locator(`.universe-system-node[data-orbit-id="${activeOrbitId}"]`)).toHaveAttribute("aria-pressed", "true");

  const planTitle = `Core lifecycle plan ${stamp}`;
  const stepTitle = `Return the integrated proof ${stamp}`;
  const createdPlan = await apiWrite<PlanRecord>(page, "/api/v1/plans", "POST", {
    title: planTitle,
    orbit_id: activeOrbitId,
    steps: [{ title: stepTitle, position: 0 }],
  });
  expect(createdPlan.status).toBe(201);
  const plan = createdPlan.body;
  const step = plan.steps[0];
  if (!step) throw new Error("The persisted Plan did not return its first step.");

  await page.goto("/plan", { waitUntil: "load" });
  await expect(universe.locator("#page-plan")).toHaveClass(/active/);
  await expect(universe.locator("#page-plan")).toContainText(planTitle);
  const stepCompleted = page.waitForResponse(response => (
    response.url().includes(`/api/v1/plan-steps/${step.id}`) && response.request().method() === "PATCH"
  ));
  await universe.locator(`.plan-check[data-plan-step-id="${step.id}"]`).click();
  await expectSuccessfulResponse(stepCompleted);
  await expect(universe.locator("#nur-outcome-composer")).toBeVisible();
  const outcomeLine = `The full owner lifecycle returned evidence ${stamp}`;
  await universe.locator("#nur-outcome-input").fill(outcomeLine);
  const outcomeSaved = page.waitForResponse(response => (
    response.url().endsWith("/api/v1/outcomes") && response.request().method() === "POST"
  ));
  await universe.locator('[data-action="return-outcome"]').click();
  const outcomeResponse = await outcomeSaved;
  expect(outcomeResponse.status()).toBe(201);
  const outcome = await outcomeResponse.json() as Identified;
  await reloadAuthenticated(page);
  const persistedPlans = await apiRead<PlanRecord[]>(page, "/api/v1/plans");
  expect(persistedPlans.body).toContainEqual(expect.objectContaining({ id: plan.id, title: planTitle }));

  const personName = `Core Person ${stamp}`;
  const groupName = `Core Circle ${stamp}`;
  await page.goto("/universe/orbits", { waitUntil: "load" });
  const orbitRoot = universe.locator("#nur-orbit-root");
  await expect(orbitRoot).toBeVisible();
  const addPerson = orbitRoot.getByRole("button", { name: /Add (?:first )?person/i });
  await expect(addPerson).toBeVisible();
  page.once("dialog", dialog => void dialog.accept(personName));
  const personSaved = page.waitForResponse(response => (
    response.url().includes("/api/v1/orbits/people") && response.request().method() === "POST"
  ));
  await addPerson.click();
  const personResponse = await personSaved;
  expect(personResponse.status()).toBe(201);
  const person = await personResponse.json() as Identified;
  const createGroup = orbitRoot.getByRole("button", { name: /Create (?:a )?group/i });
  await expect(createGroup).toBeVisible();
  page.once("dialog", dialog => void dialog.accept(groupName));
  const groupSaved = page.waitForResponse(response => (
    response.url().includes("/api/v1/orbit-groups") && response.request().method() === "POST"
  ));
  await createGroup.click();
  const groupResponse = await groupSaved;
  expect(groupResponse.status()).toBe(201);
  const group = await groupResponse.json() as Identified;
  await reloadAuthenticated(page);
  await expect(orbitRoot).toContainText(personName);
  const ownerOrbit = await apiRead<OrbitField>(page, "/api/v1/orbit-field");
  expect(ownerOrbit.body.people).toContainEqual(expect.objectContaining({ id: person.id, display_name: personName }));
  expect(ownerOrbit.body.groups).toContainEqual(expect.objectContaining({ id: group.id, name: groupName }));

  await page.goto("/universe/map", { waitUntil: "load" });
  const mapRoot = universe.locator("#nur-map-root");
  await expect(mapRoot).toBeVisible();
  await expect(mapRoot).toHaveAttribute("data-map-loaded", "true", { timeout: 20_000 });
  const mapGenerated = page.waitForResponse(response => (
    response.url().includes("/api/v1/map/suggestions/generate") && response.request().method() === "POST"
  ));
  await mapRoot.getByRole("button", { name: "Ask NUR to Map" }).click();
  await expectSuccessfulResponse(mapGenerated);
  await expect(mapRoot.locator(".nur-map-node").first()).toBeVisible();

  await page.goto("/universe/timeline", { waitUntil: "load" });
  const timelineRoot = universe.locator("#nur-timeline-root");
  await expect(timelineRoot).toBeVisible();
  await expect(timelineRoot).toHaveAttribute("data-timeline-loaded", "true", { timeout: 20_000 });
  await expect(timelineRoot).toContainText(outcomeLine);

  await page.goto("/universe/insights/candidates", { waitUntil: "load" });
  let adjunct = universe.locator("#nur-v197-adjunct-root");
  await expect(adjunct).toContainText("Candidate insight, never silent truth");
  const insightGenerated = page.waitForResponse(response => (
    response.url().includes("/api/v1/insights/generate") && response.request().method() === "POST"
  ));
  await adjunct.locator('[data-adjunct-action="candidate-generate"]').click();
  const insightResponse = await insightGenerated;
  expect(insightResponse.status()).toBe(201);
  const insight = await insightResponse.json() as InsightRecord;
  adjunct = universe.locator("#nur-v197-adjunct-root");
  await expect(adjunct).toContainText(insight.title);
  const correction = `Owner-corrected interpretation ${stamp}`;
  await adjunct.getByPlaceholder("Correct the candidate without erasing its original record").fill(correction);
  const insightCorrected = page.waitForResponse(response => (
    response.url().includes(`/api/v1/insights/${insight.id}/correct`) && response.request().method() === "POST"
  ));
  await adjunct.locator(`[data-adjunct-action="candidate-correct-${insight.id}"]`).click();
  await expectSuccessfulResponse(insightCorrected);
  adjunct = universe.locator("#nur-v197-adjunct-root");
  const insightAccepted = page.waitForResponse(response => (
    response.url().includes(`/api/v1/insights/${insight.id}/accept`) && response.request().method() === "POST"
  ));
  await adjunct.locator(`[data-adjunct-action="candidate-accept-${insight.id}"]`).click();
  await expectSuccessfulResponse(insightAccepted);
  adjunct = universe.locator("#nur-v197-adjunct-root");
  const memoryProposed = page.waitForResponse(response => (
    response.url().includes(`/api/v1/insights/${insight.id}/save-to-memory`) && response.request().method() === "POST"
  ));
  await adjunct.locator(`[data-adjunct-action="candidate-memory-${insight.id}"]`).click();
  const memoryCandidateResponse = await memoryProposed;
  expect(memoryCandidateResponse.status()).toBe(200);
  const memoryCandidate = await memoryCandidateResponse.json() as Identified;

  await page.goto("/memory", { waitUntil: "load" });
  adjunct = universe.locator("#nur-v197-adjunct-root");
  await expect(adjunct).toContainText(insight.claim);
  const memoryApproved = page.waitForResponse(response => (
    response.url().includes(`/api/v1/memory-candidates/${memoryCandidate.id}/approve`) && response.request().method() === "POST"
  ));
  await adjunct.locator(`[data-adjunct-action="memory-candidate-approve-${memoryCandidate.id}"]`).click();
  const memoryResponse = await memoryApproved;
  expect(memoryResponse.status()).toBe(200);
  const acceptedMemory = await memoryResponse.json() as MemoryRecord;
  adjunct = universe.locator("#nur-v197-adjunct-root");
  await expect(adjunct).toContainText(acceptedMemory.canonical_text);

  const ownerMemoryText = `Owner-authored memory ${stamp}`;
  await adjunct.locator('[data-adjunct-control="memory-create-text"]').fill(ownerMemoryText);
  const ownerMemorySaved = page.waitForResponse(response => (
    response.url().endsWith("/api/v1/memories") && response.request().method() === "POST"
  ));
  await adjunct.locator('[data-adjunct-action="memory-create"]').click();
  const ownerMemoryResponse = await ownerMemorySaved;
  expect(ownerMemoryResponse.status()).toBe(201);
  const ownerMemory = await ownerMemoryResponse.json() as MemoryRecord;
  await reloadAuthenticated(page);
  await expect(universe.locator("#nur-v197-adjunct-root")).toContainText(ownerMemoryText);

  const projectTitle = `Integrated Project Orbit ${stamp}`;
  const projectObjective = `Prove owner-scoped files, evidence, reviews and bounded runs ${stamp}`;
  await page.goto("/projects", { waitUntil: "load" });
  adjunct = universe.locator("#nur-v197-adjunct-root");
  await adjunct.getByPlaceholder("Project title").fill(projectTitle);
  await adjunct.getByPlaceholder("Objective and success definition…").fill(projectObjective);
  const projectCreated = page.waitForResponse(response => (
    response.url().endsWith("/api/v1/projects") && response.request().method() === "POST"
  ));
  await adjunct.locator('[data-adjunct-action="project-create"]').click();
  const projectResponse = await projectCreated;
  expect(projectResponse.status()).toBe(201);
  const project = await projectResponse.json() as ProjectRecord;
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/overview$`));

  const taskTitle = `Run integrated lifecycle proof ${stamp}`;
  const taskCriteria = "The exact owner state reloads and remains isolated.";
  adjunct = universe.locator("#nur-v197-adjunct-root");
  await adjunct.getByPlaceholder("One concrete task").fill(taskTitle);
  await adjunct.getByPlaceholder("Acceptance criteria").fill(taskCriteria);
  const taskCreated = page.waitForResponse(response => (
    response.url().includes(`/api/v1/projects/${project.id}/tasks`) && response.request().method() === "POST"
  ));
  await adjunct.locator('[data-adjunct-action="project-task-create"]').click();
  const taskResponse = await taskCreated;
  expect(taskResponse.status()).toBe(201);
  const task = await taskResponse.json() as Identified;

  adjunct = universe.locator("#nur-v197-adjunct-root");
  const evidencePanel = adjunct.locator(".nur-adjunct-panel").filter({ hasText: "Evidence gate" });
  await evidencePanel.locator("select").selectOption(task.id);
  await evidencePanel.getByPlaceholder("What was verified?").fill(`Real-stack lifecycle passed ${stamp}`);
  await evidencePanel.getByPlaceholder("Evidence locator/path/URL").fill(`proof/core-lifecycle-${stamp}.json`);
  const evidenceCreated = page.waitForResponse(response => (
    response.url().includes(`/api/v1/projects/${project.id}/evidence`) && response.request().method() === "POST"
  ));
  await evidencePanel.locator('[data-adjunct-action="project-evidence-create"]').click();
  await expectSuccessfulResponse(evidenceCreated);

  adjunct = universe.locator("#nur-v197-adjunct-root");
  const taskClosed = page.waitForResponse(response => (
    response.url().includes(`/api/v1/projects/tasks/${task.id}`) && response.request().method() === "PATCH"
  ));
  await adjunct.locator(`[data-adjunct-action="project-task-done-${task.id}"]`).click();
  await expectSuccessfulResponse(taskClosed);

  // The task mutation refreshes the whole project adjunct after the response.
  // Wait for that canonical refresh before attaching bytes to its new file input.
  await expect(
    universe.locator(`[data-adjunct-action="project-task-done-${task.id}"]`),
  ).toHaveCount(0);

  adjunct = universe.locator("#nur-v197-adjunct-root");
  await adjunct.locator('[data-adjunct-control="project-file-input"]').setInputFiles({
    name: `core-lifecycle-${stamp}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(`NUR core lifecycle evidence ${stamp}\n`),
  });
  const fileUploaded = page.waitForResponse(response => (
    response.url().includes(`/api/v1/projects/${project.id}/files`) && response.request().method() === "POST"
  ));
  await adjunct.locator('[data-adjunct-action="project-file-upload"]').click();
  const fileResponse = await fileUploaded;
  expect(fileResponse.status()).toBe(201);
  const projectFile = await fileResponse.json() as Identified;

  const uploadedFilename = `core-lifecycle-${stamp}.txt`;
  await expect(
    universe.locator('[data-adjunct-list="project-files"]'),
  ).toContainText(uploadedFilename);

  adjunct = universe.locator("#nur-v197-adjunct-root");
  const runRequest = `Verify the bounded owner package ${stamp}`;
  await adjunct.getByPlaceholder(/Propose a scoped task/).fill(runRequest);
  const runProposed = page.waitForResponse(response => (
    response.url().includes(`/api/v1/projects/${project.id}/runs`) && response.request().method() === "POST"
  ));
  await adjunct.locator('[data-adjunct-action="project-run-propose"]').click();
  const runResponse = await runProposed;
  expect(runResponse.status()).toBe(201);
  const run = await runResponse.json() as Identified;
  adjunct = universe.locator("#nur-v197-adjunct-root");
  const runApproved = page.waitForResponse(response => (
    response.url().includes(`/api/v1/projects/runs/${run.id}/approve`) && response.request().method() === "POST"
  ));
  await adjunct.locator(`[data-adjunct-action="project-run-approve-${run.id}"]`).click();
  await expectSuccessfulResponse(runApproved);
  await expect(
    universe.locator(`[data-adjunct-action="project-run-approve-${run.id}"]`),
  ).toHaveCount(0);

  adjunct = universe.locator("#nur-v197-adjunct-root");
  const reviewNote = `Founder authority preserved in integrated proof ${stamp}`;
  await adjunct.getByPlaceholder("Why is this accepted, rejected or corrected?").fill(reviewNote);
  const reviewCreated = page.waitForResponse(response => (
    response.url().includes(`/api/v1/projects/${project.id}/reviews`) && response.request().method() === "POST"
  ));
  await adjunct.locator('[data-adjunct-action="project-review-create"]').click();
  await expectSuccessfulResponse(reviewCreated);
  await reloadAuthenticated(page);
  adjunct = universe.locator("#nur-v197-adjunct-root");
  await expect(adjunct).toContainText(projectTitle);
  await expect(adjunct).toContainText(taskTitle);
  await expect(adjunct).toContainText(reviewNote);
  await expect(adjunct).toContainText(uploadedFilename);
  await attachViewport(page, testInfo, "core-lifecycle-owner-a-project");

  const ownerA = {
    journal: await apiRead<Array<Identified & { body: string }>>(page, "/api/v1/journal"),
    plans: await apiRead<PlanRecord[]>(page, "/api/v1/plans"),
    orbit: await apiRead<OrbitField>(page, "/api/v1/orbit-field"),
    insights: await apiRead<InsightRecord[]>(page, "/api/v1/insights?limit=80"),
    memories: await apiRead<MemoryRecord[]>(page, "/api/v1/memories"),
    projects: await apiRead<ProjectRecord[]>(page, "/api/v1/projects"),
    tasks: await apiRead<Identified[]>(page, `/api/v1/projects/${project.id}/tasks`),
    evidence: await apiRead<Identified[]>(page, `/api/v1/projects/${project.id}/evidence`),
    runs: await apiRead<Array<Identified & { status: string }>>(page, `/api/v1/projects/${project.id}/runs`),
    reviews: await apiRead<Identified[]>(page, `/api/v1/projects/${project.id}/reviews`),
    files: await apiRead<Identified[]>(page, `/api/v1/projects/${project.id}/files`),
    timeline: await apiRead<{ entries: Array<{ source_id: string; title: string }> }>(page, "/api/v1/timeline/flow"),
  };
  expect(ownerA.journal.body).toContainEqual(expect.objectContaining({ body: journalLine }));
  expect(ownerA.plans.body).toContainEqual(expect.objectContaining({ id: plan.id }));
  expect(ownerA.insights.body).toContainEqual(expect.objectContaining({ id: insight.id, status: "ACCEPTED" }));
  expect(ownerA.memories.body).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: acceptedMemory.id }),
    expect.objectContaining({ id: ownerMemory.id, canonical_text: ownerMemoryText }),
  ]));
  expect(ownerA.projects.body).toContainEqual(expect.objectContaining({ id: project.id }));
  expect(ownerA.tasks.body).toContainEqual(expect.objectContaining({ id: task.id }));
  expect(ownerA.evidence.body.length).toBeGreaterThan(0);
  expect(ownerA.runs.body).toContainEqual(expect.objectContaining({ id: run.id, status: "APPROVED" }));
  expect(ownerA.reviews.body.length).toBeGreaterThan(0);
  expect(ownerA.files.body).toContainEqual(expect.objectContaining({ id: projectFile.id }));
  expect(ownerA.timeline.body.entries).toContainEqual(expect.objectContaining({ source_id: outcome.id, title: outcomeLine }));

  const baseURL = process.env.NUR_REAL_STACK_BASE_URL;
  if (!baseURL) throw new Error("NUR_REAL_STACK_BASE_URL is required.");
  const ownerBContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const ownerBPage = await ownerBContext.newPage();
  watchRuntime(ownerBPage, "owner-b", serverErrors, pageErrors);
  try {
    await registerRealOwner(ownerBPage, "core-lifecycle-b");
    const ownerBJournal = await apiRead<Array<Identified & { body: string }>>(ownerBPage, "/api/v1/journal");
    const ownerBPlans = await apiRead<PlanRecord[]>(ownerBPage, "/api/v1/plans");
    const ownerBOrbit = await apiRead<OrbitField>(ownerBPage, "/api/v1/orbit-field");
    const ownerBInsights = await apiRead<InsightRecord[]>(ownerBPage, "/api/v1/insights?limit=80");
    const ownerBMemories = await apiRead<MemoryRecord[]>(ownerBPage, "/api/v1/memories");
    const ownerBProjects = await apiRead<ProjectRecord[]>(ownerBPage, "/api/v1/projects");
    const ownerBTimeline = await apiRead<{ entries: Array<{ source_id: string; title: string }> }>(ownerBPage, "/api/v1/timeline/flow");
    const directProject = await apiRead<Record<string, unknown>>(ownerBPage, `/api/v1/projects/${project.id}`);
    const directInsight = await apiRead<Record<string, unknown>>(ownerBPage, `/api/v1/insights/${insight.id}`);
    const directFiles = await apiRead<Record<string, unknown>>(ownerBPage, `/api/v1/projects/${project.id}/files`);

    expect(ownerBJournal.body.some(row => row.body === journalLine)).toBe(false);
    expect(ownerBPlans.body.some(row => row.id === plan.id)).toBe(false);
    expect(ownerBOrbit.body.people.some(row => row.id === person.id || row.display_name === personName)).toBe(false);
    expect(ownerBOrbit.body.groups.some(row => row.id === group.id || row.name === groupName)).toBe(false);
    expect(ownerBInsights.body.some(row => row.id === insight.id)).toBe(false);
    expect(ownerBMemories.body.some(row => row.id === acceptedMemory.id || row.id === ownerMemory.id)).toBe(false);
    expect(ownerBProjects.body.some(row => row.id === project.id)).toBe(false);
    expect(ownerBTimeline.body.entries.some(row => row.source_id === outcome.id || row.title === outcomeLine)).toBe(false);
    expect(directProject.status).toBe(404);
    expect(directInsight.status).toBe(404);
    expect(directFiles.status).toBe(404);
    await attachViewport(ownerBPage, testInfo, "core-lifecycle-owner-b-isolated");
  } finally {
    await ownerBContext.close();
  }

  await testInfo.attach("core-product-lifecycle.json", {
    body: Buffer.from(JSON.stringify({
      ownerA: {
        journalId: ownerA.journal.body.find(row => row.body === journalLine)?.id,
        activeOrbitId,
        planId: plan.id,
        outcomeId: outcome.id,
        personId: person.id,
        groupId: group.id,
        insightId: insight.id,
        memoryIds: [acceptedMemory.id, ownerMemory.id],
        projectId: project.id,
        taskId: task.id,
        runId: run.id,
        fileId: projectFile.id,
      },
      ownerB: {
        directProjectStatus: 404,
        directInsightStatus: 404,
        directFilesStatus: 404,
      },
    }, null, 2)),
    contentType: "application/json",
  });

  expect(serverErrors, `Unexpected 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
  expect(pageErrors, `Uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
});
