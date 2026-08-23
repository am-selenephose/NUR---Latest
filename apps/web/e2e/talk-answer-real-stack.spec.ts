import { expect, test, type Page } from "@playwright/test";

import { registerRealOwner } from "./helpers/realStack";

const DIRECT_RESPONSE = "NUR received this line through its server-side cognitive stream.";

type TalkPayload = {
  request_id: string;
  message: string;
  orbit_id?: string | null;
  locale: string;
  writing_preference: string;
  mode?: string;
  memory_mode?: "EPHEMERAL" | "REVIEW";
};

type TalkThreadRow = {
  id: string;
  who: "user" | "nur";
  text: string | null;
};

type TalkRun = {
  request_id: string;
  model_run_id: string;
  status: string;
  provider: string;
  response_event_id: string | null;
  provider_response_id_present: boolean;
  schema_valid: boolean;
};

function parseSse(raw: string): Array<{ event: string; data: Record<string, unknown> }> {
  return raw.replace(/\r\n/g, "\n").split("\n\n").flatMap(block => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      if (line.startsWith("data: ")) data.push(line.slice(6));
    }
    if (!data.length) return [];
    return [{ event, data: JSON.parse(data.join("\n")) as Record<string, unknown> }];
  });
}

async function getTalkRun(page: Page, requestId: string): Promise<TalkRun | null> {
  return page.evaluate(async id => {
    const response = await fetch(`/api/v1/cognition/talk-runs/${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Talk status failed: ${response.status}`);
    return response.json() as Promise<TalkRun>;
  }, requestId);
}

async function getTalkThread(page: Page): Promise<TalkThreadRow[]> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/cognition/talk-thread", { credentials: "include" });
    if (!response.ok) throw new Error(`Talk thread failed: ${response.status}`);
    return response.json() as Promise<TalkThreadRow[]>;
  });
}

