import { afterEach, describe, expect, it, vi } from "vitest";

import { createV197FrameTextBuffer } from "../bridge/v197Bindings";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("V197 runtime lifecycle performance", () => {
  it("coalesces streamed Talk deltas into one DOM append per animation frame", () => {
    const target = document.createElement("span");
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      const id = nextFrame++;
      callbacks.set(id, callback);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => {
      callbacks.delete(id);
    });

    const buffer = createV197FrameTextBuffer(window, target);
    for (let index = 0; index < 100; index += 1) buffer.append(String(index % 10));

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(target.textContent).toBe("");
    expect(target.childNodes).toHaveLength(0);

    callbacks.get(1)?.(16.67);

    expect(target.textContent).toBe("0123456789".repeat(10));
    expect(target.childNodes).toHaveLength(1);
  });

  it("flushes the final Talk chunk synchronously and cancels abandoned presentation work", () => {
    const target = document.createElement("span");
    const callbacks = new Map<number, FrameRequestCallback>();
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callbacks.set(7, callback);
      return 7;
    });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => {
      callbacks.delete(id);
    });
    const buffer = createV197FrameTextBuffer(window, target);

    buffer.append("durable ending");
    buffer.flush();

    expect(target.textContent).toBe("durable ending");
    expect(target.childNodes).toHaveLength(1);
    expect(cancelFrame).toHaveBeenCalledWith(7);

    buffer.append("stale");
    buffer.cancel();
    callbacks.get(7)?.(33.34);

    expect(requestFrame).toHaveBeenCalledTimes(2);
    expect(target.textContent).toBe("durable ending");
  });
});
