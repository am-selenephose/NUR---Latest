import { describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({
  activeUiLocale: vi.fn(() => "en"),
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

import { formatV197RescheduleReason } from "./v197Timeline";

describe("V197 Timeline localization boundary", () => {
  it("localizes a system ripple while preserving an owner-written reason", () => {
    expect(formatV197RescheduleReason({
      source: "RIPPLE",
      reason: "Ripple from Scope review",
    })).toBe("Ripple from Scope review");
    expect(i18n.uiFormat).toHaveBeenCalledWith("Ripple from {0}", ["Scope review"]);

    expect(formatV197RescheduleReason({
      source: "OWNER",
      reason: "I need a quieter afternoon",
    })).toBe("I need a quieter afternoon");
    expect(i18n.verbatimUserText).toHaveBeenCalledWith("I need a quieter afternoon");
  });

  it("does not expose an unknown server-authored reschedule reason", () => {
    expect(formatV197RescheduleReason({ source: "SYSTEM", reason: "English backend copy" }))
      .toBe("Rescheduled by a recorded dependency change.");
    expect(formatV197RescheduleReason({ source: "OWNER", reason: null }))
      .toBe("No reason given");
  });
});
