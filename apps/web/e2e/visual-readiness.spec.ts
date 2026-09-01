import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test, type FrameLocator, type Locator, type Page, type Route } from "@playwright/test";
import { installBundledFontPolicy } from "./helpers/nurMocks";

const now = new Date().toISOString();
const baseUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "selene@nurapp.dev",
  email_verified: true,
  profile: { chosen_name: "Selene", timezone: null, locale: "en", sound_enabled: false, reduced_effects: true },
  orbit: { id: "99999999-9999-9999-9999-999999999999", current_arrival_state: null, active_focus_area: null },
};
const orbit = {
  id: "22222222-2222-2222-2222-222222222222",
  title: "Ambition",
  kind: "PROJECT",
  description: "Build without noise",
  status: "ACTIVE",
  created_at: now,
};
const systemTitles = [
  "Ambition",
  "Rebuild",
  "Creation",
  "Growth",
  "Introspection",
  "Connection",
] as const;
const systems = systemTitles.map((title, index) => {
  const slug = title.toLowerCase();
  return {
    slug,
    title,
    definition: `${title} is held in the persisted owner ledger.`,
    orbit_id: index === 0 ? orbit.id : `system-${slug}`,
    questions: [`What matters inside ${title}?`],
    checklist: [],
    progress_percent: 0,
    progress_sources: {
      completed_actions: 0,
      total_actions: 0,
      action_completion_percent: 0,
      goal_progress_percent: 0,
      latest_diagnostic_score: 0,
      glow_points: 0,
      formula: "Persisted owner evidence only.",
    },
    active_goal_count: 0,
    goals: [],
    actions: [],
    blockers: [],
    next_move: { kind: "NONE", id: null, title: `Choose one honest ${title} move.` },
    prediction: {
      if_ignored: "No outcome has been persisted.",
      if_followed: "A returned outcome can update this System.",
      basis: {},
      provenance_label: "OWNER_LEDGER",
    },
  };
});
const today = {
  date: now.slice(0, 10),
  day_label: "Today",
  local_time: "12:00",
  timezone: "UTC",
  daypart: "day",
  body: { score: 0, sources: {}, calculation: "No persisted reading." },
  mind: { score: 0, sources: {}, calculation: "No persisted reading." },
  life: { score: 0, sources: {}, calculation: "No persisted reading." },
  glow_today: 0,
  active_systems: systems,
  active_goals: [],
  active_plans: [],
  scheduled_today: [],
  completed_today: [],
  missed_today: [],
  daily_quest: {},
  next_move: null,
  latest_insight: null,
  latest_timeline_event: null,
  return_check: null,
  provenance_label: "OWNER_LEDGER",
};
const liveUniverse = {
  generated_at: now,
  provenance_label: "OWNER_LEDGER_AGGREGATE",
  owner: {
    id: baseUser.id,
    email: baseUser.email,
    chosen_name: baseUser.profile.chosen_name,
    timezone: "UTC",
    locale: "en",
    writing_preference: "default",
    default_boundary: "PRIVATE_ORBIT",
  },
  state: {
    summary: "Six founder-locked Systems are active.",
    source_count: 0,
    confidence: 0,
    confidence_kind: "source_coverage_not_truth_probability",
    last_updated: now,
    today,
    provenance_label: "DETERMINISTIC_OWNER_LEDGER_SYNTHESIS",
  },
  active_systems: systems,
  active_goals: [],
  active_objectives: [],
  active_plans: [],
  people_orbits: [],
  group_orbits: [],
  projects: [],
  latest_insights: [],
  timeline_highlights: [],
  open_loops: [],
  next_moves: [],
  glow: { today_points: 0 },
  signals: [],
  community: {
    live_connected: false,
    status: "LOCAL_NOTES_ONLY",
    note_count: 0,
    latest_note: null,
    honest_state: "No live community activity is invented.",
  },
  what_changed: [],
};
const decision = {
  id: "decision-1",
  orbit_id: orbit.id,
  statement: "Postgres RLS is the trust boundary.",
  rationale: "Recipient access must stay grant-scoped.",
  created_at: now,
};
const reference = {
  id: "reference-1",
  orbit_id: orbit.id,
  title: "Capsule spectrum palette",
  body: "Mango 26E through pearl FFF2D3.",
  created_at: now,
};
const source = {
  id: "source-decision-1",
  orbit_id: orbit.id,
  source_kind: "DECISION",
  source_id: decision.id,
  created_at: now,
};

function proofPath(name: string) {
  const configured = process.env.NUR_PROOF_DIR;
  return join(configured ?? (process.cwd().endsWith("/apps/web") ? "../../proof/100-delta" : "proof/100-delta"), name);
}

async function screenshot(page: Page, name: string) {
  const path = proofPath(name);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
}

