import { v197Copy } from "./v197I18n";
import { ensureV197AccessibleViewport } from "./v197Accessibility";
import { disposeV197CelestialRuntime } from "./v197CelestialRuntime";
import {
  installV197CooperativeFrameClient,
  type V197CooperativeFrameClient,
} from "./v197CooperativeFrameHub";

export const V197_STAR_BRAIN_HOST_ID = "front-nur-star";
export const V197_EXACT_STAR_BRAIN_FRAME_ID = "nur-exact-brain-frame";
export const V197_EXACT_STAR_BRAIN_PATH =
  "/v197/NUR_V197_BRAIN_EXACT_GALAXY_STARS_RADIANT_OUTER_ANATOMY_TRANSPARENT_ULTRA_SMOOTH.html";
export const V197_EXACT_STAR_BRAIN_SHA256 =
  "60c8e2db5b3457fb079b075808e537c63441e233d72b0f3301f4bff4e9db2ce0";
const V197_SPECTRUM_NAMES = [
  "red", "orange", "yellow", "green", "blue", "indigo", "violet",
] as const;
const V197_EXACT_BRAIN_ENGINE = "canvas2d-exact-artifact-v1";

type V197StarBrainSurface = "entry" | "today" | "universe";

const V197_DEDICATED_WORLD_SURFACES = new Set([
  "map", "orbits", "timeline", "insights",
]);

type V197StarBrainController = {
  observer: MutationObserver;
  frame: number | null;
  resizeListener: () => void;
};

const starBrainControllers = new WeakMap<Document, V197StarBrainController>();
const starBrainHosts = new WeakMap<Document, HTMLElement>();
const starBrainFrames = new WeakMap<Document, HTMLIFrameElement>();
const configuredExactBrainCanvases = new WeakSet<HTMLCanvasElement>();
const exactBrainSchedulers = new WeakMap<Document, V197CooperativeFrameClient>();

type ExactBrainApi = {
  shatter: () => void;
  setTheme: (_color: string, _strength: number) => void;
  getDiagnostics: () => Record<string, unknown>;
  dispose: () => void;
};

type ExactBrainWindow = Window & {
  nurStarBrain?: ExactBrainApi;
};

const exactBrainApis = new WeakMap<Document, ExactBrainApi>();

function removeExternalBrainHalos(document: Document): void {
  document.querySelectorAll(
    "#f4-orbit > .f4-ring, .universe-master-star > .nur-v197-brain-orbit-halo",
  ).forEach(halo => halo.remove());
}

function exactNativeBrainSize(frameWindow: Window): number {
  return frameWindow.innerWidth <= 600
    ? Math.min(frameWindow.innerWidth * .98, 470)
    : Math.min(frameWindow.innerWidth * .56, 700);
}

function applyExactBrainHostGeometry(frameWindow: Window, brainHost: HTMLElement): number {
  const size = exactNativeBrainSize(frameWindow);
  brainHost.style.setProperty("position", "absolute", "important");
  brainHost.style.setProperty("inset", "auto", "important");
  brainHost.style.setProperty("left", "50%", "important");
  brainHost.style.setProperty("top", "50%", "important");
  brainHost.style.setProperty("width", `${size}px`, "important");
  brainHost.style.setProperty("height", `${size}px`, "important");
  brainHost.style.setProperty("max-width", "none", "important");
  brainHost.style.setProperty("max-height", "none", "important");
  brainHost.style.setProperty("transform", "translate(-50%, -50%)", "important");
  brainHost.style.setProperty("overflow", "visible", "important");
  brainHost.style.setProperty("filter", "none", "important");
  brainHost.style.setProperty("mask-image", "none", "important");
  brainHost.style.setProperty("-webkit-mask-image", "none", "important");
  brainHost.dataset.nurNativeSize = String(size);
  return size;
}

function exactBrainPaintedSamples(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext("2d");
  if (!context || canvas.width < 2 || canvas.height < 2) return 0;
  try {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const stride = Math.max(4, Math.floor(pixels.length / 8_000 / 4) * 4);
    let painted = 0;
    for (let index = 3; index < pixels.length; index += stride) {
      if ((pixels[index] ?? 0) > 8) painted += 1;
    }
    return painted;
  } catch {
    return 0;
  }
}

