// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({
  activeUiLocale: vi.fn(() => "de"),
  uiSource: vi.fn((source: string) => source),
  uiCopy: vi.fn((source: string) => source),
  uiFormat: vi.fn((source: string, values: readonly unknown[]) => source.replace(/\{(\d+)\}/gu, (_match, index) => String(values[Number(index)]))),
}));

vi.mock("../lib/i18n", () => i18n);

vi.mock("./v197I18n", () => ({
  applyV197Locale: vi.fn(),
  directionForPreference: vi.fn(() => "ltr"),
  V197_LOCALE_META: [],
}));

import {
  formatV197AccountDeletionResult,
  formatV197AdjunctDate,
  formatV197GlowEvent,
  formatV197GlowQuest,
  formatV197GlowRank,
  formatV197GlowStreak,
  formatV197OwnerSessionState,
} from "./v197Adjuncts";

describe("V197 Adjuncts localization boundary", () => {
  it("formats valid timestamps with the active UI locale and catalogs the empty-state label", () => {
    const value = "2026-08-24T12:34:56Z";

    expect(formatV197AdjunctDate(value)).toBe(new Date(value).toLocaleString("de"));
    expect(i18n.activeUiLocale).toHaveBeenCalled();
    expect(formatV197AdjunctDate(null)).toBe("No expiry");
    expect(i18n.uiCopy).toHaveBeenCalledWith("No expiry");
  });

  it("preserves an invalid persisted timestamp verbatim", () => {
    expect(formatV197AdjunctDate("persisted-unparseable-date")).toBe("persisted-unparseable-date");
  });

  it("maps persisted Glow control keys through statically cataloged UI copy", () => {
    expect(formatV197GlowRank("Orbit Seed")).toBe("Orbit Seed");
    expect(formatV197GlowStreak("plan_movement")).toBe("Plan Movement");
    expect(formatV197GlowQuest({ key: "three_returns", title: "server title" })).toBe("Return with evidence");
    expect(formatV197GlowEvent("project.evidence_verified")).toBe("Project evidence verified");

    expect(i18n.uiCopy).toHaveBeenCalledWith("Orbit Seed");
    expect(i18n.uiCopy).toHaveBeenCalledWith("Plan Movement");
    expect(i18n.uiCopy).toHaveBeenCalledWith("Return with evidence");
    expect(i18n.uiCopy).toHaveBeenCalledWith("Project evidence verified");
  });

  it("does not expose unknown server control keys as untranslated interface copy", () => {
    expect(formatV197GlowRank("FUTURE_SERVER_RANK")).toBe("Unclassified constellation");
    expect(formatV197GlowStreak("future_streak")).toBe("Verified continuity");
    expect(formatV197GlowQuest({ key: "future_quest", title: "English server copy" })).toBe("Verified quest");
    expect(formatV197GlowEvent("future.event")).toBe("Verified Glow event");
  });

  it("catalogs session and account-deletion control states", () => {
    expect(formatV197OwnerSessionState("active")).toBe("Active");
    expect(formatV197OwnerSessionState("future_state")).toBe("Session state unavailable");
    expect(formatV197AccountDeletionResult("not_applicable")).toBe(
      "Account deleted. No external provider deletion was applicable.",
    );
    expect(formatV197AccountDeletionResult("future_state")).toBe(
      "Account deleted. Review the retained audit for external-provider scope.",
    );
  });
});
