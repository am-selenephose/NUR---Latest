import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  celestialDeltaSeconds,
  shouldPaintCelestialFrame,
} from "../bridge/v197CelestialRuntime";

const runtime = readFileSync(
  resolve(process.cwd(), "src/bridge/v197CelestialRuntime.ts"),
  "utf8",
);

describe("V197 celestial frame pacing", () => {
  it("lets requestAnimationFrame own every desktop callback", () => {
    expect(shouldPaintCelestialFrame(1440, 8.33, 1)).toBe(true);
    expect(shouldPaintCelestialFrame(1440, 16.67, 8.33)).toBe(true);
    expect(shouldPaintCelestialFrame(1440, 20, 16.67)).toBe(true);
    expect(runtime).not.toContain("mobile ? 33 : 20");
    expect(runtime).not.toContain("minimumGap");
  });

  it("retains one deliberate mobile cadence without delaying the first paint", () => {
    expect(shouldPaintCelestialFrame(390, 8.33, 0)).toBe(true);
    expect(shouldPaintCelestialFrame(390, 16.67, 8.33)).toBe(false);
    expect(shouldPaintCelestialFrame(390, 41.34, 8.33)).toBe(true);
  });

  it("uses refresh-rate-independent timestamp deltas and clamps suspension jumps", () => {
    expect(celestialDeltaSeconds(1016.67, 1000)).toBeCloseTo(.01667, 5);
    expect(celestialDeltaSeconds(1008.33, 1000)).toBeCloseTo(.00833, 5);
    expect(celestialDeltaSeconds(1004.17, 1000)).toBeCloseTo(.00417, 5);
    expect(celestialDeltaSeconds(10_000, 1000)).toBe(.05);
    expect(celestialDeltaSeconds(1000, 0)).toBeCloseTo(1 / 60, 8);
  });

  it("advances the same physical distance at 60, 120 and 240 Hz", () => {
    const distance = (intervalMs: number, frames: number): number => {
      let previous = 1000;
      let travelled = 0;
      for (let frame = 0; frame < frames; frame += 1) {
        const now = previous + intervalMs;
        travelled += 12 * celestialDeltaSeconds(now, previous);
        previous = now;
      }
      return travelled;
    };

    expect(distance(1000 / 60, 60)).toBeCloseTo(12, 6);
    expect(distance(1000 / 120, 120)).toBeCloseTo(12, 6);
    expect(distance(1000 / 240, 240)).toBeCloseTo(12, 6);
  });
});