function resolveV197StarBrainHost(document: Document): {
  host: HTMLElement;
  surface: V197StarBrainSurface;
} | null {
  const body = document.body;
  if (
    body?.classList.contains("nur-surface-hosted")
    || V197_DEDICATED_WORLD_SURFACES.has(body?.dataset.nurWorldSurface ?? "")
  ) return null;

  const todayPage = document.querySelector<HTMLElement>("#page-today.active");
  const todayHost = todayPage?.querySelector<HTMLElement>(".orbit-star-zone > .f4-core");
  if (todayHost) return { host: todayHost, surface: "today" };

  const universeHost = document.querySelector<HTMLElement>(
    "body.universe-edition #page-systems.active .universe-map-panel > .universe-master-star",
  );
  if (universeHost) return { host: universeHost, surface: "universe" };

  const entryHost = document.querySelector<HTMLElement>("#nur-front-v61 #f4-core");
  return entryHost ? { host: entryHost, surface: "entry" } : null;
}

function removeLegacyMasterStar(host: HTMLElement, surface: V197StarBrainSurface): void {
  const selector = surface === "universe"
    ? ":scope > .f4-core, :scope > .spark, :scope > .f4-master-star"
    : ":scope > .spark, :scope > .f4-master-star";

  host.querySelectorAll<HTMLElement>(selector).forEach(element => element.remove());
  host.dataset.nurLegacyMasterStar = "removed";
}

export function placeV197StarBrainHost(document: Document): HTMLElement | null {
  const dedicatedSurface = document.body?.classList.contains("nur-surface-hosted")
    || V197_DEDICATED_WORLD_SURFACES.has(document.body?.dataset.nurWorldSurface ?? "");
  document.body?.classList.toggle(
    "nur-v197-systems-active",
    !dedicatedSurface && Boolean(document.querySelector("#page-systems.active")),
  );
  const resolved = resolveV197StarBrainHost(document);
  if (!resolved) return null;
  const { host: canonicalHost, surface } = resolved;
  canonicalHost.dataset.nurStarBrainSurface = surface;
  removeLegacyMasterStar(canonicalHost, surface);
  removeExternalBrainHalos(document);

  let brainHost = (document.getElementById(V197_STAR_BRAIN_HOST_ID) as HTMLElement | null)
    ?? starBrainHosts.get(document)
    ?? null;
  if (!brainHost) {
    brainHost = document.createElement("div");
    brainHost.id = V197_STAR_BRAIN_HOST_ID;
    brainHost.dataset.nurSource = "founder-exact-radiant-outer-anatomy";
    starBrainHosts.set(document, brainHost);
  }
  if (brainHost.parentElement !== canonicalHost) canonicalHost.append(brainHost);
  applyExactBrainHostGeometry(document.defaultView!, brainHost);
  brainHost.dataset.nurSurface = surface;
  brainHost.dataset.nurScaleProfile = "standalone-native-outer-viewport";
  brainHost.dataset.nurDispersal = "radial-circle";
  brainHost.dataset.nurGalaxyPaint = "exact-galaxy-star-language";
  brainHost.dataset.nurRigDepth = "canvas2d-perspective-anatomy";
  brainHost.dataset.nurSpectrumBands = V197_SPECTRUM_NAMES.join(",");
  brainHost.dataset.nurSpectrumBandCount = String(V197_SPECTRUM_NAMES.length);
  brainHost.dataset.nurEngine = V197_EXACT_BRAIN_ENGINE;
  brainHost.dataset.nurArtifactSha256 = V197_EXACT_STAR_BRAIN_SHA256;
  brainHost.dataset.nurEntrySystemsVisualContract = "founder-exact-seven-spectrum-v1";
  brainHost.dataset.nurHaloContract = "halo-free";
  brainHost.title = v197Copy("drag to spin the mind - click: it dissolves into stardust and reforms - double-click: neural storm - scroll to zoom");
  brainHost.setAttribute(
    "aria-label",
    v197Copy("A living brain made of stars. Drag to spin it. Click and it dissolves into tiny star glitter, then flows back together."),
  );
  brainHost.setAttribute("role", "group");
  brainHost.tabIndex = -1;
  return brainHost;
}

