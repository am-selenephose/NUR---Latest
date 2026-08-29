import { afterEach, describe, expect, it, vi } from "vitest";

import {
  V197_THEME_COLORS,
  V197_THEME_CYCLE,
  V197_THEME_STORAGE_KEY,
  createV197ThemeController,
} from "../bridge/v197Theme";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function freshDocument(): Document {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  if (!frameDocument) throw new Error("JSDOM did not create an iframe document.");
  return frameDocument;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-nur-theme-accent");
  document.documentElement.style.removeProperty("--nur-theme-accent");
  document.documentElement.style.removeProperty("--nur-theme-strength");
});

describe("V197 spectral theme controller", () => {
  it("keeps the mandated spectral palette and deterministic cycle exact", () => {
    expect(V197_THEME_COLORS).toEqual({
      red: "#ff4656",
      orange: "#ff9148",
      yellow: "#ffdc5c",
      green: "#48ebaf",
      blue: "#4fccff",
      indigo: "#5a70ff",
      violet: "#c16bff",
    });
    expect(V197_THEME_CYCLE).toEqual([
      "original",
      "yellow",
      "green",
      "blue",
      "violet",
      "red",
      "orange",
      "indigo",
    ]);
  });

  it("cycles on an eligible native double click and resets on a native triple click", () => {
    vi.useFakeTimers();
    const worldDocument = freshDocument();
    const controller = createV197ThemeController(worldDocument, new MemoryStorage());

    worldDocument.body.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    worldDocument.body.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    expect(controller.accent).toBe("original");
    vi.runAllTimers();
    expect(controller.accent).toBe("yellow");

    worldDocument.body.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    worldDocument.body.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    worldDocument.body.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 3 }));
    vi.runAllTimers();
    expect(controller.accent).toBe("original");
  });

  it("blocks controls, panels, brain gestures, and completed drags", () => {
    vi.useFakeTimers();
    const worldDocument = freshDocument();
    const controller = createV197ThemeController(worldDocument, new MemoryStorage());
    const button = worldDocument.createElement("button");
    const panel = worldDocument.createElement("section");
    const brain = worldDocument.createElement("canvas");
    panel.className = "nur-panel";
    brain.id = "nur-brain-canvas";
    worldDocument.body.append(button, panel, brain);

    for (const target of [button, panel, brain]) {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    }
    vi.runAllTimers();
    expect(controller.accent).toBe("original");

    worldDocument.body.dispatchEvent(new MouseEvent("pointerdown", {
      bubbles: true,
      clientX: 10,
      clientY: 10,
    }));
    worldDocument.body.dispatchEvent(new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 40,
      clientY: 34,
    }));
    worldDocument.body.dispatchEvent(new MouseEvent("pointerup", {
      bubbles: true,
      clientX: 40,
      clientY: 34,
    }));
    worldDocument.body.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    vi.runAllTimers();
    expect(controller.accent).toBe("original");
  });

  it("allows only directly exposed empty glass on the constellation world stage", () => {
    vi.useFakeTimers();
    const worldDocument = freshDocument();
    const controller = createV197ThemeController(worldDocument, new MemoryStorage());
    const stage = worldDocument.createElement("section");
    const legend = worldDocument.createElement("div");
    stage.className = "universe-map-panel nur-panel";
    legend.className = "universe-map-legend";
    stage.append(legend);
    worldDocument.body.append(stage);

    stage.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    vi.runAllTimers();
    expect(controller.accent).toBe("yellow");

    controller.reset();
    legend.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    vi.runAllTimers();
    expect(controller.accent).toBe("original");
  });

  it("restores, applies, persists, advances, and resets one semantic root state", () => {
    const storage = new MemoryStorage();
    storage.setItem(V197_THEME_STORAGE_KEY, "green");
    const controller = createV197ThemeController(document, storage);

    expect(controller.accent).toBe("green");
    expect(document.documentElement.dataset.nurThemeAccent).toBe("green");
    expect(document.documentElement.style.getPropertyValue("--nur-theme-accent")).toBe("#48ebaf");
    expect(document.documentElement.style.getPropertyValue("--nur-theme-strength")).toBe("1");

    expect(controller.advance()).toBe("blue");
    expect(storage.getItem(V197_THEME_STORAGE_KEY)).toBe("blue");

    controller.reset();
    expect(controller.accent).toBe("original");
    expect(storage.getItem(V197_THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute("data-nur-theme-accent")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--nur-theme-accent")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--nur-theme-strength")).toBe("0");
  });

  it("synchronizes every attached V197 document and its existing celestial APIs", () => {
    const storage = new MemoryStorage();
    const entryDocument = freshDocument();
    const universeDocument = freshDocument();
    const entryGalaxy = vi.fn();
    const universeBrain = vi.fn();

    Object.assign(entryDocument.defaultView!, {
      nurGalaxy: { setTheme: entryGalaxy },
    });
    Object.assign(universeDocument.defaultView!, {
      nurStarBrain: { setTheme: universeBrain },
    });

    const controller = createV197ThemeController(document, storage);
    const detachEntry = controller.attach(entryDocument);
    controller.attach(universeDocument);
    controller.setAccent("violet");

    for (const attachedDocument of [document, entryDocument, universeDocument]) {
      expect(attachedDocument.documentElement.dataset.nurThemeAccent).toBe("violet");
      expect(attachedDocument.documentElement.style.getPropertyValue("--nur-theme-accent")).toBe("#c16bff");
    }
    expect(entryGalaxy).toHaveBeenLastCalledWith("#c16bff", 1);
    expect(universeBrain).toHaveBeenLastCalledWith("#c16bff", 1);

    detachEntry();
    controller.setAccent("red");
    expect(entryDocument.documentElement.dataset.nurThemeAccent).toBe("violet");
    expect(universeDocument.documentElement.dataset.nurThemeAccent).toBe("red");
  });

  it("rejects invalid persisted values, emits changes, and stops mutating after disposal", () => {
    const storage = new MemoryStorage();
    storage.setItem(V197_THEME_STORAGE_KEY, "cyan");
    const changes: string[] = [];
    document.addEventListener("nur:v197-theme-change", event => {
      changes.push((event as CustomEvent<{ accent: string }>).detail.accent);
    });

    const controller = createV197ThemeController(document, storage);
    expect(controller.accent).toBe("original");
    expect(storage.getItem(V197_THEME_STORAGE_KEY)).toBeNull();

    controller.setAccent("yellow");
    expect(changes).toEqual(["yellow"]);
    controller.dispose();
    controller.setAccent("indigo");

    expect(controller.accent).toBe("yellow");
    expect(document.documentElement.dataset.nurThemeAccent).toBe("yellow");
    expect(storage.getItem(V197_THEME_STORAGE_KEY)).toBe("yellow");
  });
});
