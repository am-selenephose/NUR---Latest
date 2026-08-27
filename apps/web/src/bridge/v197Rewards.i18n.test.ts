// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { collectCatalogCalls } from "../../../../infra/scripts/build-i18n-source-catalog.mjs";

const i18n = vi.hoisted(() => ({
  uiSource: vi.fn((source: string) => source),
  uiCopy: vi.fn((source: string) => source),
  uiFormat: vi.fn((source: string, values: readonly unknown[]) => source.replace(/\{(\d+)\}/gu, (_match, index) => String(values[Number(index)]))),
}));

vi.mock("../lib/i18n", () => i18n);

import {
  announcePersistedGlow,
  formatV197GlowEventReason,
  renderPersistedGlow,
} from "./v197Rewards";

function fixture(): Document {
  const document = window.document;
  document.body.innerHTML = `
    <section id="page-today"><div class="today-grid"><aside>
      <h2 class="panel-title"></h2><p class="panel-sub"></p><div class="glow-row"></div>
    </aside></div></section>
    <section class="clean-glows-card"><div class="clean-card-heading"><span></span></div><div class="clean-glow-list"></div></section>
    <p class="v172-glow-principle"><span class="context-title"></span></p>
    <button id="iSpark"></button>
  `;
  return document;
}

describe("V197 Rewards localization boundary", () => {
  afterEach(() => vi.useRealTimers());

  it("catalogs product time, status, rank, and persisted rule descriptions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00Z"));
    const document = fixture();

    renderPersistedGlow(document, {
      balance: 12,
      lifetime_points: 12,
      recent_transactions: [
        { id: "today", event_type: "saved", source_kind: "JOURNAL", source_id: "a", final_points: 2, reason: "Owner-written reason", created_at: "2026-08-24T08:00:00Z" },
        { id: "yesterday", event_type: "saved", source_kind: "JOURNAL", source_id: "b", final_points: 3, reason: "Persisted evidence", created_at: "2026-08-23T08:00:00Z" },
        { id: "invalid", event_type: "saved", source_kind: "JOURNAL", source_id: "c", final_points: 4, reason: "Recorded result", created_at: "not-a-date" },
      ],
      streaks: [],
    });

    expect(document.body.textContent).not.toContain("Owner-written reason");
    expect(document.body.textContent).toContain("Recorded Glow event");
    expect(i18n.uiCopy).toHaveBeenCalledWith("today");
    expect(i18n.uiCopy).toHaveBeenCalledWith("yesterday");
    expect(i18n.uiCopy).toHaveBeenCalledWith("persisted");
    expect(i18n.uiCopy).toHaveBeenCalledWith("Orbit Seed");
    expect(i18n.uiCopy).toHaveBeenCalledWith("Glow Points move only after the server confirms a real action.");
  });

  it("maps every known Glow rule to catalog-owned copy without trusting a server description", () => {
    expect(formatV197GlowEventReason("journal_saved")).toBe("A persisted Journal entry.");
    expect(formatV197GlowEventReason("project.evidence_verified")).toBe(
      "Persisted AM Project evidence passed verification.",
    );
    expect(formatV197GlowEventReason("future_rule")).toBe("Recorded Glow event");

    expect(i18n.uiCopy).toHaveBeenCalledWith("A persisted Journal entry.");
    expect(i18n.uiCopy).toHaveBeenCalledWith(
      "Persisted AM Project evidence passed verification.",
    );
    expect(i18n.uiCopy).toHaveBeenCalledWith("Recorded Glow event");
  });

  it("formats the visible award toast through the catalog", () => {
    const document = fixture();
    const toast = vi.fn();
    Object.assign(document.defaultView!, { nurToast: toast });

    announcePersistedGlow(document, {
      awarded_points: 4,
      balance: 12,
      lifetime_points: 12,
      idempotent_replay: false,
      streak: null,
    });

    expect(i18n.uiFormat).toHaveBeenCalledWith("+{0} Glow · {1} total", [4, 12]);
    expect(toast).toHaveBeenCalledWith("+4 Glow · 12 total");
  });

  it("keeps every format source statically collectable for the generated catalog", () => {
    const source = readFileSync(resolve(process.cwd(), "src/bridge/v197Rewards.ts"), "utf8");

    expect(() => collectCatalogCalls(source, "v197Rewards.ts")).not.toThrow();
  });
});