function observeV197StarBrainPlacement(document: Document, frameWindow: Window): void {
  if (starBrainControllers.has(document)) return;
  const root = document.body;
  if (!root) return;

  const constructors = frameWindow as unknown as {
    MutationObserver: typeof MutationObserver;
    HTMLElement: typeof HTMLElement;
  };
  const controller: V197StarBrainController = {
    observer: null as unknown as MutationObserver,
    frame: null,
    resizeListener: () => undefined,
  };
  const schedulePlacement = () => {
    if (controller.frame !== null) return;
    controller.frame = frameWindow.requestAnimationFrame(() => {
      controller.frame = null;
      ensureV197StarBrain(document);
    });
  };
  const observer = new constructors.MutationObserver((records: MutationRecord[]) => {
    const routeChanged = records.some(record => (
      record.type === "attributes"
      || Array.from(record.addedNodes).some(node => node instanceof constructors.HTMLElement)
      || Array.from(record.removedNodes).some(node => node instanceof constructors.HTMLElement)
    ));
    if (routeChanged) schedulePlacement();
  });
  controller.resizeListener = schedulePlacement;
  controller.observer = observer;
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "data-nur-page", "data-nur-world-surface"],
  });
  frameWindow.addEventListener("resize", controller.resizeListener, { passive: true });
  starBrainControllers.set(document, controller);
}