async function duplicateProofImage(sourceName: string, targetName: string) {
  const source = proofPath(sourceName);
  const target = proofPath(targetName);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

async function locatorScreenshot(locator: Locator, name: string) {
  const path = proofPath(name);
  await mkdir(dirname(path), { recursive: true });
  await locator.screenshot({ path, animations: "disabled" });
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installVisualMocks(
  page: Page,
  locale = "en",
  writingPreference: "default" | "roman" | "script" = "default",
) {
  await installBundledFontPolicy(page);
  await page.context().addCookies([{
    name: "nur_csrf",
    value: "visual-readiness-csrf",
    url: "http://localhost:4173",
    httpOnly: false,
    sameSite: "Lax",
  }]);
  await page.addInitScript(language => {
    Object.defineProperty(navigator, "language", { get: () => language });
    Object.defineProperty(navigator, "languages", { get: () => [language, "en"] });
  }, locale);
  await page.route("**/api/v1/auth/me", route => json(route, {
    ...baseUser,
    profile: { ...baseUser.profile, locale, writing_preference: writingPreference },
  }));
  await page.route("**/api/v1/profile/preferences", route => json(route, {
    locale,
    sound_enabled: false,
    reduced_effects: true,
    default_boundary: "PRIVATE_ORBIT",
    active_orbit_id: orbit.id,
    omega_enabled: true,
    writing_preference: writingPreference,
    timezone: "UTC",
  }));
  await page.route("**/healthz", route => json(route, { status: "ok" }));
  await page.route("**/api/v1/universe/live", route => json(route, {
    ...liveUniverse,
    owner: { ...liveUniverse.owner, locale, writing_preference: writingPreference },
  }));
  await page.route("**/api/v1/universe/map-summary", route => json(route, null));
  await page.route("**/api/v1/universe/orbits-summary", route => json(route, null));
  await page.route("**/api/v1/universe/timeline", route => json(route, null));
  await page.route("**/api/v1/universe/insights-summary", route => json(route, null));
  await page.route("**/api/v1/map", route => json(route, null));
  await page.route("**/api/v1/glow/scoreboard", route => json(route, null));
  await page.route("**/api/v1/glow/summary", route => json(route, {
    balance: 0,
    lifetime_points: 0,
    today_points: 0,
    weekly_points: 0,
    level: 1,
    rank: "Orbit Seed",
    next_unlock: null,
    recent_transactions: [],
    streaks: [],
    achievements: [],
    daily_quest: {},
    weekly_mission: {},
  }));
  await page.route("**/api/v1/research/briefs", route => json(route, []));
  await page.route("**/api/v1/projects/summary", route => json(route, null));
  await page.route("**/api/v1/community/rooms", route => json(route, []));
  await page.route("**/api/v1/orbits/current-state", route => json(route, {
    active_systems: systems.length,
    outcomes_returned: 2,
    insights_evolving: 3,
    open_questions: 1,
    research_staged: 1,
    plans_active: 1,
    live_status: "owner_ledger",
  }));
  await page.route("**/api/v1/orbits", route => json(route, [orbit]));
  await page.route(`**/api/v1/orbits/${orbit.id}/decisions`, route => json(route, [decision]));
  await page.route(`**/api/v1/orbits/${orbit.id}/references`, route => json(route, [reference]));
  await page.route(`**/api/v1/orbits/${orbit.id}/sources`, route => json(route, [source]));
  await page.route("**/api/v1/capsules", route => json(route, [{
    id: "cap-existing",
    orbit_id: orbit.id,
    title: "Ambition shared context",
    purpose: "Get a designer useful in 20 minutes",
    capability: "ASK_SCOPED_QUESTIONS",
    expires_at: null,
    revoked_at: null,
    created_at: now,
  }]));
  await page.route("**/api/v1/journal", route => json(route, []));
  await page.route("**/api/v1/plans", route => json(route, []));
  await page.route("**/api/v1/research-drafts", route => json(route, [{
    id: "research-1",
    question: "What signal belongs here?",
    status: "STAGED",
    created_at: now,
  }]));
  await page.route("**/api/v1/cognition/talk-thread**", route => json(route, []));
  await page.route("**/api/v1/capsules/cap-active/view", route => json(route, {
    capsule_id: "cap-active",
    state: "ACTIVE",
    title: "Ambition",
    purpose: "Get a designer useful in 20 minutes",
    owner_display: "Selene",
    capability: "ASK_SCOPED_QUESTIONS",
    expires_at: null,
    recipient_instructions: "Stay inside the approved boundary.",
    safety_copy: "This does not speak for Selene. It answers only from approved context.",
    included: [{
      source_id: "decision-1",
      source_kind: "DECISION",
      representation: "FULL",
      title: "Postgres RLS is the trust boundary.",
      body: "Recipient access must stay grant-scoped.",
    }],
    excluded_summary: [{ source_kind: "REFERENCE", count: 1, note: "withheld by the owner" }],
    grant_id: "grant-1",
  }));
}

async function box(name: string, locator: Locator) {
  await expect(locator, `${name} is visible`).toBeVisible();
  const value = await locator.boundingBox();
  expect(value, `${name} has a DOM box`).not.toBeNull();
  return value!;
}

const canonicalGalaxyVersion = "V197-halo-free-2026.08";
const exactGalaxySha256 = "315071e23bd82cad1b68179f7efc3728b274ac5b7ffcae5941ceb919efa7773a";
const exactBrainSha256 = "60c8e2db5b3457fb079b075808e537c63441e233d72b0f3301f4bff4e9db2ce0";

async function assertCanonicalGalaxyRuntime(page: Page, viewportLabel: string) {
  type ExactGalaxyDiagnostics = {
    version: string;
    sourceArtifact: string;
    artifactSha256: string;
    viewport: { width: number; height: number };
    backingStore: { width: number; height: number; dpr: number };
    particles: number;
    ambient: number;
    stars: number;
    ambientStars: number;
    presentedHz: number;
    haloLayer: boolean;
    renderer: string;
  };
  type RuntimeEvidence = {
    ready: boolean;
    legacyCanvasCount: number;
    htmlState: string | null;
    viewport: { width: number; height: number };
    galaxyFrame: {
      count: number;
      src: string | null;
      sha256: string | null;
      state: string | null;
      rect: { left: number; top: number; width: number; height: number };
      style: {
        display: string;
        position: string;
        opacity: number;
        pointerEvents: string;
        visibility: string;
      };
    };
    galaxyCanvas: {
      present: boolean;
      rect: { left: number; top: number; width: number; height: number };
      backing: { width: number; height: number };
      style: {
        display: string;
        position: string;
        opacity: number;
        pointerEvents: string;
        visibility: string;
      };
      pixelSignal: { litSamples: number; spreadWidth: number; spreadHeight: number };
    };
    diagnostics: ExactGalaxyDiagnostics | null;
    brain: {
      hostCount: number;
      visible: boolean;
      state: string | null;
      sha256: string | null;
      engine: string | null;
      frameCount: number;
      frameState: string | null;
      frameSha256: string | null;
      legacyCanvasCount: number;
      canvasPresent: boolean;
      title: string | null;
      paintedSamples: number;
    };
  };

  await expect.poll(async () => {
    return page.evaluate(() => {
      const stageElement = globalThis.document.getElementById("nur-universe-stage") as HTMLIFrameElement | null;
      const stageDocument = stageElement?.contentDocument ?? null;
      const stageWindow = stageElement?.contentWindow ?? null;
      if (!stageDocument || !stageWindow) return false;
      const galaxyFrame = stageDocument.getElementById("nur-v197-halo-free-galaxy-frame") as HTMLIFrameElement | null;
      const brainHost = stageDocument.getElementById("front-nur-star") as HTMLElement | null;
      const brainFrame = stageDocument.getElementById("nur-exact-brain-frame") as HTMLIFrameElement | null;
      const diagnostics = (stageWindow as unknown as {
        NURDiagnostics?: { snapshot?: () => ExactGalaxyDiagnostics };
      }).NURDiagnostics?.snapshot?.() ?? null;
      return galaxyFrame?.dataset.nurExactGalaxyState === "ready"
        && brainHost?.dataset.nurExactBrainState === "ready"
        && brainFrame?.dataset.nurExactBrainState === "ready"
        && diagnostics?.particles === 2662;
    });
  }, { message: `${viewportLabel} exact celestial artifacts become ready` }).toBe(true);

  const proof = await page.evaluate<RuntimeEvidence>(() => {
    const hostDocument = globalThis.document;
    const stageElement = hostDocument.getElementById("nur-universe-stage") as HTMLIFrameElement | null;
    const stageDocument = stageElement?.contentDocument ?? null;
    const stageWindow = stageElement?.contentWindow ?? null;
    if (!stageDocument || !stageWindow) throw new Error("V197 stage document is unavailable");
    const document = stageDocument;
    const window = stageWindow;
    const innerWidth = stageWindow.innerWidth;
    const innerHeight = stageWindow.innerHeight;
    const getComputedStyle = stageWindow.getComputedStyle.bind(stageWindow);
    const galaxyFrames = document.querySelectorAll<HTMLIFrameElement>("#nur-v197-halo-free-galaxy-frame");
    const galaxyFrame = galaxyFrames[0];
    const galaxyDocument = galaxyFrame?.contentDocument ?? null;
    const galaxyCanvas = galaxyDocument?.getElementById("galaxy") as HTMLCanvasElement | null;
    const brainHosts = document.querySelectorAll<HTMLElement>("#front-nur-star");
    const brainHost = brainHosts[0];
    const brainFrames = document.querySelectorAll<HTMLIFrameElement>("#nur-exact-brain-frame");
    const brainFrame = brainFrames[0];
    const brainDocument = brainFrame?.contentDocument ?? null;
    const brainCanvas = brainDocument?.getElementById("nur-brain-canvas-v197") as HTMLCanvasElement | null;
    const brainInnerHost = brainDocument?.getElementById("front-nur-star") as HTMLElement | null;
    const diagnostics = (window as unknown as {
      NURDiagnostics?: { snapshot?: () => ExactGalaxyDiagnostics };
    }).NURDiagnostics?.snapshot?.() ?? null;

    const blankRect = { left: 0, top: 0, width: 0, height: 0 };
    const blankStyle = {
      display: "none",
      position: "static",
      opacity: 0,
      pointerEvents: "none",
      visibility: "hidden",
    };
    const geometry = (element: HTMLElement | null) => {
      if (!element) return { rect: blankRect, style: blankStyle };
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        style: {
          display: style.display,
          position: style.position,
          opacity: Number(style.opacity),
          pointerEvents: style.pointerEvents,
          visibility: style.visibility,
        },
      };
    };
    const galaxyGeometry = geometry(galaxyFrame ?? null);
    const canvasGeometry = geometry(galaxyCanvas);
    const brainGeometry = geometry(brainHost ?? null);

    let galaxySignal = { litSamples: 0, spreadWidth: 0, spreadHeight: 0 };
    if (galaxyCanvas && galaxyCanvas.width > 1 && galaxyCanvas.height > 1) {
      const context = galaxyCanvas.getContext("2d");
      let litSamples = 0;
      let minX = galaxyCanvas.width;
      let maxX = -1;
      let minY = galaxyCanvas.height;
      let maxY = -1;
      if (context) {
        const pixels = context.getImageData(0, 0, galaxyCanvas.width, galaxyCanvas.height).data;
        const step = Math.max(1, Math.floor(Math.min(galaxyCanvas.width, galaxyCanvas.height) / 240));
        for (let y = 0; y < galaxyCanvas.height; y += step) {
          for (let x = 0; x < galaxyCanvas.width; x += step) {
            const index = (y * galaxyCanvas.width + x) * 4;
            const brightness = (pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0);
            if ((pixels[index + 3] ?? 0) <= 20 || brightness <= 150) continue;
            litSamples += 1;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      const scaleX = canvasGeometry.rect.width / Math.max(1, galaxyCanvas.width);
      const scaleY = canvasGeometry.rect.height / Math.max(1, galaxyCanvas.height);
      galaxySignal = {
        litSamples,
        spreadWidth: maxX >= minX ? (maxX - minX + 1) * scaleX : 0,
        spreadHeight: maxY >= minY ? (maxY - minY + 1) * scaleY : 0,
      };
    }

    let paintedSamples = 0;
    if (brainCanvas && brainCanvas.width > 1 && brainCanvas.height > 1) {
      const context = brainCanvas.getContext("2d");
      if (context) {
        const pixels = context.getImageData(0, 0, brainCanvas.width, brainCanvas.height).data;
        const stride = Math.max(4, Math.floor(pixels.length / 8_000 / 4) * 4);
        for (let index = 3; index < pixels.length; index += stride) {
          if ((pixels[index] ?? 0) > 8) paintedSamples += 1;
        }
      }
    }

    return {
      ready: Boolean(galaxyFrame && galaxyCanvas && brainHost && brainFrame && brainCanvas && diagnostics),
      legacyCanvasCount: document.querySelectorAll("canvas#space3d").length,
      htmlState: document.documentElement.dataset.nurCanonicalGalaxy ?? null,
      viewport: { width: innerWidth, height: innerHeight },
      galaxyFrame: {
        count: galaxyFrames.length,
        src: galaxyFrame?.getAttribute("src") ?? null,
        sha256: galaxyFrame?.dataset.nurArtifactSha256 ?? null,
        state: galaxyFrame?.dataset.nurExactGalaxyState ?? null,
        ...galaxyGeometry,
      },
      galaxyCanvas: {
        present: Boolean(galaxyCanvas),
        ...canvasGeometry,
        backing: { width: galaxyCanvas?.width ?? 0, height: galaxyCanvas?.height ?? 0 },
        pixelSignal: galaxySignal,
      },
      diagnostics,
      brain: {
        hostCount: brainHosts.length,
        visible: brainGeometry.style.display !== "none"
          && brainGeometry.style.visibility !== "hidden"
          && brainGeometry.style.opacity > 0
          && brainGeometry.rect.width > 0
          && brainGeometry.rect.height > 0,
        state: brainHost?.dataset.nurExactBrainState ?? null,
        sha256: brainHost?.dataset.nurArtifactSha256 ?? null,
        engine: brainHost?.dataset.nurEngine ?? null,
        frameCount: brainFrames.length,
        frameState: brainFrame?.dataset.nurExactBrainState ?? null,
        frameSha256: brainFrame?.dataset.nurArtifactSha256 ?? null,
        legacyCanvasCount: document.querySelectorAll("#nur-brain-canvas").length,
        canvasPresent: Boolean(brainCanvas),
        title: brainInnerHost?.getAttribute("title") ?? null,
        paintedSamples,
      },
    };
  });

  expect(proof.ready, `${viewportLabel} exact runtime snapshot is complete`).toBe(true);
  expect(proof.legacyCanvasCount, `${viewportLabel} removes the superseded parent galaxy canvas`).toBe(0);
  expect(proof.htmlState).toBe("ready");
  expect(proof.galaxyFrame.count, `${viewportLabel} has one exact galaxy owner`).toBe(1);
  expect(proof.galaxyFrame.src).toBe("/v197/NUR_V197_HALO_FREE.html");
  expect(proof.galaxyFrame.sha256).toBe(exactGalaxySha256);
  expect(proof.galaxyFrame.state).toBe("ready");
  expect(proof.galaxyFrame.style.display).toBe("block");
  expect(proof.galaxyFrame.style.position).toBe("fixed");
  expect(proof.galaxyFrame.style.visibility).toBe("visible");
  expect(proof.galaxyFrame.style.opacity).toBe(1);
  expect(proof.galaxyFrame.style.pointerEvents).toBe("none");
  expect(Math.abs(proof.galaxyFrame.rect.left), `${viewportLabel} exact frame begins at viewport left`)
    .toBeLessThanOrEqual(1);
  expect(Math.abs(proof.galaxyFrame.rect.top), `${viewportLabel} exact frame begins at viewport top`)
    .toBeLessThanOrEqual(1);
  expect(Math.abs(proof.galaxyFrame.rect.width - proof.viewport.width), `${viewportLabel} exact frame spans viewport width`)
    .toBeLessThanOrEqual(1);
  expect(Math.abs(proof.galaxyFrame.rect.height - proof.viewport.height), `${viewportLabel} exact frame spans viewport height`)
    .toBeLessThanOrEqual(1);

  expect(proof.galaxyCanvas.present).toBe(true);
  expect(proof.galaxyCanvas.style.display).toBe("block");
  expect(proof.galaxyCanvas.style.position).toBe("fixed");
  expect(proof.galaxyCanvas.style.visibility).toBe("visible");
  expect(proof.galaxyCanvas.style.opacity).toBe(1);
  expect(proof.galaxyCanvas.style.pointerEvents).toBe("auto");
  expect(Math.abs(proof.galaxyCanvas.rect.left), `${viewportLabel} canvas begins at viewport left`).toBeLessThanOrEqual(1);
  expect(Math.abs(proof.galaxyCanvas.rect.top), `${viewportLabel} canvas begins at viewport top`).toBeLessThanOrEqual(1);
  expect(Math.abs(proof.galaxyCanvas.rect.width - proof.viewport.width), `${viewportLabel} canvas spans viewport width`).toBeLessThanOrEqual(1);
  expect(Math.abs(proof.galaxyCanvas.rect.height - proof.viewport.height), `${viewportLabel} canvas spans viewport height`).toBeLessThanOrEqual(1);
  expect(proof.galaxyCanvas.backing.width).toBeGreaterThanOrEqual(proof.galaxyCanvas.rect.width);
  expect(proof.galaxyCanvas.backing.height).toBeGreaterThanOrEqual(proof.galaxyCanvas.rect.height);

  const exactDiagnostics = proof.diagnostics!;
  expect(exactDiagnostics.version).toBe(canonicalGalaxyVersion);
  expect(exactDiagnostics.sourceArtifact).toBe("NUR_V197_HALO_FREE.html");
  expect(exactDiagnostics.artifactSha256).toBe(exactGalaxySha256);
  expect(exactDiagnostics.stars).toBe(2662);
  expect(exactDiagnostics.particles).toBe(2662);
  expect(exactDiagnostics.ambient).toBe(222);
  expect(exactDiagnostics.ambientStars).toBe(222);
  expect(exactDiagnostics.presentedHz).toBeGreaterThan(0);
  expect(exactDiagnostics.haloLayer).toBe(false);
  expect(exactDiagnostics.renderer).toBe("exact-halo-free-iframe");
  expect(exactDiagnostics.viewport).toEqual(proof.viewport);
  expect(exactDiagnostics.backingStore.width).toBe(proof.galaxyCanvas.backing.width);
  expect(exactDiagnostics.backingStore.height).toBe(proof.galaxyCanvas.backing.height);
  expect(proof.galaxyCanvas.pixelSignal.litSamples, `${viewportLabel} canvas contains painted stars`).toBeGreaterThan(30);
  expect(proof.galaxyCanvas.pixelSignal.spreadWidth, `${viewportLabel} star field has horizontal depth`)
    .toBeGreaterThan(proof.viewport.width * .2);
  expect(proof.galaxyCanvas.pixelSignal.spreadHeight, `${viewportLabel} star field has vertical depth`)
    .toBeGreaterThan(proof.viewport.height * .15);

  expect(proof.brain.hostCount, `${viewportLabel} restores one exact star-brain host`).toBe(1);
  expect(proof.brain.visible, `${viewportLabel} exact star-brain host is visible`).toBe(true);
  expect(proof.brain.state).toBe("ready");
  expect(proof.brain.sha256).toBe(exactBrainSha256);
  expect(proof.brain.engine).toBe("canvas2d-exact-artifact-v1");
  expect(proof.brain.frameCount, `${viewportLabel} exact artifact frame is singular`).toBe(1);
  expect(proof.brain.frameState).toBe("ready");
  expect(proof.brain.frameSha256).toBe(exactBrainSha256);
  expect(proof.brain.legacyCanvasCount).toBe(0);
  expect(proof.brain.canvasPresent).toBe(true);
  expect(proof.brain.title).toMatch(/click: cycle rainbow color.+double-click: dissolve\/spread.+scroll to zoom/);
  expect(proof.brain.paintedSamples, `${viewportLabel} exact brain paints real star pixels`).toBeGreaterThan(100);
  return proof;
}

function universeFrame(page: Page): FrameLocator {
  return page.frameLocator("#nur-universe-stage");
}

function catalogFilename(locale: string, writingPreference: "default" | "roman" | "script") {
  if (locale === "ur") return `ur-${writingPreference}.json`;
  if (locale === "hi") return `hi-${writingPreference}.json`;
  return `${locale}.json`;
}

async function activeCatalogCopy(
  locale: string,
  writingPreference: "default" | "roman" | "script",
  key: string,
) {
  const webRoot = process.cwd().endsWith("/apps/web") ? process.cwd() : join(process.cwd(), "apps/web");
  const raw = await readFile(join(webRoot, "src/i18n/catalogs", catalogFilename(locale, writingPreference)), "utf8");
  const value = (JSON.parse(raw) as Record<string, unknown>)[key];
  expect(typeof value, `${locale}:${writingPreference} has catalog value for ${key}`).toBe("string");
  expect(String(value).trim(), `${locale}:${writingPreference} has nonblank catalog value for ${key}`).not.toBe("");
  return String(value);
}

function overlaps(a: Awaited<ReturnType<typeof box>>, b: Awaited<ReturnType<typeof box>>, pad = 0) {
  return !(
    a.x + a.width + pad <= b.x ||
    b.x + b.width + pad <= a.x ||
    a.y + a.height + pad <= b.y ||
    b.y + b.height + pad <= a.y
  );
}

function assertNoOverlap(label: string, a: Awaited<ReturnType<typeof box>>, b: Awaited<ReturnType<typeof box>>, pad = 0) {
  expect(overlaps(a, b, pad), `${label}: ${JSON.stringify({ a, b, pad })}`).toBe(false);
}

async function assertNoHorizontalOverflow(frame: FrameLocator) {
  const overflow = await frame.locator("html").evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
  expect(overflow.documentScrollWidth, "document has no horizontal overflow").toBeLessThanOrEqual(overflow.documentClientWidth + 1);
  expect(overflow.bodyScrollWidth, "body has no horizontal overflow").toBeLessThanOrEqual(overflow.bodyClientWidth + 1);
}

async function assertEqualControlGroup(locator: Locator, count: number, label: string) {
  await expect(locator, `${label} count`).toHaveCount(count);
  const metrics = await locator.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      text: element.textContent?.trim() ?? "",
      width: rect.width,
      height: rect.height,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      whiteSpace: style.whiteSpace,
    };
  }));
  const widths = metrics.map(metric => metric.width);
  const heights = metrics.map(metric => metric.height);
  expect(Math.max(...widths) - Math.min(...widths), `${label} widths: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(1);
  expect(Math.max(...heights) - Math.min(...heights), `${label} heights: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(1);
  expect(widths[0], `${label} uses the balanced shared action width`).toBeCloseTo(144, 0);
  expect(heights[0], `${label} uses the shared control height`).toBeCloseTo(38, 0);
  for (const metric of metrics) {
    expect(metric.whiteSpace, `${label} ${metric.text} stays on one line`).toBe("nowrap");
    expect(metric.scrollWidth, `${label} ${metric.text} fits horizontally`).toBeLessThanOrEqual(metric.clientWidth + 1);
    expect(metric.scrollHeight, `${label} ${metric.text} fits vertically`).toBeLessThanOrEqual(metric.clientHeight + 1);
  }
}

async function assertBoundaryControlsStyled(frame: FrameLocator) {
  const modal = frame.locator("#scope-modal .scope-modal");
  await expect(modal).toBeVisible();
  const snapshot = await modal.evaluate(el => {
    const document = el.ownerDocument;
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
    };
    const controlStyle = (element: Element) => {
      const style = getComputedStyle(element);
      return {
        visible: visible(element),
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        color: style.color,
      };
    };
    const modalStyle = getComputedStyle(el);
    return {
      modalStyle: {
        backgroundColor: modalStyle.backgroundColor,
        backgroundImage: modalStyle.backgroundImage,
        boxShadow: modalStyle.boxShadow,
        backdropFilter: modalStyle.backdropFilter,
        borderRadius: modalStyle.borderRadius,
      },
      allControlCount: document.querySelectorAll("#scope-modal .scope-option").length,
      boundaryOptions: [...document.querySelectorAll("#scope-modal .scope-option[data-scope]")].map(controlStyle),
      languageControls: [...document.querySelectorAll(
        "#nur-v197-locale, #nur-v197-writing-preference, #nur-v197-language-save",
      )].map(controlStyle),
    };
  });
  const { modalStyle } = snapshot;
  expect(modalStyle.backgroundColor, "boundary modal is transparent").toBe("rgba(0, 0, 0, 0)");
  expect(modalStyle.backgroundImage, "boundary modal has no opaque material layer").toBe("none");
  expect(modalStyle.boxShadow, "boundary modal has no panel glow").toBe("none");
  expect(modalStyle.backdropFilter, "boundary modal has no frosted tint").toBe("none");
  expect(Number.parseFloat(modalStyle.borderRadius), "boundary modal keeps the approved V197 radius").toBe(8);

  expect(snapshot.allControlCount, "boundary modal control count").toBe(7);
  expect(snapshot.boundaryOptions, "boundary option count").toHaveLength(4);
  for (const [index, style] of snapshot.boundaryOptions.entries()) {
    expect(style.visible, `boundary option ${index} is visible`).toBe(true);
    expect(style.backgroundColor, `boundary option ${index} is not native white`).not.toBe("rgb(255, 255, 255)");
    expect(Number.parseFloat(style.borderRadius), `boundary option ${index} has softened edges`).toBeGreaterThanOrEqual(8);
  }

  expect(snapshot.languageControls, "language control count").toHaveLength(3);
  for (const [index, style] of snapshot.languageControls.entries()) {
    expect(style.visible, `language control ${index} is visible`).toBe(true);
    expect(style.backgroundColor, `language control ${index} is not native white`).not.toBe("rgb(255, 255, 255)");
  }
}

