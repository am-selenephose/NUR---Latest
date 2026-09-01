import { v197Copy } from "./v197I18n";
import {
  installV197CooperativeFrameClient,
  type V197CooperativeFrameClient,
} from "./v197CooperativeFrameHub";

export const V197_EXACT_GALAXY_VERSION = "V197-halo-free-2026.08";
export const V197_EXACT_GALAXY_FRAME_ID = "nur-v197-halo-free-galaxy-frame";
export const V197_EXACT_GALAXY_PATH = "/v197/NUR_V197_HALO_FREE.html";
export const V197_EXACT_GALAXY_SHA256 =
  "315071e23bd82cad1b68179f7efc3728b274ac5b7ffcae5941ceb919efa7773a";

type ExactGalaxyStats = {
  version: string;
  viewport: { width: number; height: number };
  backingStore: { width: number; height: number; dpr: number };
  quality: number;
  qualityCeiling: number;
  refreshHz: number;
  presentedHz: number;
  renderCostMs: number;
  particles: number;
  ambient: number;
  spriteCache: number;
  reducedMotion: boolean;
  rig: {
    yaw: number;
    pitch: number;
    roll: number;
    zoom: number;
    hyperspace: number;
    dim4: number;
    dim5: number;
    targetYaw: number;
    targetPitch: number;
    targetZoom: number;
    targetHyperspace: number;
    targetDim4: number;
    targetDim5: number;
  };
};

type ExactGalaxySourceApi = {
  reset: () => void;
  getStats: () => ExactGalaxyStats;
};

type DisposableRuntime = {
  dispose?: () => void;
};

type ExactGalaxyRuntime = {
  addEvent: () => void;
  burst: () => void;
  setMode: () => void;
  setRotate: () => void;
  setTheme: () => void;
  reset: () => void;
  getParticleCount: () => number;
  getTransientParticleCount: () => number;
  getParticleDiagnostics: () => Record<string, unknown>;
  dispose: () => void;
};

type BrowserWindow = Window & typeof globalThis;

type ExactGalaxyWindow = BrowserWindow & {
  __NUR__?: ExactGalaxySourceApi;
  nurGalaxy?: ExactGalaxyRuntime | DisposableRuntime;
  __nurGalaxy?: ExactGalaxyRuntime | DisposableRuntime;
  NURDiagnostics?: { snapshot: () => Record<string, unknown> };
};

type ExactGalaxyController = {
  frame: HTMLIFrameElement;
  activePointers: Set<number>;
  cleanups: Array<() => void>;
  scheduler: V197CooperativeFrameClient | null;
};

const galaxyControllers = new WeakMap<Document, ExactGalaxyController>();

const BRAIN_SELECTORS = [
  "#nur-brain-canvas",
  "#f4-core > .f4-master-star",
  ".orbit-star-zone > .f4-core > .f4-master-star",
  ".universe-master-star > .f4-core",
  ".universe-master-star > .spark",
].join(",");

const interactionControls = [
  "a", "button", "input", "textarea", "select", "label", "summary", "dialog", "iframe",
  "[contenteditable]", "[role='button']", "[role='dialog']", "[data-action]",
  "[data-page]", "[data-world-focus]", "[data-world-tab]", "[data-owner-route]",
  "[data-system]", "[data-system-slug]", ".universe-system-node", ".universe-add-system",
  "#front-nur-star", "#nur-exact-brain-frame",
].join(",");

const interactionPanelBlockers = [
  ".nur-panel", ".universe-panel", ".universe-card", ".nur-adjunct-root",
  ".nur-rail", ".clean-left-rail", ".clean-right-rail", ".nur-topbar",
  ".global-composer", ".scope-modal", ".modal", ".share-sheet",
].join(",");

const galaxyInteractionSurfaces = "#page-systems .universe-map-panel";

function isBlockedInteractionTarget(target: EventTarget | null): boolean {
  const element = target as Element | null;
  if (!element?.closest) return false;
  if (element.closest(interactionControls)) return true;
  if (element.closest(galaxyInteractionSurfaces)) return false;
  return Boolean(element.closest(interactionPanelBlockers));
}

function disposeSupersededRuntimes(document: Document): void {
  const frameWindow = document.defaultView as ExactGalaxyWindow | null;
  const runtimes = new Set([frameWindow?.nurGalaxy, frameWindow?.__nurGalaxy]);
  for (const runtime of runtimes) {
    try {
      runtime?.dispose?.();
    } catch {
      // The exact replacement must still mount if an obsolete owner cannot release cleanly.
    }
  }
  document.getElementById("nur-v197-canonical-cross-screen-runtime")?.remove();
}

function removeSupersededBrain(document: Document): void {
  document.querySelectorAll(BRAIN_SELECTORS).forEach(element => element.remove());
}

