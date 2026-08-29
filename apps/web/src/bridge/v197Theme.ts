export const V197_THEME_STORAGE_KEY = "nur:v197-theme-accent";
export const V197_THEME_CHANGE_EVENT = "nur:v197-theme-change";

export const V197_THEME_COLORS = {
  red: "#ff4656",
  orange: "#ff9148",
  yellow: "#ffdc5c",
  green: "#48ebaf",
  blue: "#4fccff",
  indigo: "#5a70ff",
  violet: "#c16bff",
} as const;

export const V197_THEME_CYCLE = [
  "original",
  "yellow",
  "green",
  "blue",
  "violet",
  "red",
  "orange",
  "indigo",
] as const;

export type V197ThemeAccent = (typeof V197_THEME_CYCLE)[number];

interface V197ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface V197ThemeTarget {
  setTheme?: (color: string, strength: number) => void;
}

interface V197ThemeWindow extends Window {
  nurGalaxy?: V197ThemeTarget;
  nurStarBrain?: V197ThemeTarget;
}

export interface V197ThemeController {
  readonly accent: V197ThemeAccent;
  attach(document: Document): () => void;
  setAccent(accent: V197ThemeAccent): void;
  advance(): V197ThemeAccent;
  reset(): void;
  dispose(): void;
}

const V197_THEME_GESTURE_COMMIT_MS = 280;
const V197_THEME_WORLD_SURFACE = ".universe-map-panel";
const V197_THEME_GESTURE_BLOCKERS = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "label",
  "summary",
  "dialog",
  "[contenteditable]",
  "[role='button']",
  "[role='dialog']",
  "[data-action]",
  "[data-page]",
  "[data-world-focus]",
  "[data-world-tab]",
  "[data-owner-route]",
  "#nur-brain-canvas",
  "#front-nur-star",
  ".nur-panel",
  ".universe-panel",
  ".universe-card",
  ".universe-insight-panel",
  ".nur-adjunct-root",
  ".nur-rail",
  ".clean-left-rail",
  ".clean-right-rail",
  ".nur-topbar",
  ".global-composer",
  ".scope-modal",
  ".modal",
  ".share-sheet",
].join(",");

function isEligibleThemeTarget(target: EventTarget | null): boolean {
  const element = target as Element | null;
  if (typeof element?.closest !== "function") return false;
  // The constellation's outer world stage also carries the generic panel class.
  // Only its directly exposed empty glass is eligible; descendants stay guarded.
  if (element.matches(V197_THEME_WORLD_SURFACE)) return true;
  return element.closest(V197_THEME_GESTURE_BLOCKERS) === null;
}

function installThemeGestures(
  document: Document,
  advance: () => void,
  reset: () => void,
): () => void {
  const frameWindow = document.defaultView;
  if (!frameWindow) return () => undefined;

  let pendingDouble: number | null = null;
  let pointerStart: { x: number; y: number } | null = null;
  let dragged = false;
  let suppressNextClick = false;

  const cancelPendingDouble = () => {
    if (pendingDouble === null) return;
    frameWindow.clearTimeout(pendingDouble);
    pendingDouble = null;
  };
  const onClick = (event: MouseEvent) => {
    if (event.detail >= 3) {
      cancelPendingDouble();
      if (isEligibleThemeTarget(event.target) && !suppressNextClick) reset();
      suppressNextClick = false;
      return;
    }
    if (suppressNextClick) {
      suppressNextClick = false;
      cancelPendingDouble();
      return;
    }
    if (event.detail !== 2 || !isEligibleThemeTarget(event.target)) return;
    cancelPendingDouble();
    // Native click detail owns click counting. This one short commit window only
    // lets a native third click cancel the pending double-click visual change.
    pendingDouble = frameWindow.setTimeout(() => {
      pendingDouble = null;
      advance();
    }, V197_THEME_GESTURE_COMMIT_MS);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !isEligibleThemeTarget(event.target)) {
      pointerStart = null;
      dragged = false;
      return;
    }
    pointerStart = { x: event.clientX, y: event.clientY };
    dragged = false;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!pointerStart || dragged) return;
    dragged = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8;
  };
  const onPointerEnd = () => {
    if (pointerStart && dragged) suppressNextClick = true;
    pointerStart = null;
    dragged = false;
  };

  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerup", onPointerEnd, true);
  document.addEventListener("pointercancel", onPointerEnd, true);
  return () => {
    cancelPendingDouble();
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerEnd, true);
    document.removeEventListener("pointercancel", onPointerEnd, true);
  };
}