async function assertUrduDirection(frame: FrameLocator, writingPreference: "roman" | "script") {
  const root = frame.locator("html");
  const expectedDirection = writingPreference === "script" ? "rtl" : "ltr";
  await expect(root).toHaveAttribute("lang", "ur");
  await expect(root).toHaveAttribute("dir", expectedDirection);
  const direction = await root.evaluate(el => ({
    direction: getComputedStyle(el).direction,
    writingPreference: document.body.dataset.nurWritingPreference,
  }));
  expect(direction.direction).toBe(expectedDirection);
  expect(direction.writingPreference).toBe(writingPreference);
}

async function assertSystemsMapGeometry(
  page: Page,
  viewportLabel: string,
  locale = "en",
  writingPreference: "default" | "roman" | "script" = "default",
) {
  const frame = universeFrame(page);
  await expect(frame.locator("#page-systems")).toBeVisible();
  const viewport = page.viewportSize();
  const mapPanelLocator = frame.locator(".universe-map-panel");
  await expect(mapPanelLocator).toBeVisible();
  await expect(frame.locator(".universe-map-title .nur-v197-stable-wordmark")).toBeVisible();
  await expect(frame.locator(".universe-map-title small")).toBeVisible();
  await assertCanonicalGalaxyRuntime(page, viewportLabel);
  const snapshot = await mapPanelLocator.evaluate(mapPanelElement => {
    const document = mapPanelElement.ownerDocument;
    const stageWindow = document.defaultView;
    if (!stageWindow) throw new Error("V197 stage window is unavailable");
    const getComputedStyle = stageWindow.getComputedStyle.bind(stageWindow);
    type Rect = { x: number; y: number; width: number; height: number };
    const visible = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden";
    };
    const rect = (element: Element | null): Rect | null => {
      if (!visible(element)) return null;
      const value = element!.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height };
    };
    const title = document.querySelector(".universe-map-title .nur-v197-stable-wordmark");
    const subtitle = document.querySelector(".universe-map-title small");
    const addControl = document.querySelector(".universe-add-system");
    const commandRow = document.querySelector<HTMLElement>(".universe-command-row");
    const commandRect = rect(commandRow);
    const commandStyle = commandRow ? getComputedStyle(commandRow) : null;
    const metrics = [...document.querySelectorAll<HTMLElement>(".universe-hero-stats > span")].map(element => {
      const value = element.getBoundingClientRect();
      return {
        visible: visible(element),
        text: element.textContent ?? "",
        width: value.width,
        scrollWidth: element.scrollWidth,
        height: value.height,
        scrollHeight: element.scrollHeight,
        whiteSpace: getComputedStyle(element).whiteSpace,
      };
    });
    return {
      title: rect(title),
      subtitle: rect(subtitle),
      masterVisible: visible(document.querySelector(".universe-master-star")),
      add: { visible: visible(addControl), rect: rect(addControl) },
      field: rect(document.querySelector(".universe-field-readout")),
      nodes: [...document.querySelectorAll<HTMLElement>(".universe-system-node")]
        .filter(visible)
        .map(element => ({
          rect: rect(element)!,
          classes: [...element.classList],
          labelVisible: visible(element.querySelector("b")),
          fit: {
            width: element.clientWidth,
            scrollWidth: element.scrollWidth,
            height: element.clientHeight,
            scrollHeight: element.scrollHeight,
          },
        })),
      topbar: rect(document.querySelector(".nur-topbar")),
      command: {
        rect: commandRect,
        display: commandStyle?.display ?? "none",
        gridTemplateColumns: commandStyle?.gridTemplateColumns ?? "",
        scrollWidth: commandRow?.scrollWidth ?? 0,
        clientWidth: commandRow?.clientWidth ?? 0,
        scrollHeight: commandRow?.scrollHeight ?? 0,
        clientHeight: commandRow?.clientHeight ?? 0,
        controls: commandRow && commandRect
          ? [...commandRow.querySelectorAll<HTMLElement>(".world-command")].map(control => {
              const value = control.getBoundingClientRect();
              return {
                inside: value.left >= commandRect.x - 1
                  && value.right <= commandRect.x + commandRect.width + 1,
                height: value.height,
              };
            })
          : [],
      },
      metrics,
      mapPanel: rect(mapPanelElement),
      overflow: {
        documentScrollWidth: document.documentElement.scrollWidth,
        documentClientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
      },
    };
  });
  expect(snapshot.title, `${viewportLabel} NUR wordmark is visible`).not.toBeNull();
  expect(snapshot.subtitle, `${viewportLabel} map subtitle is visible`).not.toBeNull();
  expect(snapshot.masterVisible, `${viewportLabel} exact star-brain host is visible`).toBe(true);
  const title = snapshot.title!;
  const subtitle = snapshot.subtitle!;
  const add = snapshot.add.rect ?? { x: -1000, y: -1000, width: 1, height: 1 };
  const nodeBoxes = snapshot.nodes.map(node => node.rect);

  assertNoOverlap(
    `${viewportLabel}: System Field/title collision`,
    title,
    snapshot.field ?? { x: -1000, y: -1000, width: 1, height: 1 },
    6,
  );
  assertNoOverlap(`${viewportLabel}: Add System/title collision`, add, title, 8);

  for (const [index, node] of nodeBoxes.entries()) {
    expect(node.width, `${viewportLabel} map node ${index} has width`).toBeGreaterThan(0);
    expect(node.height, `${viewportLabel} map node ${index} has height`).toBeGreaterThan(0);
    assertNoOverlap(`${viewportLabel}: node ${index} covers NUR title`, node, title, 4);
    assertNoOverlap(`${viewportLabel}: node ${index} covers Neural subtitle`, node, subtitle, 4);
    assertNoOverlap(`${viewportLabel}: Add System covers node label ${index}`, add, node, 4);
  }

  if (viewport?.width === 1280) {
    const node = (className: string) => snapshot.nodes.find(value => value.classes.includes(className));
    const ambitionNode = node("quiet");
    const introspectionNode = node("embodied");
    const connectionNode = node("relational");
    expect(ambitionNode, "1280 Ambition label is present").toBeDefined();
    expect(introspectionNode, "1280 Introspection label is present").toBeDefined();
    expect(connectionNode, "1280 Connection label is present").toBeDefined();
    const ambition = ambitionNode!.rect;
    const introspection = introspectionNode!.rect;
    const connection = connectionNode!.rect;
    assertNoOverlap("1280: Ambition and Introspection have horizontal air", ambition, introspection, 18);
    assertNoOverlap("1280: Ambition and Connection have diagonal air", ambition, connection, 18);
    assertNoOverlap("1280: Introspection and Connection have vertical air", introspection, connection, 18);
    for (const selectedNode of [ambitionNode!, introspectionNode!, connectionNode!]) {
      expect(selectedNode.labelVisible, "1280 node label is visible").toBe(true);
      const fit = selectedNode.fit;
      expect(fit.scrollWidth, "1280 selected label text does not clip horizontally").toBeLessThanOrEqual(fit.width + 2);
      expect(fit.scrollHeight, "1280 selected label text does not clip vertically").toBeLessThanOrEqual(fit.height + 2);
    }
  }

  if (viewport && viewport.width <= 620) {
    expect(snapshot.topbar, "mobile top nav is visible").not.toBeNull();
    const topbar = snapshot.topbar!;
    expect(topbar.y, "mobile top nav is not clipped at the top").toBeGreaterThanOrEqual(0);
    expect(topbar.y + topbar.height, "mobile top nav stays inside its own opening area").toBeLessThanOrEqual(92);

    expect(snapshot.command.rect, "mobile chips row is visible").not.toBeNull();
    const command = snapshot.command.rect!;
    const commandFlow = snapshot.command;
    expect(commandFlow.display, "mobile commands use the approved wrapped grid").toBe("grid");
    expect(commandFlow.gridTemplateColumns.split(" ")).toHaveLength(2);
    expect(commandFlow.scrollWidth, "mobile commands do not clip horizontally").toBeLessThanOrEqual(commandFlow.clientWidth + 1);
    expect(commandFlow.scrollHeight, "mobile commands do not clip vertically").toBeLessThanOrEqual(commandFlow.clientHeight + 1);
    expect(commandFlow.controls).toHaveLength(2);
    expect(commandFlow.controls.every(control => control.inside), "all mobile commands stay inside their grid").toBe(true);
    expect(Math.min(...commandFlow.controls.map(control => control.height)), "mobile commands keep a 44px hit height").toBeGreaterThanOrEqual(44);
    expect(command.height, "mobile command grid has a visible layout box").toBeGreaterThanOrEqual(44);

    const expectedMetrics = [
      { index: 1, label: "outcomes returned metric", text: await activeCatalogCopy(locale, writingPreference, "ui.0747") },
      { index: 2, label: "insights evolving metric", text: await activeCatalogCopy(locale, writingPreference, "ui.0748") },
    ];
    for (const expected of expectedMetrics) {
      const metric = snapshot.metrics[expected.index];
      expect(metric?.visible, `${expected.label} is visible`).toBe(true);
      expect(metric?.text, `${expected.label} contains its localized label`).toContain(expected.text);
      expect(metric?.text ?? "").not.toMatch(/ev\.\.\.|insights ev\.\.\./i);
      expect(metric!.scrollWidth, `${expected.label} does not clip horizontally`).toBeLessThanOrEqual(metric!.width + 3);
      expect(metric!.scrollHeight, `${expected.label} does not clip vertically`).toBeLessThanOrEqual(metric!.height + 3);
    }
    expect(snapshot.add.visible, "mobile intentionally removes the desktop-only Add System control").toBe(false);
    expect(snapshot.mapPanel, "mobile systems map is visible").not.toBeNull();
    const mapPanel = snapshot.mapPanel!;
    for (const [index, node] of nodeBoxes.entries()) {
      expect(node.x, `mobile map node ${index} begins inside the map`).toBeGreaterThanOrEqual(mapPanel.x - 1);
      expect(node.x + node.width, `mobile map node ${index} stays inside the map width`).toBeLessThanOrEqual(mapPanel.x + mapPanel.width + 1);
      expect(node.y, `mobile map node ${index} begins inside the map height`).toBeGreaterThanOrEqual(mapPanel.y - 1);
      expect(node.y + node.height, `mobile map node ${index} stays inside the map height`).toBeLessThanOrEqual(mapPanel.y + mapPanel.height + 1);
    }
  }

  expect(snapshot.overflow.documentScrollWidth, "document has no horizontal overflow")
    .toBeLessThanOrEqual(snapshot.overflow.documentClientWidth + 1);
  expect(snapshot.overflow.bodyScrollWidth, "body has no horizontal overflow")
    .toBeLessThanOrEqual(snapshot.overflow.bodyClientWidth + 1);
}