function exactDiagnostics(
  source: ExactGalaxySourceApi,
  controller: ExactGalaxyController,
): Record<string, unknown> {
  const stats = source.getStats();
  return {
    ...stats,
    version: V197_EXACT_GALAXY_VERSION,
    sourceArtifact: "NUR_V197_HALO_FREE.html",
    artifactSha256: V197_EXACT_GALAXY_SHA256,
    stars: stats.particles,
    ambientStars: stats.ambient,
    zoom: stats.rig.zoom,
    targetZoom: stats.rig.targetZoom,
    minZoom: .72,
    maxZoom: 1.7,
    hyperspace: stats.rig.hyperspace,
    targetHyperspace: stats.rig.targetHyperspace,
    dim4: stats.rig.dim4,
    dim5: stats.rig.dim5,
    targetDim4: stats.rig.targetDim4,
    targetDim5: stats.rig.targetDim5,
    activePointerCount: controller.activePointers.size,
    pinchActive: controller.activePointers.size >= 2,
    scheduler: controller.scheduler?.diagnostics() ?? null,
    haloLayer: false,
    renderer: "exact-halo-free-iframe",
  };
}

function installExactGalaxyInputBridge(
  document: Document,
  controller: ExactGalaxyController,
  embeddedWindow: BrowserWindow,
  canvas: HTMLCanvasElement,
): void {
  const { activePointers, cleanups, scheduler } = controller;

  const forwardPointer = (event: PointerEvent) => {
    const PointerEventConstructor = embeddedWindow.PointerEvent;
    canvas.dispatchEvent(new PointerEventConstructor(event.type, {
      bubbles: true,
      cancelable: true,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      button: event.button,
      buttons: event.buttons,
      clientX: event.clientX,
      clientY: event.clientY,
      width: event.width,
      height: event.height,
      pressure: event.pressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    }));
  };

  const onPointerDown = (event: PointerEvent) => {
    if (isBlockedInteractionTarget(event.target)) return;
    scheduler?.boost();
    activePointers.add(event.pointerId);
    // The embedded artifact focuses its canvas on pointerdown. For a bridged
    // event that focus is immediately lost to the real parent pointer target,
    // which makes the untouched artifact clear its drag state. Parent-level
    // keyboard forwarding already owns focus, so suppress only this one call.
    const focus = canvas.focus;
    canvas.focus = () => undefined;
    try {
      forwardPointer(event);
    } finally {
      canvas.focus = focus;
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!activePointers.has(event.pointerId) && isBlockedInteractionTarget(event.target)) return;
    scheduler?.boost();
    forwardPointer(event);
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (!activePointers.has(event.pointerId)) return;
    scheduler?.boost();
    forwardPointer(event);
    activePointers.delete(event.pointerId);
  };
  const onWheel = (event: WheelEvent) => {
    if (isBlockedInteractionTarget(event.target)) return;
    scheduler?.boost();
    event.preventDefault();
    const WheelEventConstructor = embeddedWindow.WheelEvent;
    canvas.dispatchEvent(new WheelEventConstructor("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    }));
  };
  const onClick = (event: MouseEvent) => {
    if (isBlockedInteractionTarget(event.target)) return;
    scheduler?.boost();
    const MouseEventConstructor = embeddedWindow.MouseEvent;
    canvas.dispatchEvent(new MouseEventConstructor("click", {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
      button: event.button,
      buttons: event.buttons,
      detail: event.detail,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    }));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (isBlockedInteractionTarget(event.target)) return;
    scheduler?.boost();
    const KeyboardEventConstructor = embeddedWindow.KeyboardEvent;
    const forwarded = new KeyboardEventConstructor("keydown", {
      bubbles: true,
      cancelable: true,
      key: event.key,
      code: event.code,
      repeat: event.repeat,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    });
    if (!embeddedWindow.dispatchEvent(forwarded)) event.preventDefault();
  };

  document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  document.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
  document.addEventListener("pointerup", onPointerEnd, { capture: true, passive: true });
  document.addEventListener("pointercancel", onPointerEnd, { capture: true, passive: true });
  document.addEventListener("wheel", onWheel, { capture: true, passive: false });
  document.addEventListener("click", onClick, { capture: true, passive: true });
  document.addEventListener("keydown", onKeyDown, { capture: true });

  cleanups.push(
    () => document.removeEventListener("pointerdown", onPointerDown, true),
    () => document.removeEventListener("pointermove", onPointerMove, true),
    () => document.removeEventListener("pointerup", onPointerEnd, true),
    () => document.removeEventListener("pointercancel", onPointerEnd, true),
    () => document.removeEventListener("wheel", onWheel, true),
    () => document.removeEventListener("click", onClick, true),
    () => document.removeEventListener("keydown", onKeyDown, true),
  );
}

function configureExactGalaxyFrame(
  document: Document,
  controller: ExactGalaxyController,
): void {
  const { frame } = controller;
  const embeddedDocument = frame.contentDocument;
  const embeddedWindow = frame.contentWindow as ExactGalaxyWindow | null;
  const frameWindow = document.defaultView as ExactGalaxyWindow | null;
  const canvas = embeddedDocument?.getElementById("galaxy") as HTMLCanvasElement | null;
  const source = embeddedWindow?.__NUR__;
  if (!embeddedDocument || !embeddedWindow || !frameWindow || !canvas || !source) {
    frame.dataset.nurExactGalaxyState = "missing-runtime-dom";
    document.documentElement.dataset.nurCanonicalGalaxy = "missing-runtime-dom";
    return;
  }

  const hud = embeddedDocument.querySelector<HTMLElement>(".hud");
  if (hud) {
    hud.hidden = true;
    hud.setAttribute("aria-hidden", "true");
  }
  controller.scheduler ??= installV197CooperativeFrameClient(
    frameWindow,
    embeddedWindow,
    { label: "galaxy" },
  );
  frame.dataset.nurFrameOwner = "shared-parent-raf";
  installExactGalaxyInputBridge(document, controller, embeddedWindow, canvas);

  const diagnostics = () => exactDiagnostics(source, controller);
  const runtime: ExactGalaxyRuntime = Object.freeze({
    addEvent: () => {
      controller.scheduler?.boost();
      canvas.dispatchEvent(new embeddedWindow.MouseEvent("click", { detail: 1 }));
    },
    burst: () => {
      controller.scheduler?.boost();
      canvas.dispatchEvent(new embeddedWindow.MouseEvent("click", { detail: 1 }));
    },
    setMode: () => undefined,
    setRotate: () => undefined,
    setTheme: () => undefined,
    reset: () => {
      controller.scheduler?.boost();
      source.reset();
    },
    getParticleCount: () => source.getStats().particles,
    getTransientParticleCount: () => 0,
    getParticleDiagnostics: diagnostics,
    dispose: () => disposeV197CanonicalGalaxy(document),
  });
  frameWindow.nurGalaxy = runtime;
  frameWindow.__nurGalaxy = runtime;
  try {
    Object.defineProperty(frameWindow, "NURDiagnostics", {
      value: Object.freeze({ snapshot: diagnostics }),
      configurable: true,
    });
  } catch {
    frameWindow.NURDiagnostics = Object.freeze({ snapshot: diagnostics });
  }
  frame.dataset.nurExactGalaxyState = "ready";
  document.documentElement.dataset.nurCanonicalGalaxy = "ready";
}

export function disposeV197CanonicalGalaxy(document: Document): boolean {
  const controller = galaxyControllers.get(document);
  if (!controller) return false;
  controller.cleanups.splice(0).forEach(cleanup => cleanup());
  controller.activePointers.clear();
  controller.scheduler?.dispose();
  controller.scheduler = null;
  controller.frame.src = "about:blank";
  controller.frame.remove();
  galaxyControllers.delete(document);
  const frameWindow = document.defaultView as ExactGalaxyWindow | null;
  if (frameWindow) {
    delete frameWindow.nurGalaxy;
    delete frameWindow.__nurGalaxy;
  }
  return true;
}

/** Mount the founder-supplied halo-free document without rewriting its renderer. */
export function ensureV197CanonicalGalaxy(document: Document): HTMLIFrameElement | null {
  const existing = document.getElementById(V197_EXACT_GALAXY_FRAME_ID) as HTMLIFrameElement | null;
  if (existing) return existing;
  const frameWindow = document.defaultView;
  const body = document.body;
  if (!frameWindow || !body) {
    document.documentElement.dataset.nurCanonicalGalaxy = "missing-document";
    return null;
  }

  disposeSupersededRuntimes(document);
  removeSupersededBrain(document);
  document.querySelector<HTMLCanvasElement>("#space3d")?.remove();

  document.documentElement.classList.remove("nur-canonical-cross-screen-runtime");
  document.documentElement.classList.add("nur-exact-halo-free-runtime");
  document.documentElement.dataset.nurCanonicalGalaxy = "loading";

  const galaxyFrame = document.createElement("iframe");
  galaxyFrame.id = V197_EXACT_GALAXY_FRAME_ID;
  galaxyFrame.src = V197_EXACT_GALAXY_PATH;
  galaxyFrame.title = v197Copy("Systems universe");
  galaxyFrame.loading = "eager";
  galaxyFrame.tabIndex = -1;
  galaxyFrame.dataset.nurArtifactSha256 = V197_EXACT_GALAXY_SHA256;
  galaxyFrame.dataset.nurExactGalaxyState = "loading";

  const controller: ExactGalaxyController = {
    frame: galaxyFrame,
    activePointers: new Set(),
    cleanups: [],
    scheduler: null,
  };
  galaxyControllers.set(document, controller);
  galaxyFrame.addEventListener("load", () => configureExactGalaxyFrame(document, controller), {
    once: true,
  });
  galaxyFrame.addEventListener("error", () => {
    galaxyFrame.dataset.nurExactGalaxyState = "load-error";
    document.documentElement.dataset.nurCanonicalGalaxy = "load-error";
  }, { once: true });
  body.prepend(galaxyFrame);
  return galaxyFrame;
}
