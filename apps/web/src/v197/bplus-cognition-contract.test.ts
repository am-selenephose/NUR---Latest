import { describe, expect, it } from "vitest";

import {
  buildV197CognitionState,
  cognitionForRecord,
  toCognitionViewModel,
} from "../bridge/v197Cognition";

const claim = {
  id: "claim-1",
  claim_text: "Persisted outcomes should change planning confidence.",
  truth_status: "INFERRED",
  epistemic_status: "INFERRED",
  authority_status: "OWNER_CONFIRMED",
  confidence: 0.82,
  support_count: 2,
  contradiction_count: 1,
  chain_of_thought: "never expose this",
  reasoning: "never expose this either",
};

const dashboard = {
  statuses: {},
  claims: [claim],
  contradictions: [{
    id: "contradiction-1",
    claim_a_id: "claim-1",
    claim_b_id: "claim-2",
    status: "OPEN",
    severity: "HIGH",
    description: "Outcome evidence disagrees with the current claim.",
  }],
  predictions: [{
    id: "prediction-1",
    claim_id: "claim-1",
    prediction_text: "A returned outcome will improve planning confidence.",
    status: "OPEN",
    confidence: 0.68,
  }],
  learning_proposals: [{
    id: "proposal-1",
    proposal_kind: "PLANNING_HEURISTIC",
    status: "PROPOSED",
    approved_by_owner: false,
  }],
  consolidation_runs: [],
  recent_experiences: [],
  review_queue: [],
};

describe("B+ V197 cognition receipts", () => {
  it("keeps observation, inference, and owner authority visually distinguishable", () => {
    const vm = toCognitionViewModel(claim);
    expect(vm.epistemicStatus).toBe("INFERRED");
    expect(vm.authorityStatus).toBe("OWNER_CONFIRMED");
    expect(vm.confidence).toBe(0.82);
    expect(vm.whyChangedHref).toBe("/universe/omega/why-changed/claim-1");
  });

  it("assembles ambient contradiction, prediction, and learning state from canonical Omega", () => {
    const state = buildV197CognitionState(dashboard);
    expect(state.openContradictions).toHaveLength(1);
    expect(state.openPredictions).toHaveLength(1);
    expect(state.learningState.proposed).toBe(1);
    expect(state.learningState.approved).toBe(0);
  });

  it("links an existing semantic record to its canonical claim receipt", () => {
    const state = buildV197CognitionState(dashboard);
    expect(cognitionForRecord({ record_kind: "OMEGA_CLAIM", id: "claim-1" }, state)?.claimId)
      .toBe("claim-1");
    expect(cognitionForRecord({ canonical_omega_claim_id: "claim-1" }, state)?.authorityStatus)
      .toBe("OWNER_CONFIRMED");
  });

  it("never projects raw reasoning fields into the V197 receipt", () => {
    const vm = toCognitionViewModel(claim) as unknown as Record<string, unknown>;
    expect(vm.chain_of_thought).toBeUndefined();
    expect(vm.reasoning).toBeUndefined();
    expect(JSON.stringify(vm)).not.toContain("never expose this");
  });
});