test("systems map has DOM anti-overlap proof at primary desktop and mobile breakpoints", async ({ page }, testInfo) => {
  await installVisualMocks(page);
  const mobileProject = testInfo.project.name.endsWith("-mobile");
  const viewport = mobileProject ? { width: 393, height: 852 } : { width: 1440, height: 900 };
  const label = mobileProject ? "393x852" : "1440x900";
  await page.setViewportSize(viewport);
  await page.goto("/systems");
  await assertSystemsMapGeometry(page, label);
  await locatorScreenshot(
    universeFrame(page).locator(".universe-map-panel"),
    `systems-map-exact-brain-${label}.png`,
  );
  if (mobileProject) {
    const source = "systems-overlap-proof-393x852.png";
    await screenshot(page, source);
    await duplicateProofImage(source, "systems-mobile-clean-393x852.png");
  } else {
    await screenshot(page, "systems-overlap-proof-1440x900.png");
  }
});

test("systems map keeps label breathing at secondary desktop and mobile breakpoints", async ({ page }, testInfo) => {
  await installVisualMocks(page);
  const mobileProject = testInfo.project.name.endsWith("-mobile");
  const viewport = mobileProject ? { width: 430, height: 932 } : { width: 1280, height: 720 };
  const label = mobileProject ? "430x932" : "1280x720";
  await page.setViewportSize(viewport);
  await page.goto("/systems");
  await assertSystemsMapGeometry(page, label);
  if (mobileProject) {
    const source = "systems-overlap-proof-430x932.png";
    await screenshot(page, source);
    await duplicateProofImage(source, "systems-mobile-clean-430x932.png");
  } else {
    await screenshot(page, "systems-overlap-proof-1280x720.png");
    await screenshot(page, "systems-1280-label-breathing.png");
  }
});

