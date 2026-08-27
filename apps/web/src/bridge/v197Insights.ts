import INSIGHTS_CSS from "../styles/v197-insights.css?raw";
import type { V197BridgeSnapshot, V197Insights } from "./v197ApiClient";
import { claimV197SurfaceHost, releaseV197SurfaceHost } from "./v197SurfaceHost";
import { uiCopy, uiFormat, uiSource } from "../lib/i18n";

const ROOT_ID = "nur-insights-root";
const STYLE_ID = "nur-insights-style";

export const INSIGHTS_ROUTE = "/universe/insights";

type InsightRow = Record<string, unknown>;

/**
 * V197-owned interface copy only. Persisted claims, evidence, domains and API
 * statuses stay verbatim below: they are owner data or machine values, not UI.
 */
const INSIGHTS_COPY = {
  ownerInterpretationField: uiSource("OWNER INTERPRETATION FIELD"),
  insights: uiSource("Insights"),
  subtitle: uiSource("Patterns, tensions and possible futures held against persisted owner evidence."),
  ownerLedgerUnavailable: uiSource("owner ledger unavailable"),
  candidateClaims: uiSource("Candidate claims"),
  openTensions: uiSource("Open tensions"),
  predictions: uiSource("Predictions"),
  awaitingReview: uiSource("Awaiting review"),
  persistedInsights: uiSource("Persisted insights"),
  interpretations: uiSource("Interpretations"),
  evidenceState: uiSource("EVIDENCE STATE"),
  noReliableInsight: uiSource("No reliable insight yet."),
  evidenceThreshold: uiSource("NUR needs persisted evidence across time or domains before it surfaces an interpretation."),
  sourceDomainsNotRecorded: uiSource("Source domains not recorded"),
  persistedCandidateInsight: uiSource("Persisted candidate insight"),
  confidenceNotMeasured: uiSource("Confidence has not been measured."),
  sourceDomains: uiSource("Source domains"),
  evidenceRecords: uiSource("Evidence records"),
  whatNurMayBeWrongAbout: uiSource("What NUR may be wrong about"),
  interpretationLimit: uiSource("This interpretation is limited to what the owner has recorded."),
  suggestedNextMove: uiSource("Suggested next move"),
  noActionProposed: uiSource("No action has been proposed."),
  noCandidatePersisted: uiSource("No candidate interpretation has been persisted."),
  reviewState: uiSource("Review state"),
  possibleFutures: uiSource("Possible futures"),
  ownerReview: uiSource("Owner review"),
  noOpenContradiction: uiSource("No open contradiction is persisted."),
  noUnresolvedPrediction: uiSource("No unresolved prediction is persisted."),
  nothingWaitingForReview: uiSource("Nothing is waiting for owner review."),
  persistedRecordAwaitingReview: uiSource("Persisted record awaiting review."),
  candidate: uiSource("CANDIDATE"),
  openHorizon: uiSource("OPEN HORIZON"),
} as const;

function el<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className?: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function ensureStyle(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = INSIGHTS_CSS;
  document.head.append(style);
}

