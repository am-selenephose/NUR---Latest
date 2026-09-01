import { describe, expect, it } from "vitest";

import { installV197CooperativeFrameClient } from "../bridge/v197CooperativeFrameHub";

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

class FakeParentWindow {
  now = 0;
  nextHandle = 1;
  frames = new Map<number, FrameRequestCallback>();
  idles = new Map<number, (deadline: IdleDeadlineLike) => void>();
  timers = new Map<number, () => void>();
  performance = { now: () => this.now };

  requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const handle = this.nextHandle++;
    this.frames.set(handle, callback);
    return handle;
  };

  cancelAnimationFrame = (handle: number): void => {
    this.frames.delete(handle);
  };

  requestIdleCallback = (
    callback: (deadline: IdleDeadlineLike) => void,
    _options?: { timeout: number },
  ): number => {
    const handle = this.nextHandle++;
    this.idles.set(handle, callback);
    return handle;
  };

  cancelIdleCallback = (handle: number): void => {
    this.idles.delete(handle);
  };

  setTimeout = (callback: () => void, _delay?: number): number => {
    const handle = this.nextHandle++;
    this.timers.set(handle, callback);
    return handle;
  };

  clearTimeout = (handle: number): void => {
    this.timers.delete(handle);
  };

  runFrame(now = this.now + 16): void {
    this.now = now;
    const callbacks = Array.from(this.frames.values());
    this.frames.clear();
    callbacks.forEach(callback => callback(now));
  }

  runIdle(deadline: IdleDeadlineLike): void {
    const callback = this.idles.values().next().value as (
      (value: IdleDeadlineLike) => void
    ) | undefined;
    expect(callback).toBeTypeOf("function");
    this.idles.clear();
    callback?.(deadline);
  }
}

class FakeChildWindow {
  now: number;
  nextHandle = 1;
  nativeFrames = new Map<number, FrameRequestCallback>();
  performance: { now: () => number };

  constructor(now: number) {
    this.now = now;
    this.performance = { now: () => this.now };
  }

  requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const handle = this.nextHandle++;
    this.nativeFrames.set(handle, callback);
    return handle;
  };

  cancelAnimationFrame = (handle: number): void => {
    this.nativeFrames.delete(handle);
  };
}

const asWindow = (value: unknown): Window => value as Window;
const generousIdle = (): IdleDeadlineLike => ({
  didTimeout: false,
  timeRemaining: () => 12,
});

describe("V197 cooperative celestial frame hub", () => {
  it("uses one parent frame owner and alternates two continuous renderers", () => {
    const parent = new FakeParentWindow();
    const galaxy = new FakeChildWindow(101);
    const brain = new FakeChildWindow(202);
    installV197CooperativeFrameClient(asWindow(parent), asWindow(galaxy), {
      label: "galaxy",
    });
    installV197CooperativeFrameClient(asWindow(parent), asWindow(brain), {
      label: "brain",
    });

    const delivered: Array<[string, number]> = [];
    const galaxyFrame = function frame(now: number): void {
      delivered.push(["galaxy", now]);
      galaxy.requestAnimationFrame(galaxyFrame);
    };
    const brainFrame = function frame(now: number): void {
      delivered.push(["brain", now]);
      brain.requestAnimationFrame(brainFrame);
    };

    galaxy.requestAnimationFrame(galaxyFrame);
    brain.requestAnimationFrame(brainFrame);
    expect(parent.frames).toHaveLength(1);
    expect(galaxy.nativeFrames).toHaveLength(0);
    expect(brain.nativeFrames).toHaveLength(0);

    parent.runFrame();
    parent.runIdle(generousIdle());
    expect(delivered).toEqual([["galaxy", 101]]);
    expect(parent.frames).toHaveLength(1);

    parent.runFrame();
    parent.runIdle(generousIdle());
    expect(delivered).toEqual([
      ["galaxy", 101],
      ["brain", 202],
    ]);
  });

  it("leaves ordinary child animation callbacks on their native owner", () => {
    const parent = new FakeParentWindow();
    const child = new FakeChildWindow(50);
    installV197CooperativeFrameClient(asWindow(parent), asWindow(child), {
      label: "galaxy",
    });

    function resize(): void {
      // A one-shot resize callback is not the founder artifact's continuous frame loop.
    }
    const handle = child.requestAnimationFrame(resize);

    expect(handle).toBeGreaterThan(0);
    expect(child.nativeFrames).toHaveLength(1);
    expect(parent.frames).toHaveLength(0);
  });

  it("yields a low idle budget and uses the starvation guard without dropping a frame", () => {
    const parent = new FakeParentWindow();
    const child = new FakeChildWindow(77);
    const client = installV197CooperativeFrameClient(asWindow(parent), asWindow(child), {
      label: "galaxy",
      minimumIdleBudgetMs: 6,
    });
    const delivered: number[] = [];
    function frame(now: number): void {
      delivered.push(now);
    }
    child.requestAnimationFrame(frame);

    parent.runFrame();
    parent.runIdle({ didTimeout: false, timeRemaining: () => 2 });
    expect(delivered).toEqual([]);
    expect(client.diagnostics().yieldedFrames).toBe(1);
    expect(parent.frames).toHaveLength(1);

    parent.runFrame();
    parent.runIdle({ didTimeout: true, timeRemaining: () => 0 });
    expect(delivered).toEqual([77]);
    expect(client.diagnostics().deliveredFrames).toBe(1);
  });

  it("prioritizes the celestial renderer that the person is manipulating", () => {
    const parent = new FakeParentWindow();
    const galaxy = new FakeChildWindow(1);
    const brain = new FakeChildWindow(2);
    installV197CooperativeFrameClient(asWindow(parent), asWindow(galaxy), {
      label: "galaxy",
    });
    const brainClient = installV197CooperativeFrameClient(
      asWindow(parent),
      asWindow(brain),
      { label: "brain" },
    );
    const delivered: string[] = [];
    const galaxyFrame = function frame(): void {
      delivered.push("galaxy");
    };
    const brainFrame = function frame(): void {
      delivered.push("brain");
    };
    galaxy.requestAnimationFrame(galaxyFrame);
    brain.requestAnimationFrame(brainFrame);

    brainClient.boost();
    parent.runFrame();
    parent.runIdle(generousIdle());
    expect(delivered).toEqual(["brain"]);
  });

  it("restores the child window and releases the parent owner on disposal", () => {
    const parent = new FakeParentWindow();
    const child = new FakeChildWindow(9);
    const nativeRequest = child.requestAnimationFrame;
    const nativeCancel = child.cancelAnimationFrame;
    const client = installV197CooperativeFrameClient(asWindow(parent), asWindow(child), {
      label: "brain",
    });
    function frame(): void {
      // Deliberately empty.
    }
    child.requestAnimationFrame(frame);
    expect(parent.frames).toHaveLength(1);

    client.dispose();

    expect(child.requestAnimationFrame).toBe(nativeRequest);
    expect(child.cancelAnimationFrame).toBe(nativeCancel);
    expect(parent.frames).toHaveLength(0);
    expect(parent.idles).toHaveLength(0);
    child.requestAnimationFrame(frame);
    expect(child.nativeFrames).toHaveLength(1);
  });
});
