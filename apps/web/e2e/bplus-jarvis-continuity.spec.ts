import { expect, test, type FrameLocator, type Page, type Route } from "@playwright/test";

import { installNurMocks, mockClaim } from "./helpers/nurMocks";

const claimVersionId = "77777777-7777-7777-7777-777777777777";
const predictionId = "88888888-8888-8888-8888-888888888888";
const outcomeId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

type ThreadRow = {
  id: string;
  who: "user" | "nur";
  text: string;
  structured_payload: Record<string, unknown>;
  created_at: string;
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function sse(route: Route, events: Array<{ id: number; event: string; data: unknown }>) {
  await route.fulfill({
    status: 200,
    headers: { "cache-control": "no-cache", "content-type": "text/event-stream; charset=utf-8" },
    body: events.map(row => (
      `id: ${row.id}\nevent: ${row.event}\ndata: ${JSON.stringify(row.data)}\n\n`
    )).join(""),
  });
}

async function readyUniverse(page: Page, selector: string): Promise<FrameLocator> {
  await expect(page.locator("#nur-universe-stage")).toHaveClass(/is-visible/, { timeout: 12_000 });
  const universe = page.frameLocator("#nur-universe-stage");
  await expect(universe.locator(selector)).toBeVisible();
  return universe;
}

test("persisted contradiction changes the later recommendation and keeps its WhyChanged receipt", async ({ page }) => {
  await installNurMocks(page);
  const now = new Date().toISOString();
  const thread: ThreadRow[] = [
    {
      id: "persisted-question-a",
      who: "user",
      text: "Which migration-throughput strategy should I use?",
      structured_payload: {},
      created_at: now,
    },
    {
      id: "persisted-answer-a",
      who: "nur",
      text: "Strategy A — current canonical state still supports this path.",
      structured_payload: {
        talk_output: {
          direct_response: "Strategy A — current canonical state still supports this path.",
          observed: [], inferred: [], hypotheses: [], uncertainty: [], next_move: null,
          memory_candidates: [], source_refs: [],
        },
      },
      created_at: now,
    },
  ];
  await page.route("**/api/v1/cognition/talk-thread**", route => json(route, thread));
  await page.route("**/api/v1/cognition/talk/stream", async route => {
    const body = JSON.parse(route.request().postData() || "{}") as { message?: string };
    const sourceRefs = [
      `OMEGA_CLAIM_VERSION:${claimVersionId}`,
      `PREDICTION:${predictionId}`,
      `OUTCOME:${outcomeId}`,
    ];
    const output = {
      direct_response: "Strategy B — Strategy A was contradicted by the persisted outcome.",
      observed: [], inferred: [], hypotheses: [], uncertainty: [], next_move: null,
      memory_candidates: [], source_refs: sourceRefs,
    };
    const result = {
      turn_event_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      response_event_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      model_run_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      provider: "openai",
      provider_available: true,
      provider_reason: null,
      output,
      evidence: {
        retrieval: sourceRefs.map(ref => {
          const [kind, id] = ref.split(":");
          return { kind, id, excerpt: "Persisted bounded continuity receipt.", rank: 1 };
        }),
        withheld: [],
      },
      verification: { verdict: "PASS", checks: { missing_source_refs: [] } },
    };
    thread.push(
      { id: result.turn_event_id, who: "user", text: body.message ?? "", structured_payload: {}, created_at: now },
      {
        id: result.response_event_id,
        who: "nur",
        text: output.direct_response,
        structured_payload: { talk_output: output, provider_available: true, model_run_id: result.model_run_id },
        created_at: now,
      },
    );
    return sse(route, [
      { id: 1, event: "stream.open", data: { request_id: "task13" } },
      { id: 2, event: "talk.accepted", data: { model_run_id: result.model_run_id } },
      { id: 3, event: "response.text.delta", data: { delta: output.direct_response } },
      { id: 4, event: "talk.completed", data: { durable: true, result } },
    ]);
  });
  await page.route(`**/api/v1/omega/claims/${mockClaim.id}/why-changed`, route => json(route, {
    claim_id: mockClaim.id,
    claim_text: "Strategy A is the preferred migration-throughput strategy.",
    current_truth_status: "CONTRADICTED",
    current_confidence: 0.75,
    changed_because: [`Observed outcome ${outcomeId} contradicted prediction ${predictionId}.`],
    supporting_edges: [],
    contradicting_edges: [`CONTRADICTS via OUTCOME (${outcomeId}) strength 1.00`],
    unresolved_note: null,
  }));

  await page.goto("/talk");
  const universe = await readyUniverse(page, "#page-talk");
  await expect(universe.getByText("Strategy A — current canonical state still supports this path.", { exact: true })).toBeVisible();

  await universe.locator("#talk-input").fill("Which migration-throughput strategy should I use?");
  await universe.getByRole("button", { name: "Send to NUR" }).click();
  await expect(universe.getByText("Strategy B — Strategy A was contradicted by the persisted outcome.", { exact: true })).toBeVisible();
  expect(thread.at(-1)?.structured_payload).toMatchObject({
    talk_output: {
      source_refs: [
        `OMEGA_CLAIM_VERSION:${claimVersionId}`,
        `PREDICTION:${predictionId}`,
        `OUTCOME:${outcomeId}`,
      ],
    },
  });

  await page.reload();
  await readyUniverse(page, "#page-talk");
  await expect(universe.getByText("Strategy B — Strategy A was contradicted by the persisted outcome.", { exact: true })).toBeVisible();

  await page.goto(`/universe/omega/why-changed/${mockClaim.id}`);
  await expect(universe.locator("body")).toContainText(outcomeId);
  await expect(universe.locator("body")).toContainText("CONTRADICTED");
  await expect(universe.locator("body")).not.toContainText("chain_of_thought");
});