test("real Talk streams, persists, reloads, replays, and cancels without a duplicate answer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The deterministic full-stack Talk proof runs once on desktop.");
  test.setTimeout(180_000);

  const health = await page.request.get("/healthz");
  expect(health.ok()).toBe(true);
  expect((await health.json() as { ai_provider: string }).ai_provider).toBe("deterministic");

  await registerRealOwner(page, "talk-answer");
  await page.goto("/talk", { waitUntil: "load" });
  let universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#page-talk")).toBeVisible({ timeout: 30_000 });

  const message = `Durable deterministic Talk ${Date.now()}`;
  const firstRequestPromise = page.waitForRequest(request => (
    request.url().includes("/api/v1/cognition/talk/stream") && request.method() === "POST"
  ));
  await universe.locator("#talk-input").fill(message);
  await universe.getByRole("button", { name: "Send to NUR" }).click();
  const firstRequest = await firstRequestPromise;
  const firstPayload = firstRequest.postDataJSON() as TalkPayload;
  expect(firstPayload.message).toBe(message);
  expect(firstPayload.request_id).toMatch(/^[0-9a-f-]{36}$/i);

  await expect(
    universe.locator("#talk-stream .talk-message.nur").filter({ hasText: DIRECT_RESPONSE }),
  ).toHaveCount(1, { timeout: 60_000 });
  await expect.poll(async () => (await getTalkRun(page, firstPayload.request_id))?.status, {
    timeout: 30_000,
    intervals: [250, 500, 1_000],
  }).toBe("COMPLETED");
  const completedRun = await getTalkRun(page, firstPayload.request_id);
  expect(completedRun).toMatchObject({
    request_id: firstPayload.request_id,
    status: "COMPLETED",
    provider: "deterministic",
    provider_response_id_present: true,
    schema_valid: true,
  });
  expect(completedRun?.response_event_id).toBeTruthy();

  const threadBeforeReplay = await getTalkThread(page);
  expect(threadBeforeReplay.filter(row => row.text === message).map(row => row.who)).toEqual(["user"]);
  expect(threadBeforeReplay.filter(row => row.text === DIRECT_RESPONSE).map(row => row.who)).toEqual(["nur"]);

  await page.reload({ waitUntil: "load" });
  universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator("#talk-stream .talk-message.user").filter({ hasText: message })).toHaveCount(1);
  await expect(
    universe.locator("#talk-stream .talk-message.nur").filter({ hasText: DIRECT_RESPONSE }),
  ).toHaveCount(1);

  const replay = await page.evaluate(async payload => {
    const csrf = document.cookie
      .split(";")
      .map(value => value.trim())
      .find(value => value.startsWith("nur_csrf="))
      ?.slice("nur_csrf=".length);
    if (!csrf) throw new Error("Missing CSRF cookie for Talk replay.");
    const response = await fetch("/api/v1/cognition/talk/stream", {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json",
        "X-CSRF-Token": decodeURIComponent(csrf),
      },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.text() };
  }, firstPayload);
  expect(replay.status).toBe(200);
  const replayEvents = parseSse(replay.body);
  const replayCompletion = replayEvents.find(row => row.event === "talk.completed");
  const replayResult = replayCompletion?.data.result as { model_run_id?: string } | undefined;
  expect(replayResult?.model_run_id).toBe(completedRun?.model_run_id);
  expect(await getTalkThread(page)).toEqual(threadBeforeReplay);

  const cancelledMessage = `Cancel deterministic Talk ${Date.now()}`;
  const cancelledRequestPromise = page.waitForRequest(request => (
    request.url().includes("/api/v1/cognition/talk/stream") && request.method() === "POST"
  ));
  await universe.locator("#talk-input").fill(cancelledMessage);
  await universe.getByRole("button", { name: "Send to NUR" }).click();
  const cancelledRequest = await cancelledRequestPromise;
  const cancelledPayload = cancelledRequest.postDataJSON() as TalkPayload;
  const pendingResponse = universe.locator(
    `.talk-message.nur[data-nur-transient="${cancelledPayload.request_id}"]`,
  );
  await expect(pendingResponse.locator(".talk-meta")).toContainText("model is responding", {
    timeout: 30_000,
  });
  const cancelResponsePromise = page.waitForResponse(response => (
    response.url().includes(`/api/v1/cognition/talk-runs/${cancelledPayload.request_id}/cancel`)
    && response.request().method() === "POST"
  ));
  await pendingResponse.locator('[data-action="talk-cancel"]').click();
  expect((await cancelResponsePromise).status()).toBe(202);

  await expect.poll(async () => (await getTalkRun(page, cancelledPayload.request_id))?.status, {
    timeout: 30_000,
    intervals: [250, 500, 1_000],
  }).toBe("CANCELLED");
  const cancelledRun = await getTalkRun(page, cancelledPayload.request_id);
  expect(cancelledRun).toMatchObject({
    request_id: cancelledPayload.request_id,
    status: "CANCELLED",
    provider: "deterministic",
    response_event_id: null,
    schema_valid: false,
  });

  await expect.poll(async () => (
    (await getTalkThread(page)).filter(row => row.text === cancelledMessage).length
  ), { timeout: 30_000, intervals: [250, 500, 1_000] }).toBe(1);
  const threadAfterCancel = await getTalkThread(page);
  expect(threadAfterCancel.filter(row => row.text === cancelledMessage).map(row => row.who)).toEqual(["user"]);
  expect(threadAfterCancel.filter(row => row.text === DIRECT_RESPONSE).map(row => row.who)).toEqual(["nur"]);

  await page.reload({ waitUntil: "load" });
  universe = page.frameLocator("#nur-universe-stage");
  await expect(
    universe.locator("#talk-stream .talk-message.user").filter({ hasText: cancelledMessage }),
  ).toHaveCount(1);
  await expect(
    universe.locator("#talk-stream .talk-message.nur").filter({ hasText: DIRECT_RESPONSE }),
  ).toHaveCount(1);
});