function isThemeAccent(value: string | null): value is V197ThemeAccent {
  return value !== null && (V197_THEME_CYCLE as readonly string[]).includes(value);
}

function storageFor(document: Document): V197ThemeStorage | null {
  try {
    return document.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredAccent(storage: V197ThemeStorage | null): V197ThemeAccent {
  if (!storage) return "original";
  try {
    const stored = storage.getItem(V197_THEME_STORAGE_KEY);
    if (isThemeAccent(stored) && stored !== "original") return stored;
    if (stored !== null) storage.removeItem(V197_THEME_STORAGE_KEY);
  } catch {
    // Device-local preference storage may be unavailable in hardened browsers.
  }
  return "original";
}

function applyTheme(document: Document, accent: V197ThemeAccent): void {
  const root = document.documentElement;
  const spectralAccent = accent === "original" ? null : accent;
  const color = spectralAccent ? V197_THEME_COLORS[spectralAccent] : "#ffffff";
  const strength = spectralAccent ? 1 : 0;

  if (spectralAccent) {
    root.dataset.nurThemeAccent = spectralAccent;
    root.style.setProperty("--nur-theme-accent", color);
  } else {
    delete root.dataset.nurThemeAccent;
    root.style.removeProperty("--nur-theme-accent");
  }
  root.style.setProperty("--nur-theme-strength", String(strength));

  const targetWindow = document.defaultView as V197ThemeWindow | null;
  targetWindow?.nurGalaxy?.setTheme?.(color, strength);
  targetWindow?.nurStarBrain?.setTheme?.(color, strength);
}

function dispatchThemeChange(document: Document, accent: V197ThemeAccent): void {
  const CustomEventConstructor = document.defaultView?.CustomEvent;
  if (!CustomEventConstructor) return;
  document.dispatchEvent(new CustomEventConstructor(V197_THEME_CHANGE_EVENT, {
    detail: { accent },
  }));
}

export function createV197ThemeController(
  rootDocument: Document,
  storage: V197ThemeStorage | null = storageFor(rootDocument),
): V197ThemeController {
  const documents = new Map<Document, () => void>();
  let accent = readStoredAccent(storage);
  let disposed = false;

  const synchronize = (emit: boolean): void => {
    for (const attachedDocument of documents.keys()) applyTheme(attachedDocument, accent);
    if (emit) {
      for (const attachedDocument of documents.keys()) dispatchThemeChange(attachedDocument, accent);
    }
  };

  const persist = (): void => {
    if (!storage) return;
    try {
      if (accent === "original") storage.removeItem(V197_THEME_STORAGE_KEY);
      else storage.setItem(V197_THEME_STORAGE_KEY, accent);
    } catch {
      // A blocked preference store must never prevent V197 from rendering.
    }
  };

  const controller: V197ThemeController = {
    get accent() {
      return accent;
    },

    attach(document) {
      if (disposed) return () => undefined;
      if (documents.has(document)) return () => undefined;
      const removeGestures = installThemeGestures(
        document,
        () => controller.advance(),
        () => controller.reset(),
      );
      documents.set(document, removeGestures);
      applyTheme(document, accent);
      return () => {
        documents.get(document)?.();
        documents.delete(document);
      };
    },

    setAccent(nextAccent) {
      if (disposed || !isThemeAccent(nextAccent)) return;
      const changed = accent !== nextAccent;
      accent = nextAccent;
      persist();
      synchronize(changed);
    },

    advance() {
      if (disposed) return accent;
      const currentIndex = V197_THEME_CYCLE.indexOf(accent);
      const nextAccent = V197_THEME_CYCLE[(currentIndex + 1) % V197_THEME_CYCLE.length];
      controller.setAccent(nextAccent);
      return accent;
    },

    reset() {
      controller.setAccent("original");
    },

    dispose() {
      disposed = true;
      for (const removeGestures of documents.values()) removeGestures();
      documents.clear();
    },
  };

  controller.attach(rootDocument);
  return controller;
}
