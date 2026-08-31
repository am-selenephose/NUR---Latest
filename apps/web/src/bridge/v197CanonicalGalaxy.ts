export const V197_CANONICAL_GALAXY_VERSION = "NUR_V197_CANONICAL_CROSS_SCREEN_LAGFREE_2026-08-29";
export const V197_CANONICAL_GALAXY_SCRIPT_ID = "nur-v197-canonical-cross-screen-runtime";
export const V197_CANONICAL_GALAXY_SCRIPT_PATH = "/v197/NUR_V197_CANONICAL_CROSS_SCREEN_LAGFREE.runtime.js";

type DisposableRuntime = {
  dispose?: () => void;
};

type V197CelestialWindow = Window & {
  nurGalaxy?: DisposableRuntime;
  __nurGalaxy?: DisposableRuntime;
  nurStarBrain?: DisposableRuntime;
};

const BRAIN_SELECTORS = [
  "#nur-brain-canvas",
  "#nur-brain-canvas-v197",
  "#front-nur-star",
  ".nur-v197-brain-orbit-halo",
  "#f4-core > .f4-master-star",
  ".orbit-star-zone > .f4-core > .f4-master-star",
  ".universe-master-star > .f4-core",
  ".universe-master-star > .spark",
].join(",");

const brainObservers = new WeakMap<Document, MutationObserver>();

function disposeSupersededRuntimes(document: Document): void {
  const frameWindow = document.defaultView as V197CelestialWindow | null;
  for (const runtime of [frameWindow?.nurGalaxy, frameWindow?.__nurGalaxy, frameWindow?.nurStarBrain]) {
    try {
      runtime?.dispose?.();
    } catch {
      // A stale visual owner must not prevent the canonical replacement.
    }
  }
}

function removeSupersededBrain(document: Document): void {
  document.querySelectorAll(BRAIN_SELECTORS).forEach(element => element.remove());
}

function observeBrainRemoval(document: Document): void {
  if (brainObservers.has(document) || !document.body || !document.defaultView) return;
  const observer = new document.defaultView.MutationObserver(records => {
    if (!records.some(record => record.addedNodes.length > 0)) return;
    removeSupersededBrain(document);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  brainObservers.set(document, observer);
}

/**
 * Replace the stale galaxy/brain owners inside one canonical V197 stage.
 *
 * The renderer itself remains the exact founder-provided Aug 29 implementation;
 * its static adapter targets the existing `#space3d` node so V197 geometry,
 * route content, and z-index ownership do not move.
 */
export function ensureV197CanonicalGalaxy(document: Document): HTMLScriptElement | null {
  const existing = document.getElementById(V197_CANONICAL_GALAXY_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) return existing;

  const canvas = document.querySelector<HTMLCanvasElement>("#space3d");
  if (!canvas || !document.defaultView) {
    document.documentElement.dataset.nurCanonicalGalaxy = "missing-space3d";
    return null;
  }

  disposeSupersededRuntimes(document);
  removeSupersededBrain(document);
  observeBrainRemoval(document);

  document.documentElement.classList.add("nur-canonical-cross-screen-runtime");
  document.documentElement.dataset.nurCanonicalGalaxy = "loading";
  canvas.dataset.nurCanvasOwner = "replacement-pending";

  const script = document.createElement("script");
  script.id = V197_CANONICAL_GALAXY_SCRIPT_ID;
  script.src = V197_CANONICAL_GALAXY_SCRIPT_PATH;
  script.async = false;
  script.dataset.nurVersion = V197_CANONICAL_GALAXY_VERSION;
  script.addEventListener("load", () => {
    document.documentElement.dataset.nurCanonicalGalaxy = "ready";
    removeSupersededBrain(document);
  }, { once: true });
  script.addEventListener("error", () => {
    document.documentElement.dataset.nurCanonicalGalaxy = "load-error";
  }, { once: true });
  (document.body ?? document.head).append(script);
  return script;
}