test("Today and Systems controls keep one proportional geometry contract with local Research staging", async ({ page }, testInfo) => {
  await installVisualMocks(page);
  const mobile = testInfo.project.name.endsWith("-mobile");
  await page.setViewportSize(mobile ? { width: 393, height: 852 } : { width: 1440, height: 900 });
  const frame = universeFrame(page);

  await page.goto("/systems");
  await expect(frame.locator("#page-systems")).toBeVisible();
  await expect(frame.locator("#universe-research")).toBeVisible();
  await expect(frame.locator("#research-staging")).toBeVisible();
  await expect(frame.locator("#research-query")).toBeVisible();
  await expect(frame.locator("[data-research-submit]")).toBeVisible();
  await expect(frame.locator(".universe-command-row .world-command")).toHaveCount(2);
  await assertCanonicalGalaxyRuntime(page, mobile ? "393x852 Systems" : "1440x900 Systems");

  if (!mobile) {
    const fit = await frame.locator("#page-systems").evaluate(element => {
      const page = element.getBoundingClientRect();
      const viewport = element.closest<HTMLElement>(".nur-viewport");
      return {
        innerHeight,
        pageTop: page.top,
        pageBottom: page.bottom,
        viewportClientHeight: viewport?.clientHeight ?? 0,
        viewportScrollHeight: viewport?.scrollHeight ?? 0,
      };
    });
    expect(fit.pageTop, "Systems begins below the topbar").toBeGreaterThanOrEqual(0);
    expect(fit.pageBottom, "Systems fits in the desktop viewport without a lower fold")
      .toBeLessThanOrEqual(fit.innerHeight + 1);
    expect(fit.viewportScrollHeight, "Systems does not require viewport scrolling")
      .toBeLessThanOrEqual(fit.viewportClientHeight + 1);
  }

  const activeGlyph = frame.locator('.clean-nav-button.active[data-page="systems"] > .clean-nav-glyph');
  if (!mobile) {
    await expect(activeGlyph).toBeVisible();
    // The state seal is injected asynchronously by the bridge's star-seal
    // decoration; evaluating before it lands dereferences null (the one
    // observed CI flake in this spec). Wait for the decoration explicitly.
    await expect(activeGlyph.locator(".nur-star-seal--state")).toBeVisible();
    const activeState = await activeGlyph.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const seal = element.querySelector<HTMLElement>(":scope > .nur-star-seal--state")!;
      const sealRect = seal.getBoundingClientRect();
      const star = seal.querySelector<HTMLElement>(":scope > .nur-v197-sigil-star")!;
      const style = getComputedStyle(element);
      const starStyle = getComputedStyle(star);
      return {
        fontSize: style.fontSize,
        color: style.color,
        centerDeltaX: Math.abs((rect.left + rect.width / 2) - (sealRect.left + sealRect.width / 2)),
        centerDeltaY: Math.abs((rect.top + rect.height / 2) - (sealRect.top + sealRect.height / 2)),
        starDisplay: starStyle.display,
        starVisibility: starStyle.visibility,
        starOpacity: Number(starStyle.opacity),
      };
    });
    expect(activeState.fontSize, "selected navigation removes the native glyph footprint").toBe("0px");
    expect(activeState.color, "selected navigation hides the native glyph paint").toBe("rgba(0, 0, 0, 0)");
    expect(activeState.centerDeltaX, "selected navigation seal is centered horizontally").toBeLessThanOrEqual(1);
    expect(activeState.centerDeltaY, "selected navigation seal is centered vertically").toBeLessThanOrEqual(1);
    expect(activeState.starDisplay).toBe("block");
    expect(activeState.starVisibility).toBe("visible");
    expect(activeState.starOpacity).toBe(1);

    const addSystem = await frame.locator(".universe-add-system").evaluate(element => {
      const rect = element.getBoundingClientRect();
      const plus = element.querySelector<HTMLElement>(":scope > span")!;
      const plusRect = plus.getBoundingClientRect();
      const plusStyle = getComputedStyle(plus);
      return {
        centerDeltaY: Math.abs((rect.top + rect.height / 2) - (plusRect.top + plusRect.height / 2)),
        display: plusStyle.display,
        placeItems: plusStyle.placeItems,
      };
    });
    expect(addSystem.centerDeltaY, "Add System plus circle is vertically centered").toBeLessThanOrEqual(1);
    expect(addSystem.display).toBe("grid");
    expect(addSystem.placeItems).toBe("center");
  }

  await page.goto("/today");
  await expect(frame.locator("#page-today")).toBeVisible();
  await assertEqualControlGroup(frame.locator("#page-today .tiny-link"), 3, "Today panel actions");
  await assertCanonicalGalaxyRuntime(page, mobile ? "393x852 Today" : "1440x900 Today");
  const sendStar = frame.locator("#page-today .thought-send-button[data-send='today'] .nur-v197-sigil-star");
  await expect(sendStar).toBeVisible();
  await expect(sendStar).toHaveCSS("display", "block");
  await expect(sendStar).toHaveCSS("visibility", "visible");
  await expect(sendStar).toHaveCSS("opacity", "1");
  await expect(frame.locator("#page-today .thought-send-button[data-send='today'] .ray").first())
    .toHaveCSS("visibility", "visible");
  await expect(frame.locator(".nur-v178-warmth-film")).toHaveCSS("display", "none");
  await assertNoHorizontalOverflow(frame);

  if (!mobile) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/systems");
    const selectedScope = frame.locator(".clean-right-rail :is(.audit-scope.selected, .clean-scope.selected, .scope-option[aria-selected='true'], .scope-option[aria-checked='true'])");
    await expect(selectedScope).toBeVisible();
    // Same async star-seal decoration race the active glyph above guards against:
    // the selected scope's copy span and state seal are injected after the option
    // becomes visible, and the geometry read below dereferences both. Evaluating
    // too early null-derefs `seal.getBoundingClientRect()` — the CI-only flake seen
    // at 3102b48 (visual-readiness.spec.ts:628). Wait for both children to land.
    await expect(selectedScope.locator(":scope > span")).toBeVisible();
    await expect(selectedScope.locator(":scope > .nur-star-seal--state")).toBeVisible();
    const selectedGeometry = await selectedScope.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const copy = element.querySelector<HTMLElement>(":scope > span")!;
      const copyRect = copy.getBoundingClientRect();
      const seal = element.querySelector<HTMLElement>(":scope > .nur-star-seal--state")!;
      const sealRect = seal.getBoundingClientRect();
      return {
        copyDeltaX: Math.abs((rect.left + rect.width / 2) - (copyRect.left + copyRect.width / 2)),
        copyDeltaY: Math.abs((rect.top + rect.height / 2) - (copyRect.top + copyRect.height / 2)),
        sealDeltaY: Math.abs((rect.top + rect.height / 2) - (sealRect.top + sealRect.height / 2)),
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
      };
    });
    expect(selectedGeometry.copyDeltaX, "selected scope copy stays horizontally centered").toBeLessThanOrEqual(1);
    expect(selectedGeometry.copyDeltaY, "selected scope copy stays vertically centered").toBeLessThanOrEqual(1);
    expect(selectedGeometry.sealDeltaY, "selected scope seal does not drop below its copy").toBeLessThanOrEqual(1);
    expect(selectedGeometry.scrollWidth, "selected scope does not clip horizontally").toBeLessThanOrEqual(selectedGeometry.clientWidth + 1);
    expect(selectedGeometry.scrollHeight, "selected scope does not clip vertically").toBeLessThanOrEqual(selectedGeometry.clientHeight + 1);
  }
});