/** Mount the founder-supplied HTML byte-for-byte inside the canonical V197 host. */
function configureExactBrainFrame(
  document: Document,
  brainHost: HTMLElement,
  brainFrame: HTMLIFrameElement,
): void {
  const embeddedDocument = brainFrame.contentDocument;
  const embeddedWindow = brainFrame.contentWindow;
  const frameWindow = document.defaultView as ExactBrainWindow | null;
  if (!embeddedDocument || !embeddedWindow || !frameWindow) {
    brainHost.dataset.nurExactBrainState = "unavailable";
    return;
  }

  const orbit = embeddedDocument.querySelector<HTMLElement>(".front-orbit");
  const innerHost = embeddedDocument.getElementById("front-nur-star") as HTMLElement | null;
  const canvas = embeddedDocument.getElementById("nur-brain-canvas-v197") as HTMLCanvasElement | null;
  if (!orbit || !innerHost || !canvas) {
    brainHost.dataset.nurExactBrainState = "missing-runtime-dom";
    return;
  }

  let scheduler = exactBrainSchedulers.get(document);
  if (!scheduler) {
    scheduler = installV197CooperativeFrameClient(frameWindow, embeddedWindow, {
      label: "brain",
    });
    exactBrainSchedulers.set(document, scheduler);
  }
  brainFrame.dataset.nurFrameOwner = "shared-parent-raf";

  // The exact file calculates vw inside its nested iframe. Reapply the same
  // standalone formula against the real outer viewport so it does not shrink
  // from 700px to 299px merely because it is embedded in NUR.
  const nativeSize = exactNativeBrainSize(frameWindow);
  applyExactBrainHostGeometry(frameWindow, brainHost);
  orbit.style.setProperty("opacity", "1", "important");
  innerHost.style.setProperty("left", "50%", "important");
  innerHost.style.setProperty("top", "50%", "important");
  innerHost.style.setProperty("width", `${nativeSize}px`, "important");
  innerHost.style.setProperty("height", `${nativeSize}px`, "important");
  innerHost.style.setProperty("filter", "none", "important");
  innerHost.style.setProperty("mask-image", "none", "important");
  innerHost.style.setProperty("-webkit-mask-image", "none", "important");
  brainHost.dataset.nurEmbeddedResponsiveProfile = "outer-viewport-native-size";

  if (!configuredExactBrainCanvases.has(canvas)) {
    configuredExactBrainCanvases.add(canvas);
    canvas.dataset.nurParentBridgeState = "ready";

    const markInteraction = (value: string) => {
      const currentHost = brainFrame.parentElement as HTMLElement | null;
      if (currentHost) currentHost.dataset.nurLastInteraction = value;
    };

    // Observe the supplied handlers without replacing or modifying them. These
    // markers make the exact click/drag/zoom contract testable from the parent.
    canvas.addEventListener("pointerdown", () => {
      scheduler?.boost();
      markInteraction("pointer-drag");
    }, { capture: true });
    canvas.addEventListener("wheel", () => {
      scheduler?.boost();
      markInteraction("wheel-zoom");
    }, { capture: true });
    canvas.addEventListener("click", () => {
      scheduler?.boost();
      markInteraction("rainbow-cycle");
    }, { capture: true });
    canvas.addEventListener("dblclick", () => {
      scheduler?.boost();
      markInteraction("original-palette-shatter");
    }, { capture: true });
    innerHost.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        scheduler?.boost();
        markInteraction("keyboard-shatter");
      }
    }, { capture: true });
  }

  const exactApi: ExactBrainApi = Object.freeze({
    shatter: () => {
      scheduler?.boost();
      const EventConstructor = (
        embeddedWindow as unknown as { MouseEvent: typeof MouseEvent }
      ).MouseEvent;
      canvas.dispatchEvent(new EventConstructor("dblclick", {
        bubbles: true,
        cancelable: true,
        view: embeddedWindow,
      }));
    },
    // The supplied runtime owns its own seven-color click cycle. Global theme
    // changes must not rewrite that exact palette or its interaction state.
    setTheme: () => undefined,
    getDiagnostics: () => ({
      version: "NUR_V197_BRAIN_EXACT_GALAXY_STARS_RADIANT_OUTER_ANATOMY_TRANSPARENT_ULTRA_SMOOTH",
      artifactSha256: V197_EXACT_STAR_BRAIN_SHA256,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      surface: brainHost.dataset.nurSurface ?? null,
      connected: brainFrame.isConnected,
      scheduler: scheduler?.diagnostics() ?? null,
    }),
    dispose: () => {
      disposeV197StarBrain(document);
    },
  });
  exactBrainApis.set(document, exactApi);
  frameWindow.nurStarBrain = exactApi;
  if (
    brainFrame.dataset.nurExactBrainState !== "ready"
    && brainFrame.dataset.nurExactBrainState !== "warming"
  ) {
    scheduler.boost(1_000);
    brainHost.dataset.nurExactBrainState = "warming";
    brainFrame.dataset.nurExactBrainState = "warming";
    const settlePaint = (attempt = 0): void => {
      if (!brainFrame.isConnected || brainFrame.contentDocument !== embeddedDocument) return;
      const paintedSamples = exactBrainPaintedSamples(canvas);
      brainHost.dataset.nurPaintedSamples = String(paintedSamples);
      brainFrame.dataset.nurPaintedSamples = String(paintedSamples);
      if (paintedSamples > 100) {
        brainHost.dataset.nurExactBrainState = "ready";
        brainFrame.dataset.nurExactBrainState = "ready";
        return;
      }
      if (attempt >= 45) {
        brainHost.dataset.nurExactBrainState = "paint-timeout";
        brainFrame.dataset.nurExactBrainState = "paint-timeout";
        return;
      }
      embeddedWindow.requestAnimationFrame(() => settlePaint(attempt + 1));
    };
    embeddedWindow.requestAnimationFrame(() => settlePaint());
  }
}

