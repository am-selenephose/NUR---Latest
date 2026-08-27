import { describe, expect, it, vi } from "vitest";
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
  DRAWER_SECTIONS,
  buildApprovalCard,
  describeRisk,
  formatCost,
  resolveApprovalEditor,
  type V197AgenticApproval,
} from "./v197Agentic";

function approval(overrides: Partial<V197AgenticApproval> = {}): V197AgenticApproval {
  return {
    id: "approval-1",
    workflow_id: "workflow-1",
    tool_key: "create_private_draft",
    tool_version: "2",
    redacted_arguments: { title: "Owner-provided title" },
    rationale: "Owner-provided rationale",
    risk_class: "R2_DURABLE_PRIVATE",
    reversible: false,
    cost_ceiling_cents: 250,
    approval_id: "approval-1",
    argument_digest: "digest",
    plan_version: 1,
    call_version: "2",
    ...overrides,
  };
}

describe("V197 Agentic localization boundary", () => {
  it("resolves drawer labels and risk/cost product copy through the catalog", () => {
    void DRAWER_SECTIONS.map(section => section.label);
    describeRisk("R3_EXTERNAL", false);
    formatCost(0);
    formatCost(250);

    expect(i18n.uiCopy).toHaveBeenCalledWith("Waiting for you");
    expect(i18n.uiCopy).toHaveBeenCalledWith("Leaves NUR and reaches someone or something else.");
    expect(i18n.uiCopy).toHaveBeenCalledWith("This cannot be undone.");
    expect(i18n.uiCopy).toHaveBeenCalledWith("No cost");
    expect(i18n.uiFormat).toHaveBeenCalledWith("Up to {0}", ["2.50"]);
  });

  it("localizes only approval fallback copy while keeping persisted approval values verbatim", () => {
    const card = buildApprovalCard(approval({ expires_at: "2026-01-01T00:00:00Z" }), new Date("2026-01-02T00:00:00Z"));
    const editor = resolveApprovalEditor(approval());

    expect(card.why).toBe("Owner-provided rationale");
    expect(card.arguments[0]).toEqual({ key: "title", value: "Owner-provided title" });
    expect(i18n.uiCopy).toHaveBeenCalledWith("This Orbit only");
    expect(i18n.uiCopy).toHaveBeenCalledWith("NUR did not state an expected result.");
    expect(i18n.uiCopy).toHaveBeenCalledWith("This request expired. NUR will ask again rather than assume you still agree.");
    expect(editor.reason).toBe("The API did not expose an input schema for this approval.");
    expect(i18n.uiCopy).toHaveBeenCalledWith("The API did not expose an input schema for this approval.");
  });

  it("keeps every format source statically collectable for the generated catalog", () => {
    const source = readFileSync(resolve(process.cwd(), "src/bridge/v197Agentic.ts"), "utf8");

    expect(() => collectCatalogCalls(source, "v197Agentic.ts")).not.toThrow();
  });
});