test("RTL screenshots cover Talk and Systems", async ({ page }, testInfo) => {
  await installVisualMocks(page, "ur", "script");
  const mobileProject = testInfo.project.name.endsWith("-mobile");
  const viewport = mobileProject ? { width: 393, height: 852 } : { width: 1280, height: 720 };
  const suffix = mobileProject ? "mobile-393x852" : "1280x720";
  await page.setViewportSize(viewport);
  const frame = universeFrame(page);

  await page.goto("/talk");
  await expect(frame.locator("#page-talk")).toBeVisible();
  await assertUrduDirection(frame, "script");
  await screenshot(page, `rtl-talk-${suffix}.png`);

  await page.goto("/systems");
  await expect(frame.locator("#page-systems")).toBeVisible();
  await screenshot(page, `rtl-systems-${suffix}.png`);
});

test("RTL screenshots cover Share Orbit", async ({ page }, testInfo) => {
  await installVisualMocks(page, "ur", "script");
  const mobileProject = testInfo.project.name.endsWith("-mobile");
  const viewport = mobileProject ? { width: 393, height: 852 } : { width: 1280, height: 720 };
  const suffix = mobileProject ? "mobile-393x852" : "1280x720";
  await page.setViewportSize(viewport);
  const frame = universeFrame(page);

  await page.goto("/systems");
  await expect(frame.locator("#page-systems")).toBeVisible();
  await frame.locator("#scope-open").click();
  const sheet = frame.locator("#scope-modal .scope-modal");
  await expect(sheet).toBeVisible();
  await sheet.evaluate(el => { el.scrollTop = 0; });
  await assertBoundaryControlsStyled(frame);
  await sheet.evaluate(el => { el.scrollTop = 0; });
  await screenshot(page, `rtl-share-orbit-${suffix}.png`);
  await locatorScreenshot(sheet, `rtl-share-orbit-full-modal-top-${suffix}.png`);
});

