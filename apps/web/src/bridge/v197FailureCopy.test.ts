import { describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({
  uiCopy: vi.fn((source: string) => `[localized] ${source}`),
  uiSource: vi.fn((source: string) => source),
}));

vi.mock("../lib/i18n", () => i18n);

import { V197ApiError } from "./v197ApiClient";
import { visibleV197Failure } from "./v197FailureCopy";

describe("visible V197 failure copy", () => {
  it("classifies API failures without exposing raw backend detail", () => {
    const failure = new V197ApiError("database host db-1 refused the request", 503);

    const visible = visibleV197Failure(failure, "The action could not be persisted.");

    expect(visible).toBe("[localized] NUR could not complete this server action.");
    expect(visible).not.toContain("db-1");
  });

  it("uses the honest provider-disabled message from the catalog", () => {
    const failure = new V197ApiError("OPENAI_API_KEY is absent", 503, "provider_disabled");

    expect(visibleV197Failure(failure, "The action could not be persisted.")).toBe(
      "[localized] Live AI is not connected on this server, so NUR did not answer this turn. Your message was kept; nothing was invented.",
    );
  });

  it("does not trust arbitrary non-API diagnostics as visible copy", () => {
    expect(visibleV197Failure(new Error("Unexpected token at byte 17"), "The action could not be persisted.")).toBe(
      "[localized] The action could not be persisted.",
    );
  });
});