function text(row: InsightRow | null | undefined, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function rows(insights: V197Insights | null): InsightRow[] {
  if (!insights) return [];
  if (insights.dedicated_insights?.length) return insights.dedicated_insights;
  return insights.claims;
}

function list(
  document: Document,
  title: string,
  source: InsightRow[],
  display: (row: InsightRow) => string,
  empty: string,
): HTMLElement {
  const section = el(document, "section", "nur-insights-review-section");
  section.append(el(document, "h3", "nur-insights-review-title", title));
  if (!source.length) {
    section.append(el(document, "p", "nur-insights-empty", empty));
    return section;
  }
  const items = el(document, "ul", "nur-insights-review-list");
  for (const row of source.slice(0, 4)) {
    const item = el(document, "li", "nur-insights-review-item");
    item.append(el(document, "span", "nur-insights-review-mark", "*"));
    item.append(el(document, "span", "", display(row)));
    items.append(item);
  }
  section.append(items);
  return section;
}

function countOf(insights: V197Insights | null, key: string, source: InsightRow[]): number {
  return number(insights?.counts[key], source.length);
}

export function renderV197Insights(
  document: Document,
  route: string,
  snapshot: V197BridgeSnapshot | null,
): boolean {
  if (route !== INSIGHTS_ROUTE) {
    document.getElementById(ROOT_ID)?.remove();
    releaseV197SurfaceHost(document);
    return false;
  }

  ensureStyle(document);
  const host = claimV197SurfaceHost(document);
  if (!host) {
    releaseV197SurfaceHost(document);
    return false;
  }

  const insights = snapshot?.insights ?? null;
  const claims = rows(insights);
  let selected = 0;

  const root = el(document, "div");
  root.id = ROOT_ID;
  root.dataset.v197NativeAdjunct = "true";
  root.dataset.insightsLoaded = "true";
  root.dataset.nurBrainSurface = "none";

  const shell = el(document, "div", "nur-insights-shell");
  const header = el(document, "header", "nur-insights-header");
  const heading = el(document, "div", "nur-insights-heading");
  heading.append(el(document, "p", "nur-insights-kicker", uiCopy(INSIGHTS_COPY.ownerInterpretationField)));
  heading.append(el(document, "h1", "", uiCopy(INSIGHTS_COPY.insights)));
  heading.append(el(
    document,
    "p",
    "nur-insights-subtitle",
    uiCopy(INSIGHTS_COPY.subtitle),
  ));
  const provenance = el(
    document,
    "p",
    "nur-insights-provenance",
    insights?.provenance_label ?? uiCopy(INSIGHTS_COPY.ownerLedgerUnavailable),
  );
  header.append(heading, provenance);

  const counts = el(document, "div", "nur-insights-counts");
  const countData = [
    [INSIGHTS_COPY.candidateClaims, countOf(insights, "claims", claims)],
    [INSIGHTS_COPY.openTensions, countOf(insights, "open_contradictions", insights?.contradictions ?? [])],
    [INSIGHTS_COPY.predictions, countOf(insights, "predictions", insights?.predictions ?? [])],
    [INSIGHTS_COPY.awaitingReview, countOf(insights, "review_queue", insights?.review_queue ?? [])],
  ] as const;
  for (const [label, value] of countData) {
    const count = el(document, "div", "nur-insights-count");
    count.append(el(document, "strong", "", String(value)));
    count.append(el(document, "span", "", uiCopy(label)));
    counts.append(count);
  }

  const zones = el(document, "div", "nur-insights-zones");
  const navigator = el(document, "nav", "nur-insights-pane nur-insights-nav");
  navigator.setAttribute("aria-label", uiCopy(INSIGHTS_COPY.persistedInsights));
  navigator.append(el(document, "h2", "nur-insights-pane-title", uiCopy(INSIGHTS_COPY.interpretations)));
  const navList = el(document, "div", "nur-insights-nav-list");

  const detail = el(document, "main", "nur-insights-pane nur-insights-detail");
  const renderDetail = (): void => {
    detail.replaceChildren();
    const row = claims[selected] ?? null;
    if (!row) {
      detail.append(el(document, "p", "nur-insights-detail-kicker", uiCopy(INSIGHTS_COPY.evidenceState)));
      detail.append(el(document, "h2", "nur-insights-detail-title", uiCopy(INSIGHTS_COPY.noReliableInsight)));
      detail.append(el(
        document,
        "p",
        "nur-insights-detail-copy",
        uiCopy(INSIGHTS_COPY.evidenceThreshold),
      ));
      return;
    }
    const confidence = number(row.confidence, -1);
    const domains = Array.isArray(row.source_domains)
      ? row.source_domains.filter(value => typeof value === "string").join(" / ")
      : uiCopy(INSIGHTS_COPY.sourceDomainsNotRecorded);
    detail.append(el(
      document,
      "p",
      "nur-insights-detail-kicker",
      uiFormat("{0} / {1}", [
        text(row, ["truth_status", "epistemic_state"], uiCopy(INSIGHTS_COPY.candidate)),
        text(row, ["time_scale"], uiCopy(INSIGHTS_COPY.openHorizon)),
      ]),
    ));
    detail.append(el(
      document,
      "h2",
      "nur-insights-detail-title",
      text(row, ["claim_text", "title", "claim"], uiCopy(INSIGHTS_COPY.persistedCandidateInsight)),
    ));
    detail.append(el(
      document,
      "p",
      "nur-insights-detail-copy",
      confidence >= 0
        ? uiFormat("{0}% confidence from the current owner evidence.", [Math.round(confidence * 100)])
        : uiCopy(INSIGHTS_COPY.confidenceNotMeasured),
    ));

    const evidence = el(document, "div", "nur-insights-evidence");
    const evidenceRows = [
      [INSIGHTS_COPY.sourceDomains, domains],
      [INSIGHTS_COPY.evidenceRecords, String(Array.isArray(row.evidence) ? row.evidence.length : 0)],
      [INSIGHTS_COPY.whatNurMayBeWrongAbout, text(
        row,
        ["what_nur_may_be_wrong_about"],
        uiCopy(INSIGHTS_COPY.interpretationLimit),
      )],
      [INSIGHTS_COPY.suggestedNextMove, text(
        row,
        ["suggested_action"],
        uiCopy(INSIGHTS_COPY.noActionProposed),
      )],
    ] as const;
    for (const [label, value] of evidenceRows) {
      const field = el(document, "div", "nur-insights-field");
      field.append(el(document, "span", "", uiCopy(label)));
      field.append(el(document, "p", "", value));
      evidence.append(field);
    }
    detail.append(evidence);
  };

  if (!claims.length) {
    navList.append(el(document, "p", "nur-insights-empty", uiCopy(INSIGHTS_COPY.noCandidatePersisted)));
  } else {
    claims.forEach((row, index) => {
      const button = el(
        document,
        "button",
        "nur-insights-nav-item",
        text(row, ["title", "claim_text", "claim"], uiFormat("Insight {0}", [index + 1])),
      );
      button.type = "button";
      button.setAttribute("aria-pressed", index === selected ? "true" : "false");
      button.addEventListener("click", () => {
        selected = index;
        navList.querySelectorAll("button").forEach((control, controlIndex) => {
          control.setAttribute("aria-pressed", controlIndex === selected ? "true" : "false");
        });
        renderDetail();
      });
      navList.append(button);
    });
  }
  navigator.append(navList);

  const review = el(document, "aside", "nur-insights-pane nur-insights-review");
  review.append(el(document, "h2", "nur-insights-pane-title", uiCopy(INSIGHTS_COPY.reviewState)));
  review.append(list(
    document,
    uiCopy(INSIGHTS_COPY.openTensions),
    insights?.contradictions ?? [],
    row => text(row, ["description", "claim_text", "title"], uiCopy(INSIGHTS_COPY.persistedRecordAwaitingReview)),
    uiCopy(INSIGHTS_COPY.noOpenContradiction),
  ));
  review.append(list(
    document,
    uiCopy(INSIGHTS_COPY.possibleFutures),
    insights?.predictions ?? [],
    row => text(row, ["prediction_text", "description", "title"], uiCopy(INSIGHTS_COPY.persistedRecordAwaitingReview)),
    uiCopy(INSIGHTS_COPY.noUnresolvedPrediction),
  ));
  review.append(list(
    document,
    uiCopy(INSIGHTS_COPY.ownerReview),
    insights?.review_queue ?? [],
    row => text(
      row,
      ["title", "claim_text", "candidate_claim_text", "description"],
      uiCopy(INSIGHTS_COPY.persistedRecordAwaitingReview),
    ),
    uiCopy(INSIGHTS_COPY.nothingWaitingForReview),
  ));

  renderDetail();
  zones.append(navigator, detail, review);
  shell.append(header, counts, zones);
  root.append(shell);
  host.replaceChildren(root);
  return true;
}
