import { describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({
  activeUiLocale: vi.fn(() => "en"),
  markVerbatimUserContent: vi.fn(),
  setVerbatimUserText: vi.fn(),
  uiCopy: vi.fn((source: string) => `catalog:${source}`),
  uiFormat: vi.fn((source: string, values: readonly unknown[]) => source.replace(
    /\{(\d+)\}/gu,
    (_match, index) => String(values[Number(index)]),
  )),
  uiSource: vi.fn((source: string) => source),
}));

vi.mock("../lib/i18n", () => i18n);
vi.mock("./v197I18n", () => ({ applyV197Locale: vi.fn() }));
vi.mock("./v197Mutations", () => ({ hydrateReadOnlyV197: vi.fn() }));

import { uiSource } from "../lib/i18n";
import { formatV197ControlledToken } from "./v197Hydration";

describe("V197 hydration localization boundary", () => {
  it("renders a controlled provenance token through semantic catalog copy", () => {
    expect(formatV197ControlledToken("owner_ledger", uiSource("Unknown provenance"))).toBe(
      "catalog:Owner ledger",
    );
    expect(i18n.uiCopy).toHaveBeenCalledWith("Owner ledger");
  });

  it("catalogs controlled time, state, and object tokens instead of formatting enums", () => {
    expect(formatV197ControlledToken("morning", uiSource("Unknown time"))).toBe(
      "catalog:Morning",
    );
    expect(formatV197ControlledToken("journal_entry", uiSource("Unknown object"))).toBe(
      "catalog:Journal entry",
    );
    expect(formatV197ControlledToken("scheduled_action", uiSource("Unknown move"))).toBe(
      "catalog:Scheduled action",
    );
    expect(formatV197ControlledToken("future_enum", uiSource("Unknown state"))).toBe(
      "catalog:Unknown state",
    );
  });
});
