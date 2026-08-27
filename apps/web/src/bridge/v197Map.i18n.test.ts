import { describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({
  structuralValue: vi.fn((value: string) => value),
  uiCopy: vi.fn((source: string) => source),
  uiFormat: vi.fn((source: string, values: readonly unknown[]) => source.replace(
    /\{(\d+)\}/gu,
    (_match, index) => String(values[Number(index)]),
  )),
  uiSource: vi.fn((source: string) => source),
  verbatimUserText: vi.fn((value: string) => value),
}));

vi.mock("../lib/i18n", () => i18n);

import {
  formatV197SmartSectionReason,
  formatV197SystemStateReason,
} from "./v197Map";

describe("V197 Map localized system state", () => {
  it("builds the complete explanation from owner counts through semantic catalog keys", () => {
    expect(formatV197SystemStateReason({
      active_goal_count: 1,
      returned_outcome_count: 0,
      progress_percent: 35,
      blocker_count: 2,
    })).toBe("1 active goal, no returned outcome yet, 35% verified progress. 2 unresolved blockers.");

    expect(i18n.uiFormat).toHaveBeenCalledWith("{0} active goal", [1]);
    expect(i18n.uiCopy).toHaveBeenCalledWith("no returned outcome yet");
    expect(i18n.uiFormat).toHaveBeenCalledWith("{0}% verified progress", [35]);
    expect(i18n.uiFormat).toHaveBeenCalledWith("{0} unresolved blockers", [2]);
  });

  it("replaces server-authored smart-section explanations with semantic catalog copy", () => {
    expect(formatV197SmartSectionReason("fragile_paths", true)).toBe(
      "This path holds an unresolved dependency.",
    );
    expect(formatV197SmartSectionReason("fragile_paths", false)).toBe("");

    expect(i18n.uiCopy).toHaveBeenCalledWith(
      "This path holds an unresolved dependency.",
    );
  });
});