export function ensureV197StarBrain(document: Document): HTMLIFrameElement | null {
  ensureV197AccessibleViewport(document);
  const frameWindow = document.defaultView;
  if (!frameWindow) return null;
  observeV197StarBrainPlacement(document, frameWindow);
  const brainHost = placeV197StarBrainHost(document);
  if (!brainHost) {
    detachV197StarBrainMount(document);
    return null;
  }
  brainHost.dataset.nurModel = "exact-galaxy-stars-radiant-outer-anatomy";
  brainHost.dataset.nurVariant = "transparent-ultra-smooth-rainbow-click-double-shatter";
  brainHost.dataset.nurInteractionContract =
    "pointer-drag-wheel-single-rainbow-double-shatter-keyboard-shatter";

  const existing = document.getElementById(V197_EXACT_STAR_BRAIN_FRAME_ID) as HTMLIFrameElement | null;
  if (existing) {
    if (existing.parentElement !== brainHost) brainHost.append(existing);
    starBrainFrames.set(document, existing);
    if (existing.contentDocument?.readyState === "complete") {
      configureExactBrainFrame(document, brainHost, existing);
    }
    return existing;
  }

  disposeV197CelestialRuntime(document);
  document.querySelectorAll("#nur-brain-canvas, #nur-brain-canvas-v197").forEach(node => node.remove());

  const brainFrame = document.createElement("iframe");
  brainFrame.id = "nur-exact-brain-frame";
  brainFrame.src = V197_EXACT_STAR_BRAIN_PATH;
  brainFrame.setAttribute("allowtransparency", "true");
  brainFrame.style.setProperty("background", "transparent", "important");
  brainFrame.title = v197Copy(
    "A living brain made of stars. Drag to spin it. Click and it dissolves into tiny star glitter, then flows back together.",
  );
  brainFrame.loading = "eager";
  brainFrame.dataset.nurArtifactSha256 = V197_EXACT_STAR_BRAIN_SHA256;
  brainFrame.dataset.nurExactBrainState = "loading";
  brainFrame.addEventListener("load", () => {
    configureExactBrainFrame(document, brainHost, brainFrame);
  });
  brainFrame.addEventListener("error", () => {
    brainHost.dataset.nurExactBrainState = "load-error";
    brainFrame.dataset.nurExactBrainState = "load-error";
  });
  brainHost.append(brainFrame);
  brainHost.dataset.nurExactBrainState = "loading";
  starBrainFrames.set(document, brainFrame);
  return brainFrame;
}

function detachV197StarBrainMount(document: Document): boolean {
  const frameWindow = document.defaultView as ExactBrainWindow | null;
  let stopped = false;
  const brainFrame = (
    document.getElementById(V197_EXACT_STAR_BRAIN_FRAME_ID) as HTMLIFrameElement | null
  ) ?? starBrainFrames.get(document) ?? null;
  const scheduler = exactBrainSchedulers.get(document);
  if (scheduler) {
    scheduler.dispose();
    exactBrainSchedulers.delete(document);
    stopped = true;
  }
  if (brainFrame) {
    brainFrame.src = "about:blank";
    brainFrame.remove();
    starBrainFrames.delete(document);
    stopped = true;
  }

  if (frameWindow) delete frameWindow.nurStarBrain;
  exactBrainApis.delete(document);
  removeExternalBrainHalos(document);
  const brainHost = document.getElementById(V197_STAR_BRAIN_HOST_ID);
  if (brainHost) {
    brainHost.remove();
    stopped = true;
  }
  return stopped;
}

/**
 * Hands a surface back from the V43 engine.
 *
 * The runtime is injected as a script into the canonical iframe, so the bridge
 * cannot reach inside its closure — the runtime itself now exposes `dispose`,
 * which cancels its frame loop, disconnects its observers and removes its
 * canvas. Without this the engine kept animating behind every later route and
 * any newer scene became an additional owner rather than a replacement.
 *
 * Returns true when an engine was actually stopped.
 */
export function disposeV197StarBrain(document: Document): boolean {
  const frameWindow = document.defaultView as ExactBrainWindow | null;
  let stopped = disposeV197CelestialRuntime(document);

  const controller = starBrainControllers.get(document);
  if (controller) {
    controller.observer.disconnect();
    if (controller.frame !== null) frameWindow?.cancelAnimationFrame(controller.frame);
    frameWindow?.removeEventListener("resize", controller.resizeListener);
    starBrainControllers.delete(document);
    stopped = true;
  }

  stopped = detachV197StarBrainMount(document) || stopped;

  return stopped;
}