test("RTL screenshot covers Capsule", async ({ page }, testInfo) => {
  await installVisualMocks(page, "ur", "script");
  const mobileProject = testInfo.project.name.endsWith("-mobile");
  const viewport = mobileProject ? { width: 393, height: 852 } : { width: 1280, height: 720 };
  const suffix = mobileProject ? "mobile-393x852" : "1280x720";
  await page.setViewportSize(viewport);
  const frame = universeFrame(page);

  await page.goto("/capsule/cap-active");
  await expect(frame.locator("#nur-v197-adjunct-root")).toBeVisible();
  await screenshot(page, `rtl-capsule-${suffix}.png`);
});

test("Roman Urdu keeps Talk LTR", async ({ page }) => {
  await installVisualMocks(page, "ur", "roman");
  await page.setViewportSize({ width: 393, height: 852 });
  const frame = universeFrame(page);
  await page.goto("/talk");
  await expect(frame.locator("#page-talk")).toBeVisible();
  await assertUrduDirection(frame, "roman");
});

test("capsule room active chamber is polished and bounded", async ({ page }) => {
  await installVisualMocks(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/capsule/cap-active");
  const frame = universeFrame(page);
  const capsule = frame.locator("#nur-v197-adjunct-root");
  await expect(capsule).toBeVisible();
  await expect(capsule.locator(".nur-adjunct-fact").filter({ hasText: "State" }).locator("strong")).toHaveText("ACTIVE");
  await expect(capsule.locator(".nur-adjunct-boundary")).toContainText("does not speak for");
  await screenshot(page, "capsule-room-active-top-card-readability-1280x720.png");
});

test("mobile visual evidence covers Systems, RTL Talk, and Share Orbit capture", async ({ page }, testInfo) => {
  test.skip(!["webkit-mobile", "chromium-mobile"].includes(testInfo.project.name), "mobile evidence lane only.");
  /*
   * This case navigates three surfaces and takes several full-page captures of
   * an interface that animates continuously by design — `page.screenshot` waits
   * for visual stability, and a live star field never fully stops.
   *
   * It ran comfortably under Playwright's default 30s while the galaxy was
   * degraded: the nebula disabled, the far-plane spikes removed and the frame
   * rate capped at 20.8 FPS on mobile. Restoring those is a product
   * requirement, and it costs about 31.5s on the CI runner.
   *
   * The budget is raised for this capture case only. No assertion is relaxed
   * and no other test's timeout changes; what grew is the amount of real work
   * being photographed.
   */
  test.setTimeout(90_000);
  const prefix = testInfo.project.name === "webkit-mobile" ? "webkit" : "chromium";
  await installVisualMocks(page, "ur", "script");
  await page.setViewportSize({ width: 393, height: 852 });
  const frame = universeFrame(page);

  await page.goto("/systems");
  await expect(frame.locator("#page-systems")).toBeVisible();
  await assertSystemsMapGeometry(page, `${prefix}-393x852`, "ur", "script");
  await screenshot(page, `systems-${prefix}-mobile-393x852.png`);

  await page.goto("/talk");
  await expect(frame.locator("#page-talk")).toBeVisible();
  await assertUrduDirection(frame, "script");
  await screenshot(page, `rtl-talk-${prefix}-mobile-393x852.png`);

  await page.goto("/systems");
  await frame.locator("#scope-open").click();
  const sheet = frame.locator("#scope-modal .scope-modal");
  await expect(sheet).toBeVisible();
  await assertBoundaryControlsStyled(frame);
  await screenshot(page, `rtl-share-orbit-${prefix}-mobile-393x852.png`);
});
