import type { V197OmegaDashboard } from "./v197ApiClient";

export interface V197CognitionReceipt {
  claimId: string;
  claimText: string;
  truthStatus: string;
  epistemicStatus: string;
  authorityStatus: string;
  confidence: number | null;
  supportCount: number;
  contradictionCount: number;
  whyChangedHref: string;
}

export interface V197CognitionState {
  claims: V197CognitionReceipt[];
  claimsById: Record<string, V197CognitionReceipt>;
  openContradictions: Array<{
    id: string;
    claimAId: string | null;
    claimBId: string | null;
    severity: string;
    description: string;
  }>;
  openPredictions: Array<{
    id: string;
    text: string;
    status: string;
    confidence: number | null;
  }>;
  learningState: {
    proposed: number;
    approved: number;
    rejected: number;
    rolledBack: number;
  };
}

type UnknownRow = Record<string, unknown>;

function text(row: UnknownRow, key: string, fallback = "UNKNOWN"): string {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalText(row: UnknownRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function toCognitionViewModel(row: UnknownRow): V197CognitionReceipt {
  const claimId = text(row, "id", "");
  return {
    claimId,
    claimText: text(row, "claim_text", "Held canonical claim"),
    truthStatus: text(row, "truth_status"),
    epistemicStatus: text(row, "epistemic_status", text(row, "truth_status")),
    authorityStatus: text(row, "authority_status", "LEGACY_UNRESOLVED"),
    confidence: finiteNumber(row.confidence),
    supportCount: count(row.support_count),
    contradictionCount: count(row.contradiction_count),
    whyChangedHref: `/universe/omega/why-changed/${encodeURIComponent(claimId)}`,
  };
}

export function buildV197CognitionState(
  dashboard: Pick<V197OmegaDashboard, "claims" | "contradictions" | "predictions" | "learning_proposals">,
): V197CognitionState {
  const claims = dashboard.claims.map(row => toCognitionViewModel(row));
  const claimsById = Object.fromEntries(claims.map(row => [row.claimId, row]));
  const openContradictions = dashboard.contradictions
    .filter(row => text(row, "status") === "OPEN")
    .map(row => ({
      id: text(row, "id", ""),
      claimAId: optionalText(row, "claim_a_id"),
      claimBId: optionalText(row, "claim_b_id"),
      severity: text(row, "severity", "UNSPECIFIED"),
      description: text(row, "description", "Open contradiction"),
    }));
  const openPredictions = dashboard.predictions
    .filter(row => text(row, "status") === "OPEN")
    .map(row => ({
      id: text(row, "id", ""),
      text: text(row, "prediction_text", text(row, "statement", "Open prediction")),
      status: text(row, "status"),
      confidence: finiteNumber(row.confidence),
    }));
  const learningState = { proposed: 0, approved: 0, rejected: 0, rolledBack: 0 };
  for (const row of dashboard.learning_proposals) {
    const status = text(row, "status");
    if (status === "PROPOSED") learningState.proposed += 1;
    if (status === "APPROVED") learningState.approved += 1;
    if (status === "REJECTED") learningState.rejected += 1;
    if (status === "ROLLED_BACK") learningState.rolledBack += 1;
  }
  return { claims, claimsById, openContradictions, openPredictions, learningState };
}

export function cognitionForRecord(
  record: UnknownRow | null | undefined,
  state: V197CognitionState | null | undefined,
): V197CognitionReceipt | null {
  if (!record || !state) return null;
  const candidates = [
    record.canonical_omega_claim_id,
    record.omega_claim_id,
    record.claim_id,
    record.record_kind === "OMEGA_CLAIM" ? record.id : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && state.claimsById[candidate]) {
      return state.claimsById[candidate];
    }
  }
  return null;
}

export function cognitionSummaryLines(state: V197CognitionState | null | undefined): string[] {
  if (!state) return [];
  return [
    `${state.openContradictions.length} open contradiction${state.openContradictions.length === 1 ? "" : "s"}`,
    `${state.openPredictions.length} open prediction${state.openPredictions.length === 1 ? "" : "s"}`,
    `${state.learningState.proposed} learning proposal${state.learningState.proposed === 1 ? "" : "s"} awaiting owner decision`,
  ];
}
