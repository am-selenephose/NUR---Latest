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
  const documents = new Set<Document>();
  let accent = readStoredAccent(storage);
  let disposed = false;

  const synchronize = (emit: boolean): void => {
    for (const attachedDocument of documents) applyTheme(attachedDocument, accent);
    if (emit) {
      for (const attachedDocument of documents) dispatchThemeChange(attachedDocument, accent);
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
      documents.add(document);
      applyTheme(document, accent);
      return () => {
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
      documents.clear();
    },
  };

  controller.attach(rootDocument);
  return controller;
}
