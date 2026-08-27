/**
 * Map — systems, paths and possible futures, rendered V197-native.
 *
 * Plain DOM and SVG through the bridge, not React. §38's component tree is
 * preserved as the function decomposition below (`mapHeader`, `mapNavigator`,
 * `mapCanvas`, `mapPathsView`, `mapDecisionsView`, `mapDetailPanel` and the tab
 * renderers), because the architecture law is that the canonical V197 document
 * owns the visible product and `#root` never appears on a product page.
 *
 * Everything displayed comes from `/api/v1/map*`. There is no sample goal, no
 * placeholder route and no invented blocker anywhere in this file: an owner with
 * an empty Map sees Systems and an empty state, because a map that shows
 * imaginary territory is worse than no map.
 *
 * Three rules shape the rendering, and each is asserted by a test:
 *
 *   A candidate never looks like structure. Anything NUR proposed renders dashed,
 *   dimmer, marked "NUR suggests", and carries Accept / Reject / Why. Confirmed
 *   structure is solid. Nothing crosses that line without the owner.
 *
 *   A prediction never looks settled. Translucent, dotted perimeter, confidence
 *   and assumptions on the card. An outcome is crystallised and solid.
 *
 *   An unmeasured dimension says "Not assessed" rather than showing a number.
 *   The path lanes are mostly honest absences at first, and that is correct.
 *
 * Layout is presentation only. Dragging writes x/y through
 * `PUT /map/views/{id}/layout` and the server refuses to let position change
 * meaning, so a goal moved next to Money is still a Creation goal.
 */

import MAP_CSS from "../styles/v197-map.css?raw";
import { markV197HolographicWordmark } from "./v197Brand";
import {
  cancelV197SearchCommit,
  captureV197SearchFocus,
  restoreV197SearchFocus,
  scheduleV197SearchCommit,
} from "./v197SearchInput";
import { createV197StarSeal } from "./v197StarSeal";
import { claimV197SurfaceHost, releaseV197SurfaceHost } from "./v197SurfaceHost";
import type { V197ApiClient } from "./v197ApiClient";
import { v197SystemTitle } from "./v197SystemCopy";
import {
  structuralValue,
  type UiCopyKey,
  uiCopy,
  uiFormat,
  uiSource,
  verbatimUserText,
} from "../lib/i18n";

const ROOT_ID = "nur-map-root";
const STYLE_ID = "nur-map-style";
const SEARCH_KEY = "map";
const SEARCH_SELECTOR = ".nur-map-search";

export const MAP_ROUTE = "/universe/map";

export type MapMode = "universe" | "focus" | "paths" | "decisions";

type DetailTab = "overview" | "path" | "evidence" | "activity" | "nur";

interface GraphNode {
  id: string;
  kind: string;
  label: string;
  parent_id: string | null;
  status: string;
  data: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: string;
  semantic?: boolean;
  user_confirmed?: boolean;
  inference_source?: string | null;
  confidence?: number | null;
  note?: string | null;
  resolvable?: boolean;
  direction?: string;
}

interface SystemRegion {
  slug: string;
  title: string;
  node_id: string;
  state: string;
  state_reason: string;
  progress_percent: number;
  active_goal_count: number;
  returned_outcome_count?: number;
  blocker_count: number;
  next_move: unknown;
  layout: { x: number; y: number; radius: number };
}

export function formatV197SystemStateReason(region: Pick<
  SystemRegion,
  "active_goal_count" | "returned_outcome_count" | "progress_percent" | "blocker_count"
>): string {
  const goals = region.active_goal_count === 0
    ? uiCopy("No active goal")
    : region.active_goal_count === 1
      ? uiFormat("{0} active goal", [region.active_goal_count])
      : uiFormat("{0} active goals", [region.active_goal_count]);
  const outcomes = (region.returned_outcome_count ?? 0) === 0
    ? uiCopy("no returned outcome yet")
    : region.returned_outcome_count === 1
      ? uiFormat("{0} returned outcome", [region.returned_outcome_count])
      : uiFormat("{0} returned outcomes", [region.returned_outcome_count]);
  const progress = uiFormat("{0}% verified progress", [region.progress_percent]);
  const blockers = region.blocker_count === 0
    ? uiCopy("no unresolved blocker")
    : region.blocker_count === 1
      ? uiFormat("{0} unresolved blocker", [region.blocker_count])
      : uiFormat("{0} unresolved blockers", [region.blocker_count]);
  return uiFormat("{0}, {1}, {2}. {3}.", [goals, outcomes, progress, blockers]);
}

const SMART_SECTION_REASON_COPY: Record<string, UiCopyKey> = {
  current_focus: uiSource("Recorded in the current owner focus."),
  needs_decision: uiSource("A persisted decision is still open."),
  blocked: uiSource("A persisted blocker is unresolved."),
  momentum: uiSource("Recent owner evidence shows movement."),
  fragile_paths: uiSource("This path holds an unresolved dependency."),
  recently_changed: uiSource("This owner record changed recently."),
};

export function formatV197SmartSectionReason(
  sectionKey: string,
  hasServerReason: boolean,
): string {
  if (!hasServerReason) return "";
  return uiCopy(
    SMART_SECTION_REASON_COPY[sectionKey]
      ?? uiSource("This owner record needs attention."),
  );
}

interface Suggestion {
  id: string;
  suggestion_type: string;
  explanation: string;
  may_be_wrong_about: string;
  confidence: number | null;
  source_refs: { type?: string; id?: string }[];
}

interface MapGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  system_regions: SystemRegion[];
  counts: Record<string, number>;
  suggested_changes: { candidate_edges: GraphEdge[]; suggestions: Suggestion[] };
  staleness: Record<string, unknown>;
  permissions: Record<string, boolean>;
  future_paths: {
    system_slug: string;
    current_progress: number;
    if_continued: string;
    if_ignored: string;
    basis: string;
  }[];
}

const EMPTY_GRAPH: MapGraph = {
  nodes: [],
  edges: [],
  system_regions: [],
  counts: {},
  suggested_changes: { candidate_edges: [], suggestions: [] },
  staleness: {},
  permissions: {},
  future_paths: [],
};

/** §10's state language. Each pairs a word with a glyph, never a score. */
const STATE_WORD: Record<string, UiCopyKey> = {
  STABLE: uiSource("Stable"),
  BUILDING: uiSource("Building"),
  ACTIVE: uiSource("Active"),
  STALLED: uiSource("Stalled"),
  RECOVERING: uiSource("Recovering"),
  AT_RISK: uiSource("At risk"),
  UNCLEAR: uiSource("Unclear"),
  DORMANT: uiSource("Dormant"),
};

const STATE_GLYPH: Record<string, string> = {
  STABLE: "◈",
  BUILDING: "◇",
  ACTIVE: "◆",
  STALLED: "◌",
  RECOVERING: "◐",
  AT_RISK: "△",
  UNCLEAR: "○",
  DORMANT: "·",
};

/** Edge meaning → CSS class. Hue and dash both come from this one mapping. */
const EDGE_CLASS: Record<string, string> = {
  MASTER_TO_SYSTEM: "nur-map-edge-contains",
  SYSTEM_TO_GOAL: "nur-map-edge-contains",
  GOAL_TO_OBJECTIVE: "nur-map-edge-contains",
  PLAN_TO_STEP: "nur-map-edge-contains",
  SYSTEM_TO_PLAN: "nur-map-edge-contains",
  MASTER_TO_PLAN: "nur-map-edge-contains",
  PROJECT_TO_TASK: "nur-map-edge-contains",
  SYSTEM_TO_DECISION: "nur-map-edge-contains",
  MASTER_TO_DECISION: "nur-map-edge-contains",
  SYSTEM_TO_ACTION: "nur-map-edge-contains",
  SYSTEM_TO_OUTCOME: "nur-map-edge-contains",
  SCHEDULED_ON_TIMELINE: "nur-map-edge-contains",
  PART_OF: "nur-map-edge-contains",
  DEPENDS_ON: "nur-map-edge-depends",
  SUPPORTS: "nur-map-edge-supports",
  ENABLES: "nur-map-edge-enables",
  BLOCKS: "nur-map-edge-blocks",
  SYSTEM_TO_BLOCKER: "nur-map-edge-blocks",
  CONTRADICTS: "nur-map-edge-contradicts",
  LEADS_TO: "nur-map-edge-leads",
  LEADS_TO_OPTION: "nur-map-edge-leads",
  EVIDENCE_FOR: "nur-map-edge-evidence",
  CAME_FROM_RESEARCH: "nur-map-edge-evidence",
  WEB_SIGNAL_SAVED: "nur-map-edge-evidence",
  INVOLVES: "nur-map-edge-involves",
  INVOLVES_PERSON: "nur-map-edge-involves",
  ORBIT_MEMBER: "nur-map-edge-involves",
  SYSTEM_TO_ORBIT: "nur-map-edge-involves",
  PREDICTED_TO_PRODUCE: "nur-map-edge-predicted",
  PATH_PREDICTION: "nur-map-edge-predicted",
};

/** Why two things are connected, in words. Hovering a line must answer this. */
const EDGE_MEANING: Record<string, UiCopyKey> = {
  DEPENDS_ON: uiSource("cannot move until the other does"),
  SUPPORTS: uiSource("helps the other along"),
  ENABLES: uiSource("makes the other possible"),
  BLOCKS: uiSource("is stopping the other"),
  CONTRADICTS: uiSource("argues against the other"),
  LEADS_TO: uiSource("leads to the other"),
  EVIDENCE_FOR: uiSource("is evidence for the other"),
  INVOLVES: uiSource("involves the other"),
  PART_OF: uiSource("is part of the other"),
  PREDICTED_TO_PRODUCE: uiSource("is predicted to produce the other"),
  MASTER_TO_SYSTEM: uiSource("is one of your Systems"),
  SYSTEM_TO_GOAL: uiSource("is a goal inside this System"),
  GOAL_TO_OBJECTIVE: uiSource("is a milestone of this goal"),
  LEADS_TO_OPTION: uiSource("is one option for this decision"),
};

/** Node radius per kind. Fixed, so no score can inflate a node. */
const NODE_RADIUS: Record<string, number> = {
  MASTER_STAR: 34,
  SYSTEM: 20,
  GOAL: 13,
  OBJECTIVE: 8,
  PLAN: 10,
  PLAN_STEP: 6,
  ACTION: 6,
  DECISION: 12,
  DECISION_OPTION: 7,
  BLOCKER: 11,
  OUTCOME: 9,
  PREDICTION: 11,
  INSIGHT: 8,
  PERSON: 9,
  PROJECT: 10,
  PROJECT_TASK: 6,
  TIMELINE_EVENT: 6,
  RESEARCH_SOURCE: 6,
  WEB_SIGNAL: 6,
  GLOW_MILESTONE: 6,
};

const KIND_WORD: Record<string, UiCopyKey> = {
  MASTER_STAR: uiSource("You"),
  SYSTEM: uiSource("System"),
  GOAL: uiSource("Goal"),
  OBJECTIVE: uiSource("Objective"),
  PLAN: uiSource("Plan"),
  PLAN_STEP: uiSource("Plan step"),
  ACTION: uiSource("Action"),
  DECISION: uiSource("Decision"),
  DECISION_OPTION: uiSource("Option"),
  BLOCKER: uiSource("Blocker"),
  OUTCOME: uiSource("Outcome"),
  PREDICTION: uiSource("Prediction"),
  INSIGHT: uiSource("Insight"),
  PERSON: uiSource("Person"),
  PROJECT: uiSource("Project"),
  PROJECT_TASK: uiSource("Project task"),
  TIMELINE_EVENT: uiSource("Scheduled"),
  RESEARCH_SOURCE: uiSource("Research source"),
  WEB_SIGNAL: uiSource("Web signal"),
  GLOW_MILESTONE: uiSource("Glow milestone"),
};

/** §23's evidence classes → the word and hue shown on the card. */
const BASIS_PRESENTATION: Record<string, { word: UiCopyKey; cls: string; glyph: string }> = {
  DIRECT_FACT: { word: uiSource("Recorded fact"), cls: "nur-map-basis-fact", glyph: "◆" },
  USER_INTERPRETATION: { word: uiSource("You said"), cls: "nur-map-basis-user", glyph: "✎" },
  MODEL_INFERENCE: { word: uiSource("NUR inferred"), cls: "nur-map-basis-inference", glyph: "◈" },
  EXTERNAL_SOURCE: { word: uiSource("External source"), cls: "nur-map-basis-external", glyph: "⌖" },
  PREDICTION: { word: uiSource("Prediction"), cls: "nur-map-basis-prediction", glyph: "◇" },
  UNRESOLVED_CLAIM: { word: uiSource("Unresolved"), cls: "nur-map-basis-inference", glyph: "?" },
};

const BLOCKER_CATEGORY_WORD: Readonly<Record<string, UiCopyKey>> = {
  PRACTICAL: uiSource("Practical"),
  TECHNICAL: uiSource("Technical"),
  FINANCIAL: uiSource("Financial"),
  TIME: uiSource("Time"),
  KNOWLEDGE: uiSource("Knowledge"),
  EMOTIONAL: uiSource("Emotional"),
  PSYCHOLOGICAL: uiSource("Psychological"),
  RELATIONAL: uiSource("Relational"),
  HEALTH: uiSource("Health"),
  EXTERNAL: uiSource("External"),
};

const BLOCKER_STATUS_WORD: Readonly<Record<string, UiCopyKey>> = {
  PROPOSED: uiSource("Proposed"),
  OPEN: uiSource("Open"),
  RESOLVED: uiSource("Resolved"),
  CHALLENGED: uiSource("Challenged"),
  DISMISSED: uiSource("Dismissed"),
};

const SUGGESTION_TYPE_WORD: Readonly<Record<string, UiCopyKey>> = {
  CONNECTION: uiSource("Connection"),
  DEPENDENCY: uiSource("Dependency"),
  BLOCKER: uiSource("Blocker"),
  CONFLICTING_GOAL: uiSource("Conflicting goal"),
  DUPLICATE_PLAN: uiSource("Duplicate plan"),
  STALE_ASSUMPTION: uiSource("Stale assumption"),
  PATH: uiSource("Path"),
  SYSTEM_IMBALANCE: uiSource("System imbalance"),
};

const REVERSIBILITY_WORD: Readonly<Record<string, UiCopyKey>> = {
  EASY: uiSource("Easy to undo"),
  COSTLY: uiSource("Costly to undo"),
  MOSTLY_IRREVERSIBLE: uiSource("Mostly irreversible"),
  NOT_ASSESSED: uiSource("Not assessed"),
};

const PREDICTION_RESOLUTION_WORD: Readonly<Record<string, UiCopyKey>> = {
  CONFIRMED: uiSource("Confirmed"),
  PARTIALLY_CONFIRMED: uiSource("Partially confirmed"),
  CONTRADICTED: uiSource("Contradicted"),
};

const EVIDENCE_SOURCE_WORD: Readonly<Record<string, UiCopyKey>> = {
  YOUR_NOTE: uiSource("Your note"),
  MAP_CONNECTION: uiSource("Map connection"),
  BLOCKER: uiSource("Blocker"),
  TIMELINE: uiSource("Timeline"),
};

const ACTIVITY_KIND_WORD: Readonly<Record<string, UiCopyKey>> = {
  ACTION: uiSource("Action"),
  EVENT: uiSource("Event"),
  GOAL_MILESTONE: uiSource("Goal milestone"),
  MILESTONE: uiSource("Milestone"),
  DECISION: uiSource("Decision"),
  TIME_BLOCK: uiSource("Time block"),
  PLAN_STEP_DUE: uiSource("Plan step due"),
  OUTCOME_REPORTED: uiSource("Outcome reported"),
  OUTCOME_RETURNED: uiSource("Outcome returned"),
  EASIER_NEXT_MOVE: uiSource("Easier next move"),
  FEASIBILITY_NEXT_MOVE: uiSource("Feasibility next move"),
  DAILY_CHECKIN: uiSource("Daily check-in"),
  PLAN_CREATED: uiSource("Plan created"),
  PLAN_STEP_COMPLETED: uiSource("Plan step completed"),
  SCHEDULE_CREATED: uiSource("Schedule created"),
  CONSULTATION_RETURN: uiSource("Consultation return"),
  INSIGHT_REVIEW_DUE: uiSource("Insight review due"),
  NOTE_ADDED: uiSource("Note added"),
};

const MAP_ERROR_CODE_WORD: Readonly<Record<string, UiCopyKey>> = {
  CAPABILITY_DENIED: uiSource("This action is not available with the current permission."),
  CSRF_MISSING: uiSource("Your NUR session needs to be renewed."),
  SESSION_EXPIRED: uiSource("Your NUR session needs to be renewed."),
  NOT_FOUND: uiSource("That record is no longer available."),
  CONFLICT: uiSource("That record changed before NUR could save this action."),
  RATE_LIMITED: uiSource("NUR is receiving too many requests. Try again shortly."),
};

const MAP_ERROR_STATUS_WORD: Readonly<Record<number, UiCopyKey>> = {
  0: uiSource("NUR could not reach the service."),
  200: uiSource("NUR returned an invalid response."),
  400: uiSource("NUR could not use that request."),
  401: uiSource("Your NUR session needs to be renewed."),
  403: uiSource("This action is not available with the current permission."),
  404: uiSource("That record is no longer available."),
  409: uiSource("That record changed before NUR could save this action."),
  422: uiSource("NUR could not use one of the submitted values."),
  429: uiSource("NUR is receiving too many requests. Try again shortly."),
  500: uiSource("NUR could not complete that request."),
  502: uiSource("NUR could not reach the service."),
  503: uiSource("NUR could not reach the service."),
  504: uiSource("NUR could not reach the service."),
};

function controlledToken(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replaceAll("-", "_").replaceAll(" ", "_").toUpperCase()
    : "";
}

function controlledLabel(
  words: Readonly<Record<string, UiCopyKey>>,
  value: unknown,
  fallback: UiCopyKey = uiSource("Unclear"),
): string {
  return uiCopy(words[controlledToken(value)] ?? fallback);
}

export function mapBlockerCategoryLabel(value: unknown): string {
  return controlledLabel(BLOCKER_CATEGORY_WORD, value);
}

export function mapBlockerStatusLabel(value: unknown): string {
  return controlledLabel(BLOCKER_STATUS_WORD, value);
}

export function mapSuggestionTypeLabel(value: unknown): string {
  return controlledLabel(SUGGESTION_TYPE_WORD, value);
}

export function mapReversibilityLabel(value: unknown): string {
  return controlledLabel(REVERSIBILITY_WORD, value);
}

export function mapPredictionResolutionLabel(value: unknown): string {
  return controlledLabel(PREDICTION_RESOLUTION_WORD, value);
}

export function mapEvidenceSourceLabel(value: unknown): string {
  return controlledLabel(EVIDENCE_SOURCE_WORD, value);
}

export function mapActivityKindLabel(value: unknown): string {
  return controlledLabel(ACTIVITY_KIND_WORD, value, uiSource("Event"));
}

/** Visible errors are localized classifications; raw diagnostics stay in devtools. */
export function mapVisibleFailure(
  error: unknown,
  fallback: UiCopyKey = uiSource("NUR could not complete that request."),
  context = "request",
): string {
  console.error(`[NUR Map] ${context}`, error);
  const detail = typeof error === "object" && error !== null
    ? error as { code?: unknown; status?: unknown }
    : null;
  const code = controlledToken(detail?.code);
  const status = typeof detail?.status === "number" ? detail.status : null;
  const source = (code && MAP_ERROR_CODE_WORD[code])
    || (status !== null && MAP_ERROR_STATUS_WORD[status])
    || (status !== null && status >= 500 ? MAP_ERROR_STATUS_WORD[500] : undefined)
    || fallback;
  return uiCopy(source);
}

const OBJECT_FILTERS: { key: string; label: UiCopyKey; kinds: string[] }[] = [
  { key: "all", label: uiSource("All"), kinds: [] },
  { key: "goals", label: uiSource("Goals"), kinds: ["GOAL", "OBJECTIVE"] },
  { key: "plans", label: uiSource("Plans"), kinds: ["PLAN", "PLAN_STEP", "ACTION"] },
  { key: "decisions", label: uiSource("Decisions"), kinds: ["DECISION", "DECISION_OPTION"] },
  { key: "blockers", label: uiSource("Blockers"), kinds: ["BLOCKER"] },
  { key: "signals", label: uiSource("Signals"), kinds: ["WEB_SIGNAL", "RESEARCH_SOURCE"] },
  { key: "predictions", label: uiSource("Predictions"), kinds: ["PREDICTION"] },
  { key: "outcomes", label: uiSource("Outcomes"), kinds: ["OUTCOME"] },
];

const HORIZONS: { key: string; label: UiCopyKey; days: number | null }[] = [
  { key: "now", label: uiSource("Now"), days: 0 },
  { key: "30", label: uiSource("30 days"), days: 30 },
  { key: "90", label: uiSource("90 days"), days: 90 },
  { key: "365", label: uiSource("1 year"), days: 365 },
  { key: "all", label: uiSource("All"), days: null },
];

interface MapState {
  mode: MapMode;
  graph: MapGraph;
  viewId: string | null;
  query: string;
  systemFilter: string;
  objectFilter: string;
  horizon: string;
  selected: string | null;
  tab: DetailTab;
  evidence: Record<string, unknown> | null;
  activity: Record<string, unknown> | null;
  predictions: Record<string, unknown> | null;
  comparison: Record<string, unknown> | null;
  analysis: Record<string, unknown> | null;
  smart: Record<string, unknown> | null;
  showOutline: boolean;
  showLabels: boolean;
  showEdges: boolean;
  error: string | null;
  notice: string | null;
  busy: boolean;
  /** False until the first graph load settles.
   *
   * Without this the first paint showed the empty state — "your Map begins with
   * where you are" — to an owner whose Map is merely still loading, which is a
   * lie about their own records and reads as data loss. §32 asks for a loading
   * state; this is what distinguishes "nothing recorded" from "not arrived yet".
   */
  loaded: boolean;
}

// ── small DOM helpers ────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document, tag: K, className?: string, content?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(
  doc: Document, tag: K, attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = doc.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/** Every control in Map is a capsule. There is no boxed-button helper. */
function capsule(doc: Document, label: string, disabledReason?: string): HTMLButtonElement {
  const node = el(doc, "button", "nur-map-capsule", label);
  node.type = "button";
  if (disabledReason) {
    node.disabled = true;
    node.setAttribute("aria-disabled", "true");
    // An honestly disabled control always says why, in the tooltip and to a
    // screen reader. A dead button with no explanation is the thing to avoid.
    node.title = disabledReason;
    node.setAttribute("aria-description", disabledReason);
  }
  return node;
}

function chip(doc: Document, label: string, pressed: boolean, count?: number): HTMLButtonElement {
  const node = el(doc, "button", "nur-map-capsule nur-map-capsule-sm");
  node.type = "button";
  node.setAttribute("aria-pressed", pressed ? "true" : "false");
  node.append(doc.createTextNode(label));
  if (typeof count === "number") {
    node.append(el(doc, "span", "nur-map-row-meta", (" " + uiFormat("{0}", [count]) + "")));
  }
  return node;
}

function field(doc: Document, label: string, value: string, unmeasured = false): HTMLElement {
  const wrap = el(doc, "div", "nur-map-field");
  wrap.append(el(doc, "p", "nur-map-field-label", label));
  const body = el(doc, "p", "nur-map-field-value", value);
  if (unmeasured) body.classList.add("is-unmeasured");
  wrap.append(body);
  return wrap;
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = MAP_CSS;
  doc.head.append(style);
}

function text(value: unknown, fallback = uiCopy("Not recorded")): string {
  if (typeof value === "string" && value.trim()) return verbatimUserText(value);
  if (typeof value === "number") return String(value);
  return fallback;
}

function nodeRefOf(nodeId: string): { type: string; id: string } {
  const at = nodeId.indexOf(":");
  if (at < 0) return { type: "nur", id: nodeId };
  return { type: nodeId.slice(0, at).replace(/-/g, "_"), id: nodeId.slice(at + 1) };
}

function systemRegionTitle(region: Pick<SystemRegion, "slug" | "title">): string {
  return v197SystemTitle(region.slug, region.title);
}

function mapNodeLabel(node: Pick<GraphNode, "id" | "kind" | "label" | "data">): string {
  if (node.kind !== "SYSTEM") return node.label;
  const dataSlug = typeof node.data.system_slug === "string" ? node.data.system_slug : "";
  const slug = dataSlug || (node.id.startsWith("system:") ? node.id.slice("system:".length) : "");
  return v197SystemTitle(slug, node.label);
}

function edgeClassOf(edge: GraphEdge): string {
  return EDGE_CLASS[edge.kind] ?? "nur-map-edge-contains";
}

/** The sentence a hovered line must be able to produce. */
function edgeWhy(edge: GraphEdge, labelOf: (id: string) => string): string {
  const meaning = uiCopy(EDGE_MEANING[edge.kind] ?? uiSource("is connected to"));
  const base = uiFormat("{0} {1} {2}", [labelOf(edge.source), meaning, labelOf(edge.target)]);
  if (edge.semantic && !edge.user_confirmed) {
    return uiFormat("{0}. NUR proposed this from {1} — it is not part of your Map until you accept it.", [base, text(edge.inference_source, uiCopy("an unnamed source"))]);
  }
  if (edge.note) return uiFormat("{0}. You noted: {1}", [base, edge.note]);
  return uiFormat("{0}.", [base]);
}

export async function renderV197Map(
  doc: Document, route: string, api: V197ApiClient,
): Promise<boolean> {
  cancelV197SearchCommit(doc, SEARCH_KEY);
  if (route !== MAP_ROUTE) {
    doc.getElementById(ROOT_ID)?.remove();
    // Give the canonical content region back, or leaving this route would leave
    // the canonical page hidden behind a removed surface.
    releaseV197SurfaceHost(doc);
    return false;
  }

  ensureStyle(doc);
  // Mount inside the canonical shell: the rail, the top nav and the starfield all
  // stay, and this surface takes only the content region. See v197SurfaceHost.
  const claimed = claimV197SurfaceHost(doc);
  if (claimed === null) {
    // No canonical viewport means no honest place to render. Falling back to a
    // full-screen overlay is exactly the behaviour this replaced.
    releaseV197SurfaceHost(doc);
    return false;
  }
  const host: HTMLElement = claimed;

  const view = doc.defaultView;
  const isMobile = Boolean(view && view.innerWidth <= 900);

  const state: MapState = {
    // §33: a phone opens in Focus, not a shrunken galaxy.
    mode: isMobile ? "focus" : "universe",
    graph: EMPTY_GRAPH,
    viewId: null,
    query: "",
    systemFilter: "ALL",
    objectFilter: "all",
    horizon: "all",
    selected: null,
    tab: "overview",
    evidence: null,
    activity: null,
    predictions: null,
    comparison: null,
    analysis: null,
    smart: null,
    showOutline: false,
    showLabels: true,
    showEdges: true,
    error: null,
    notice: null,
    busy: false,
    loaded: false,
  };

  // ── data ───────────────────────────────────────────────────────────────────

  async function loadGraph(): Promise<void> {
    try {
      const views = await api.get<{ default_view_id: string }>("/map/views");
      state.viewId = views?.default_view_id ?? null;
      const graph = state.viewId
        ? await api.get<MapGraph>(`/map/views/${state.viewId}/graph`)
        : await api.get<MapGraph>("/map");
      state.graph = graph ?? EMPTY_GRAPH;
      state.error = null;
    } catch (error) {
      // §32: a failure must not replace the whole Map with an error card. The
      // last graph stays on screen and the notice is restrained.
      state.error = mapVisibleFailure(
        error,
        uiSource("Part of the Map could not update."),
        "load graph",
      );
    }
    try {
      state.smart = await api.get<Record<string, unknown>>("/map/smart-sections");
    } catch (error) {
      console.error("[NUR Map] load smart sections", error);
      state.smart = null;
    }
    state.loaded = true;
    paint();
  }

  async function loadSelection(nodeId: string): Promise<void> {
    const ref = nodeRefOf(nodeId);
    try {
      const [evidence, activity, predictions] = await Promise.all([
        api.get<Record<string, unknown>>(`/map/entities/${ref.type}/${ref.id}/evidence`),
        api.get<Record<string, unknown>>(`/map/entities/${ref.type}/${ref.id}/activity`),
        api.get<Record<string, unknown>>(`/map/entities/${ref.type}/${ref.id}/predictions`),
      ]);
      state.evidence = evidence ?? null;
      state.activity = activity ?? null;
      state.predictions = predictions ?? null;
    } catch (error) {
      // Detail is supplementary; a failure here must not blank the canvas.
      console.error("[NUR Map] load selection detail", error);
      state.evidence = null;
    }
    paint();
  }

  async function mutate(run: () => Promise<unknown>, notice?: string): Promise<void> {
    state.busy = true;
    try {
      await run();
      state.error = null;
      state.notice = notice ?? null;
      await loadGraph();
    } catch (error) {
      state.error = mapVisibleFailure(error, uiSource("That did not work."), "mutation");
      paint();
    } finally {
      state.busy = false;
    }
  }

  const actions = {
    setMode(mode: MapMode) {
      state.mode = mode;
      paint();
      if (mode === "paths") void loadComparison();
      if (mode === "decisions") void loadDecisions();
    },
    setQuery(query: string) { state.query = query; paint(); },
    setSystemFilter(slug: string) { state.systemFilter = slug; paint(); },
    setObjectFilter(key: string) { state.objectFilter = key; paint(); },
    setHorizon(key: string) { state.horizon = key; paint(); },
    setTab(tab: DetailTab) { state.tab = tab; paint(); },
    toggleOutline() { state.showOutline = !state.showOutline; paint(); },
    toggleLabels() { state.showLabels = !state.showLabels; paint(); },
    toggleEdges() { state.showEdges = !state.showEdges; paint(); },
    select(nodeId: string) {
      state.selected = nodeId;
      state.tab = "overview";
      state.evidence = null;
      state.activity = null;
      state.predictions = null;
      state.analysis = null;
      paint();
      void loadSelection(nodeId);
    },
    focus(nodeId: string) {
      state.selected = nodeId;
      state.mode = "focus";
      paint();
      void loadSelection(nodeId);
    },
    accept(id: string) {
      void mutate(
        () => api.post(`/map/suggestions/${id}/accept`, {}),
        uiCopy("Accepted. It is part of your Map now."),
      );
    },
    reject(id: string, suppress: boolean) {
      void mutate(
        () => api.post(`/map/suggestions/${id}/reject`, { suppress_kind: suppress }),
        suppress ? uiCopy("This kind will not be raised again.") : uiCopy("Rejected."),
      );
    },
    generate() {
      void mutate(
        () => api.post("/map/suggestions/generate", {}),
        uiCopy("Checked your own records for patterns. Nothing was changed."),
      );
    },
    resetLayout() {
      if (!state.viewId) return;
      void mutate(
        () => api.put(`/map/views/${state.viewId}/layout`, { nodes: [] }),
        uiCopy("Layout left as it was; positions are cleared per node."),
      );
    },
    /** Non-drag alternative for every drag action (§34). */
    nudge(nodeId: string, dx: number, dy: number) {
      const node = state.graph.nodes.find((row) => row.id === nodeId);
      const layout = node?.data.layout as { x: number; y: number } | undefined;
      if (!layout) return;
      actions.moveTo(nodeId, layout.x + dx, layout.y + dy);
    },
    /** Where a drag or a nudge lands. Writes position and nothing else. */
    moveTo(nodeId: string, x: number, y: number) {
      if (!state.viewId) return;
      const ref = nodeRefOf(nodeId);
      void mutate(() => api.put(`/map/views/${state.viewId}/layout`, {
        nodes: [{
          node_ref_type: ref.type,
          node_ref_id: ref.id,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
        }],
      }));
    },
  };

  async function loadComparison(): Promise<void> {
    const goal = state.graph.nodes.find(
      (row) => row.kind === "GOAL" && (state.selected === row.id || state.selected === null),
    );
    if (!goal) { state.comparison = null; paint(); return; }
    try {
      state.comparison = await api.post<Record<string, unknown>>(
        "/map/path-comparison", { goal_id: nodeRefOf(goal.id).id },
      );
    } catch (error) {
      state.comparison = null;
      state.error = mapVisibleFailure(
        error,
        uiSource("Path comparison could not update."),
        "load path comparison",
      );
    }
    paint();
  }

  async function loadDecisions(): Promise<void> {
    const decision = state.graph.nodes.find(
      (row) => row.kind === "DECISION" && row.status === "UNRESOLVED",
    );
    if (!decision) { state.analysis = null; paint(); return; }
    try {
      state.analysis = await api.post<Record<string, unknown>>(
        "/map/decision-analysis", { decision_id: nodeRefOf(decision.id).id },
      );
    } catch (error) {
      console.error("[NUR Map] load decision analysis", error);
      state.analysis = null;
    }
    paint();
  }

  // ── derived ────────────────────────────────────────────────────────────────

  function labelOf(nodeId: string): string {
    const node = state.graph.nodes.find((row) => row.id === nodeId);
    return node ? mapNodeLabel(node) : nodeId;
  }

  function visibleNodes(): GraphNode[] {
    const filter = OBJECT_FILTERS.find((row) => row.key === state.objectFilter);
    const query = state.query.trim().toLowerCase();
    return state.graph.nodes.filter((node) => {
      if (node.kind === "MASTER_STAR" || node.kind === "SYSTEM") return true;
      if (filter && filter.kinds.length && !filter.kinds.includes(node.kind)) return false;
      if (state.systemFilter !== "ALL" && node.parent_id !== `system:${state.systemFilter}`) {
        return false;
      }
      if (query && !node.label.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  /** Direct neighbours of the selection: what illuminates on click. */
  function neighbourhood(): Set<string> {
    if (!state.selected) return new Set();
    const near = new Set<string>([state.selected]);
    for (const edge of state.graph.edges) {
      if (edge.source === state.selected) near.add(edge.target);
      if (edge.target === state.selected) near.add(edge.source);
    }
    return near;
  }

  // ── §38 components ─────────────────────────────────────────────────────────

  function mapHeader(): HTMLElement {
    const header = el(doc, "header", "nur-map-header");

    const title = el(doc, "div", "nur-map-title");
    const heading = el(doc, "h1", undefined, uiCopy("Map"));
    markV197HolographicWordmark(heading);
    title.append(heading);
    title.append(el(doc, "p", "nur-map-subtitle", uiCopy("Systems, paths and possible futures")));
    header.append(title);

    const modes = el(doc, "div", "nur-map-header-actions");
    modes.setAttribute("role", "tablist");
    modes.setAttribute("aria-label", uiCopy("Map view mode"));
    ([
      ["universe", uiSource("Universe")], ["focus", uiSource("Focus")],
      ["paths", uiSource("Paths")], ["decisions", uiSource("Decisions")],
    ] as [MapMode, UiCopyKey][]).forEach(([mode, label]) => {
      const button = chip(doc, uiCopy(label), state.mode === mode);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", state.mode === mode ? "true" : "false");
      button.dataset.mapMode = mode;
      button.addEventListener("click", () => actions.setMode(mode));
      modes.append(button);
    });
    header.append(modes);

    const tools = el(doc, "div", "nur-map-header-actions");
    const search = el(doc, "input", "nur-map-search");
    search.type = "search";
    search.placeholder = uiCopy("Search Systems, goals, plans, decisions or signals");
    search.value = state.query;
    search.setAttribute("aria-label", uiCopy("Search the Map"));
    search.addEventListener("input", () => {
      scheduleV197SearchCommit(doc, SEARCH_KEY, search.value, actions.setQuery);
    });
    tools.append(search);

    // Add Goal is a canonical write and lives at POST /goals; the Map does not
    // shadow it. Until the multi-field drawer exists this is honestly disabled
    // rather than pretending to work.
    tools.append(capsule(
      doc, uiCopy("Add Goal"),
      uiCopy("Not built yet. Goals are created on the Systems page, which owns the full goal form."),
    ));
    tools.append(capsule(
      doc, uiCopy("Add Signal"),
      uiCopy("Not built yet. Signals arrive from Talk, Journal, Today and Research."),
    ));
    const ask = capsule(doc, uiCopy("Ask NUR to Map"));
    ask.addEventListener("click", () => actions.generate());
    ask.title = uiCopy("Checks your own records for patterns — duplicate plans, competing deadlines, unreviewed assumptions. Deterministic, and nothing is applied without you.");
    tools.append(ask);
    header.append(tools);

    return header;
  }

  function mapNavigator(): HTMLElement {
    const pane = el(doc, "aside", "nur-map-pane nur-map-nav");
    pane.setAttribute("aria-label", uiCopy("Map navigator"));
    const scroll = el(doc, "div", "nur-map-pane-scroll");

    // Systems, driven from what the server returned — never a hardcoded list.
    const systems = el(doc, "div", "nur-map-nav-group");
    systems.append(el(doc, "p", "nur-map-nav-label", uiCopy("Systems")));
    const systemChips = el(doc, "div", "nur-map-chips");
    const all = chip(doc, uiCopy("All Systems"), state.systemFilter === "ALL");
    all.addEventListener("click", () => actions.setSystemFilter("ALL"));
    systemChips.append(all);
    for (const region of state.graph.system_regions) {
      const button = chip(doc, systemRegionTitle(region), state.systemFilter === region.slug);
      button.title = uiFormat("{0} — {1}", [uiCopy(STATE_WORD[region.state] ?? uiSource("Unclear")), formatV197SystemStateReason(region)]);
      button.dataset.mapSystem = region.slug;
      button.addEventListener("click", () => actions.setSystemFilter(region.slug));
      systemChips.append(button);
    }
    systems.append(systemChips);
    scroll.append(systems);

    const objects = el(doc, "div", "nur-map-nav-group");
    objects.append(el(doc, "p", "nur-map-nav-label", uiCopy("Objects")));
    const objectChips = el(doc, "div", "nur-map-chips");
    for (const row of OBJECT_FILTERS) {
      const button = chip(doc, uiCopy(row.label), state.objectFilter === row.key);
      button.dataset.mapObjectFilter = row.key;
      button.addEventListener("click", () => actions.setObjectFilter(row.key));
      objectChips.append(button);
    }
    objects.append(objectChips);
    scroll.append(objects);

    const horizon = el(doc, "div", "nur-map-nav-group");
    horizon.append(el(doc, "p", "nur-map-nav-label", uiCopy("Time horizon")));
    const horizonChips = el(doc, "div", "nur-map-chips");
    for (const row of HORIZONS) {
      const button = chip(doc, uiCopy(row.label), state.horizon === row.key);
      button.addEventListener("click", () => actions.setHorizon(row.key));
      horizonChips.append(button);
    }
    horizon.append(horizonChips);
    // This filters the Map; it is not the Timeline, and says so.
    horizon.append(el(
      doc, "p", "nur-map-empty",
      uiCopy("Filters what the Map shows. The full chronology lives on Timeline."),
    ));
    scroll.append(horizon);

    // §13.7 smart sections, each from real rows or an honest empty line.
    const sections: [string, UiCopyKey][] = [
      ["current_focus", uiSource("Current focus")],
      ["needs_decision", uiSource("Needs decision")],
      ["blocked", uiSource("Blocked")],
      ["momentum", uiSource("Momentum")],
      ["fragile_paths", uiSource("Fragile paths")],
      ["recently_changed", uiSource("Recently changed")],
    ];
    for (const [key, label] of sections) {
      const rows = (state.smart?.[key] as { ref: string; label: string; reason?: string }[] | undefined) ?? [];
      const group = el(doc, "div", "nur-map-nav-group");
      group.dataset.mapSection = key;
      group.append(el(doc, "p", "nur-map-nav-label", uiCopy(label)));
      if (!rows.length) {
        group.append(el(doc, "p", "nur-map-empty", uiCopy("Nothing here yet.")));
      } else {
        const list = el(doc, "ul", "nur-map-nav-list");
        for (const row of rows.slice(0, 6)) {
          const reason = formatV197SmartSectionReason(key, Boolean(row.reason));
          const item = el(doc, "li");
          const button = el(doc, "button", "nur-map-row");
          button.type = "button";
          if (state.selected === row.ref) button.classList.add("is-selected");
          button.append(el(doc, "span", undefined, "◦"));
          button.append(el(doc, "span", "nur-map-row-label", row.label));
          button.append(el(doc, "span", "nur-map-row-meta", reason ? uiCopy("why") : ""));
          if (reason) button.title = reason;
          button.addEventListener("click", () => actions.select(row.ref));
          item.append(button);
          list.append(item);
        }
        group.append(list);
      }
      scroll.append(group);
    }

    const create = el(doc, "div", "nur-map-nav-group");
    create.append(el(doc, "p", "nur-map-nav-label", uiCopy("Create")));
    const createChips = el(doc, "div", "nur-map-chips");
    createChips.append(capsule(
      doc, uiCopy("Map a Problem"),
      uiCopy("Not built yet as a guided flow. POST /api/v1/map/problem is live and tested, but the six-step drawer that drives it is not."),
    ));
    createChips.append(capsule(
      doc, uiCopy("Add Decision"),
      uiCopy("Not built yet. Decisions are created against an Orbit; the Map adds their options."),
    ));
    const suggest = capsule(doc, uiCopy("Suggest a Path"));
    suggest.addEventListener("click", () => actions.generate());
    createChips.append(suggest);
    create.append(createChips);
    scroll.append(create);

    pane.append(scroll);
    return pane;
  }

  function mapCanvas(): HTMLElement {
    const pane = el(doc, "section", "nur-map-pane nur-map-workspace");
    pane.setAttribute("aria-label", uiCopy("Living Map"));
    const wrap = el(doc, "div", "nur-map-canvas-wrap");

    const nodes = visibleNodes();
    const near = neighbourhood();

    if (!state.loaded) {
      // §32: loading is its own state. Saying "your Map begins with where you
      // are" to someone whose map has simply not arrived is a claim about their
      // records that happens to be false.
      const loading = el(doc, "div", "nur-map-pane-scroll");
      loading.dataset.mapLoading = "true";
      loading.append(el(doc, "p", "nur-map-detail-kind", uiCopy("Map")));
      loading.append(el(doc, "p", "nur-map-empty", uiCopy("Assembling your Systems and routes…")));
      wrap.append(loading);
      pane.append(wrap);
      return pane;
    }

    if (!nodes.some((row) => row.kind !== "MASTER_STAR" && row.kind !== "SYSTEM")) {
      // §31: the empty Map is beautiful and useful, never "no data available".
      const empty = el(doc, "div", "nur-map-pane-scroll");
      empty.append(el(doc, "p", "nur-map-detail-kind", uiCopy("Your Map")));
      empty.append(el(
        doc, "h2", "nur-map-detail-title",
        uiCopy("Your Map begins with where you are and where you want to move."),
      ));
      empty.append(el(
        doc, "p", "nur-map-field-value",
        uiFormat("Your {0} Systems are here and waiting. Nothing else has been drawn, because nothing else has been recorded yet.", [state.graph.system_regions.length]),
      ));
      const regionList = el(doc, "ul", "nur-map-nav-list");
      for (const region of state.graph.system_regions) {
        const item = el(doc, "li");
        const button = el(doc, "button", "nur-map-row");
        button.type = "button";
        button.append(el(doc, "span", undefined, STATE_GLYPH[region.state] ?? "○"));
        button.append(el(doc, "span", "nur-map-row-label", systemRegionTitle(region)));
        button.append(el(doc, "span", "nur-map-row-meta", uiCopy(STATE_WORD[region.state] ?? uiSource("Unclear"))));
        button.title = formatV197SystemStateReason(region);
        button.addEventListener("click", () => actions.select(region.node_id));
        item.append(button);
        regionList.append(button.parentElement === item ? button : item);
        if (!item.parentElement) regionList.append(item);
      }
      empty.append(regionList);
      wrap.append(empty);
      pane.append(wrap);
      return pane;
    }

    // Fit the real owner-ledger geometry instead of looking through a permanent
    // 1560x1120 window. Sparse maps used to occupy a small patch in the middle
    // of the workspace even though their coordinates were valid. This changes
    // only the camera; server-owned positions and drag writes stay untouched.
    const positioned = nodes.flatMap(node => {
      const layout = node.data.layout as { x: number; y: number } | undefined;
      return layout ? [{ x: layout.x, y: layout.y }] : [];
    });
    const regionExtents = state.graph.system_regions.flatMap(region => [
      { x: region.layout.x - 148, y: region.layout.y - 148 },
      { x: region.layout.x + 148, y: region.layout.y + 148 },
    ]);
    const extents = [...positioned, ...regionExtents];
    if (extents.length === 0) {
      extents.push({ x: -310, y: -230 }, { x: 310, y: 230 });
    }
    const minX = Math.min(...extents.map(point => point.x));
    const maxX = Math.max(...extents.map(point => point.x));
    const minY = Math.min(...extents.map(point => point.y));
    const maxY = Math.max(...extents.map(point => point.y));
    const mapWidth = Math.max(620, maxX - minX + 160);
    const mapHeight = Math.max(460, maxY - minY + 150);
    const mapCenterX = (minX + maxX) / 2;
    const mapCenterY = (minY + maxY) / 2;

    const canvas = svg(doc, "svg", {
      class: "nur-map-canvas",
      viewBox:
        `${mapCenterX - mapWidth / 2} ${mapCenterY - mapHeight / 2} ${mapWidth} ${mapHeight}`,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-label": uiFormat(
        "Map with {0} objects across {1} Systems. A full outline is available through the Outline control.",
        [nodes.length, state.graph.system_regions.length],
      ),
    });
    canvas.dataset.mapCamera = "owner-ledger-fit";

    const defs = svg(doc, "defs");
    const regionPrism = svg(doc, "linearGradient", {
      id: "nur-map-region-prism",
      x1: "0%", y1: "0%", x2: "100%", y2: "100%",
    });
    for (const [offset, color] of [
      ["0%", "rgba(255,211,90,0.05)"],
      ["22%", "rgba(255,122,69,0.035)"],
      ["42%", "rgba(255,82,171,0.032)"],
      ["61%", "rgba(79,204,255,0.03)"],
      ["80%", "rgba(72,235,175,0.032)"],
      ["100%", "rgba(193,107,255,0.026)"],
    ]) {
      regionPrism.append(svg(doc, "stop", { offset, "stop-color": color }));
    }
    defs.append(regionPrism);
    canvas.append(defs);

    // System regions first: soft gravity behind everything.
    const regions = svg(doc, "g", { class: "nur-map-region-halo" });
    for (const region of state.graph.system_regions) {
      const dim = state.systemFilter !== "ALL" && state.systemFilter !== region.slug;
      regions.append(svg(doc, "circle", {
        cx: region.layout.x, cy: region.layout.y, r: 132,
        fill: "url(#nur-map-region-prism)",
        stroke: "rgba(248,217,138,0.1)",
        "stroke-width": 1,
        opacity: dim ? 0.25 : 1,
      }));
      const label = svg(doc, "text", {
        x: region.layout.x, y: region.layout.y - 108,
        "text-anchor": "middle", class: "nur-map-region-label",
        opacity: dim ? 0.3 : 1,
      });
      label.textContent = systemRegionTitle(region);
      regions.append(label);
      const stateLabel = svg(doc, "text", {
        x: region.layout.x, y: region.layout.y - 94,
        "text-anchor": "middle", class: "nur-map-region-state",
        opacity: dim ? 0.3 : 1,
      });
      // State word and glyph together: never colour alone.
      stateLabel.textContent =
        uiFormat("{0} {1}", [STATE_GLYPH[region.state] ?? "○", uiCopy(STATE_WORD[region.state] ?? uiSource("Unclear"))]);
      regions.append(stateLabel);
    }
    canvas.append(regions);

    const positionOf = (nodeId: string): { x: number; y: number } | null => {
      const node = state.graph.nodes.find((row) => row.id === nodeId);
      const layout = node?.data.layout as { x: number; y: number } | undefined;
      return layout ? { x: layout.x, y: layout.y } : null;
    };

    const visibleIds = new Set(nodes.map((row) => row.id));

    if (state.showEdges) {
      const edgeLayer = svg(doc, "g", { class: "nur-map-edge-layer" });
      const draw = (edge: GraphEdge, candidate: boolean) => {
        const from = positionOf(edge.source);
        const to = positionOf(edge.target);
        if (!from || !to) return;
        if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) return;
        const line = svg(doc, "path", {
          class: `nur-map-edge ${edgeClassOf(edge)}`,
          d: `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - 34} ${to.x} ${to.y}`,
        });
        if (candidate) line.classList.add("is-candidate");
        if (state.selected && !(near.has(edge.source) && near.has(edge.target))) {
          line.classList.add("is-dimmed");
        } else if (state.selected) {
          line.classList.add("is-active");
        }
        // Hovering a line answers "why are these connected?"
        const why = edgeWhy(edge, labelOf);
        const tip = svg(doc, "title");
        tip.textContent = why;
        line.append(tip);
        line.dataset.mapEdgeWhy = why;
        if (candidate) line.dataset.mapEdgeCandidate = "true";
        edgeLayer.append(line);
      };
      for (const edge of state.graph.edges) draw(edge, false);
      for (const edge of state.graph.suggested_changes.candidate_edges) draw(edge, true);
      canvas.append(edgeLayer);
    }

    // ── which nodes get a drawn label ─────────────────────────────────────────
    // The anchor and the Systems are the frame and are always named. Beyond that
    // only the selection's neighbourhood is named, capped, and only for nodes big
    // enough to carry text.
    //
    // Both halves of that are needed. Labelling by size alone produced dozens of
    // overlapping strings in the outer ring. Labelling the whole neighbourhood
    // reproduced it the moment the *anchor* was selected, because almost
    // everything hangs off the anchor — so the cap is what actually holds.
    const LABEL_BUDGET = 14;
    const labelled = new Set<string>();
    const focusCandidates: GraphNode[] = [];
    for (const node of nodes) {
      if (node.kind === "MASTER_STAR" || node.kind === "SYSTEM") {
        labelled.add(node.id);
        continue;
      }
      if (state.selected && near.has(node.id) && (NODE_RADIUS[node.kind] ?? 8) >= 9) {
        focusCandidates.push(node);
      }
    }
    focusCandidates.sort(
      (a, b) => (NODE_RADIUS[b.kind] ?? 8) - (NODE_RADIUS[a.kind] ?? 8),
    );
    for (const node of focusCandidates.slice(0, LABEL_BUDGET)) labelled.add(node.id);

    const nodeLayer = svg(doc, "g", { class: "nur-map-node-layer" });
    for (const node of nodes) {
      const layout = node.data.layout as { x: number; y: number } | undefined;
      if (!layout) continue;
      const radius = NODE_RADIUS[node.kind] ?? 8;
      const group = svg(doc, "g", { class: "nur-map-node", tabindex: 0 });
      group.dataset.mapNode = node.id;
      group.dataset.mapKind = node.kind;
      group.setAttribute("role", "button");

      if (state.selected === node.id) group.classList.add("is-selected");
      else if (state.selected && !near.has(node.id)) group.classList.add("is-dimmed");
      if (node.kind === "PREDICTION") group.classList.add("is-prediction");
      if (node.kind === "OUTCOME") group.classList.add("is-outcome");
      if (node.kind === "BLOCKER") {
        group.classList.add("is-blocker");
        if (node.status === "PROPOSED") group.classList.add("is-proposed");
      }
      if (node.kind === "DECISION" && node.status === "UNRESOLVED") {
        group.classList.add("is-unresolved");
      }

      // Geometry per kind, so meaning survives greyscale: a decision is a prism,
      // a blocker is a fracture, everything else is a luminous point.
      let body: SVGElement;
      if (node.kind === "DECISION") {
        body = svg(doc, "polygon", {
          class: "nur-map-node-body",
          points: [
            `${layout.x},${layout.y - radius}`,
            `${layout.x + radius},${layout.y}`,
            `${layout.x},${layout.y + radius}`,
            `${layout.x - radius},${layout.y}`,
          ].join(" "),
          fill: "rgba(132,61,255,0.2)",
          stroke: "rgba(193,107,255,0.8)",
          "stroke-width": 1.4,
        });
      } else if (node.kind === "BLOCKER") {
        body = svg(doc, "polygon", {
          class: "nur-map-node-body",
          points: [
            `${layout.x},${layout.y - radius}`,
            `${layout.x + radius},${layout.y + radius * 0.7}`,
            `${layout.x - radius},${layout.y + radius * 0.7}`,
          ].join(" "),
          "stroke-width": 1.4,
        });
      } else {
        body = svg(doc, "circle", {
          class: "nur-map-node-body",
          cx: layout.x, cy: layout.y, r: radius,
          fill: node.kind === "MASTER_STAR"
            ? "rgba(255,211,90,0.22)"
            : node.kind === "SYSTEM"
              ? "rgba(255,248,223,0.14)"
              : "rgba(33,232,255,0.13)",
          stroke: node.kind === "MASTER_STAR"
            ? "rgba(255,248,223,0.9)"
            : "rgba(248,217,138,0.55)",
          "stroke-width": node.kind === "MASTER_STAR" ? 2 : 1.1,
        });
      }
      group.append(body);

      const tip = svg(doc, "title");
      const kindWord = uiCopy(KIND_WORD[node.kind] ?? uiSource("Object"));
      const visibleLabel = mapNodeLabel(node);
      tip.textContent = uiFormat("{0} — {1}, {2}", [visibleLabel, kindWord, uiCopy(STATE_WORD[node.status] ?? uiSource("Unclear"))]);
      group.append(tip);

      // §39: reduce labels while zoomed out. Every node keeps its name in the
      // hover tooltip and in the outline, so nothing is hidden — only undrawn.
      if (state.showLabels && labelled.has(node.id)) {
        const label = svg(doc, "text", {
          x: layout.x, y: layout.y + radius + 13,
          "text-anchor": "middle", class: "nur-map-node-label",
        });
        label.textContent = visibleLabel.length > 26
          ? uiFormat("{0}…", [visibleLabel.slice(0, 25)])
          : visibleLabel;
        group.append(label);
      }

      // ── drag to reposition ────────────────────────────────────────────────
      // Position is presentation. This moves the group's transform while the
      // pointer is down and persists x/y on release; the server refuses to let a
      // position change System membership or any relationship, so a goal dragged
      // next to Money is still a Creation goal. A movement threshold keeps a
      // click from becoming a one-pixel drag, and vice versa.
      let dragging = false;
      let moved = false;
      let originX = 0;
      let originY = 0;
      const toCanvas = (event: PointerEvent): { x: number; y: number } | null => {
        const matrix = canvas.getScreenCTM();
        if (!matrix) return null;
        const point = canvas.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const mapped = point.matrixTransform(matrix.inverse());
        return { x: mapped.x, y: mapped.y };
      };

      group.addEventListener("pointerdown", (event) => {
        const pointer = event as PointerEvent;
        if (pointer.button !== 0) return;
        const at = toCanvas(pointer);
        if (!at) return;
        dragging = true;
        moved = false;
        originX = at.x;
        originY = at.y;
        group.setPointerCapture(pointer.pointerId);
      });

      group.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const at = toCanvas(event as PointerEvent);
        if (!at) return;
        const dx = at.x - originX;
        const dy = at.y - originY;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        group.classList.add("is-dragging");
        group.setAttribute("transform", `translate(${dx} ${dy})`);
      });

      const endDrag = (event: Event) => {
        if (!dragging) return;
        const pointer = event as PointerEvent;
        dragging = false;
        if (group.hasPointerCapture?.(pointer.pointerId)) {
          group.releasePointerCapture(pointer.pointerId);
        }
        group.classList.remove("is-dragging");
        if (!moved) return;
        const at = toCanvas(pointer);
        group.removeAttribute("transform");
        if (!at) return;
        // One write per gesture, on release — not per pointermove.
        actions.moveTo(node.id, layout.x + (at.x - originX), layout.y + (at.y - originY));
      };
      group.addEventListener("pointerup", endDrag);
      group.addEventListener("pointercancel", endDrag);

      group.addEventListener("click", () => {
        // A completed drag is not a selection.
        if (moved) { moved = false; return; }
        actions.select(node.id);
      });
      group.addEventListener("dblclick", () => actions.focus(node.id));
      group.addEventListener("keydown", (event) => {
        const key = (event as KeyboardEvent).key;
        if (key === "Enter" || key === " ") {
          event.preventDefault();
          actions.select(node.id);
          return;
        }
        // Arrow keys are the non-drag alternative to repositioning.
        const step = 28;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0], ArrowRight: [step, 0],
          ArrowUp: [0, -step], ArrowDown: [0, step],
        };
        if (moves[key]) {
          event.preventDefault();
          actions.nudge(node.id, moves[key][0], moves[key][1]);
        }
      });
      nodeLayer.append(group);
    }
    canvas.append(nodeLayer);
    wrap.append(canvas);

    const controls = el(doc, "div", "nur-map-canvas-controls");
    const labels = chip(doc, state.showLabels ? uiCopy("Labels on") : uiCopy("Labels off"), state.showLabels);
    labels.addEventListener("click", () => actions.toggleLabels());
    controls.append(labels);
    const edges = chip(doc, state.showEdges ? uiCopy("Edges on") : uiCopy("Edges off"), state.showEdges);
    edges.addEventListener("click", () => actions.toggleEdges());
    controls.append(edges);
    const outline = chip(doc, uiCopy("Outline"), state.showOutline);
    outline.dataset.mapOutlineToggle = "true";
    outline.addEventListener("click", () => actions.toggleOutline());
    controls.append(outline);
    const centre = capsule(doc, uiCopy("Center on You"));
    centre.classList.add("nur-map-capsule-sm");
    centre.addEventListener("click", () => actions.select("nur"));
    controls.append(centre);
    controls.append(capsule(
      doc, uiCopy("Fit all"),
      uiCopy("Not built yet. The canvas has no pan or zoom transform to fit to; the view is fixed."),
    ));
    const reset = capsule(doc, uiCopy("Reset layout"));
    reset.classList.add("nur-map-capsule-sm");
    reset.addEventListener("click", () => actions.resetLayout());
    controls.append(reset);
    wrap.append(controls);

    const legend = el(doc, "div", "nur-map-canvas-legend");
    ([
      [uiSource("Depends on"), "nur-map-edge-depends"],
      [uiSource("Blocks"), "nur-map-edge-blocks"],
      [uiSource("Contradicts"), "nur-map-edge-contradicts"],
      [uiSource("NUR suggests"), "is-candidate"],
    ] as [UiCopyKey, string][]).forEach(([label, cls]) => {
      const row = el(doc, "div", "nur-map-legend-row");
      const swatch = el(doc, "span", `nur-map-legend-swatch ${cls}`);
      row.append(swatch, el(doc, "span", undefined, uiCopy(label)));
      legend.append(row);
    });
    wrap.append(legend);

    if (state.showOutline) wrap.append(mapAccessibilityOutline());

    pane.append(wrap);
    return pane;
  }

  /** A real parallel representation of the graph — §34's hard requirement. */
  function mapAccessibilityOutline(): HTMLElement {
    const wrap = el(doc, "div", "nur-map-pane-scroll");
    wrap.dataset.mapOutline = "true";
    wrap.style.position = "absolute";
    wrap.style.inset = "0";
    wrap.style.background = "rgba(0,0,0,0.94)";
    wrap.append(el(doc, "p", "nur-map-nav-label", uiCopy("Map outline")));
    const root = el(doc, "ul", "nur-map-outline");
    const childrenOf = (parentId: string | null): GraphNode[] =>
      visibleNodes().filter((row) => row.parent_id === parentId);

    const render = (node: GraphNode, into: HTMLElement): void => {
      const item = el(doc, "li");
      const button = el(doc, "button", "nur-map-row");
      button.type = "button";
      const kindWord = uiCopy(KIND_WORD[node.kind] ?? uiSource("Object"));
      // The screen-reader sentence §34 asks for, built from real counts.
      const visibleLabel = mapNodeLabel(node);
      const summary = uiFormat("{0}. {1}. {2}.", [visibleLabel, kindWord, uiCopy(STATE_WORD[node.status] ?? uiSource("Unclear"))]);
      button.append(el(doc, "span", undefined, "·"));
      button.append(el(doc, "span", "nur-map-row-label", visibleLabel));
      button.append(el(doc, "span", "nur-map-row-meta", kindWord));
      button.setAttribute("aria-label", summary);
      button.addEventListener("click", () => actions.select(node.id));
      item.append(button);
      const kids = childrenOf(node.id);
      if (kids.length) {
        const list = el(doc, "ul");
        for (const kid of kids) render(kid, list);
        item.append(list);
      }
      into.append(item);
    };

    const anchor = visibleNodes().find((row) => row.kind === "MASTER_STAR");
    if (anchor) render(anchor, root);
    wrap.append(root);
    const close = capsule(doc, uiCopy("Close outline"));
    close.addEventListener("click", () => actions.toggleOutline());
    wrap.append(close);
    return wrap;
  }

  /**
   * §33's mobile default: a Focus list, not a shrunken galaxy.
   *
   * This exists because of a real defect found running the spec on WebKit mobile:
   * the rail and detail panel are `display: none` at phone widths, and the
   * candidate strip lived only in the detail panel — so on a phone NUR's
   * suggestions rendered into a hidden panel and were unreachable. Everything
   * waiting on the owner has to be reachable on the surface they actually open.
   */
  function mapMobileFocusList(): HTMLElement {
    const pane = el(doc, "section", "nur-map-pane nur-map-workspace");
    pane.setAttribute("aria-label", uiCopy("Focus list"));
    const scroll = el(doc, "div", "nur-map-pane-scroll");
    scroll.dataset.mapFocusList = "true";

    const section = (
      key: string,
      label: string,
      rows: { ref: string; label: string; reason?: string }[],
    ): void => {
      const group = el(doc, "div", "nur-map-nav-group");
      group.append(el(doc, "p", "nur-map-nav-label", label));
      if (!rows.length) {
        group.append(el(doc, "p", "nur-map-empty", uiCopy("Nothing here yet.")));
      } else {
        const list = el(doc, "ul", "nur-map-nav-list");
        for (const row of rows) {
          const reason = formatV197SmartSectionReason(key, Boolean(row.reason));
          const item = el(doc, "li");
          const button = el(doc, "button", "nur-map-row");
          button.type = "button";
          if (state.selected === row.ref) button.classList.add("is-selected");
          button.append(el(doc, "span", undefined, "◦"));
          button.append(el(doc, "span", "nur-map-row-label", row.label));
          button.append(el(doc, "span", "nur-map-row-meta", reason ? uiCopy("why") : ""));
          if (reason) button.title = reason;
          button.addEventListener("click", () => actions.select(row.ref));
          item.append(button);
          list.append(item);
        }
        group.append(list);
      }
      scroll.append(group);
    };

    const read = (key: string): { ref: string; label: string; reason?: string }[] =>
      (state.smart?.[key] as { ref: string; label: string; reason?: string }[] | undefined) ?? [];

    section("current_focus", uiCopy("Current focus"), read("current_focus"));
    section("needs_decision", uiCopy("Needs decision"), read("needs_decision"));
    section("blocked", uiCopy("Blocked"), read("blocked"));
    section("momentum", uiCopy("Momentum"), read("momentum"));
    section("fragile_paths", uiCopy("Fragile paths"), read("fragile_paths"));

    // Systems stay reachable on a phone, with their state and its reason.
    const systems = el(doc, "div", "nur-map-nav-group");
    systems.append(el(doc, "p", "nur-map-nav-label", uiCopy("Systems")));
    const list = el(doc, "ul", "nur-map-nav-list");
    for (const region of state.graph.system_regions) {
      const item = el(doc, "li");
      const button = el(doc, "button", "nur-map-row");
      button.type = "button";
      button.append(el(doc, "span", undefined, STATE_GLYPH[region.state] ?? "○"));
      button.append(el(doc, "span", "nur-map-row-label", systemRegionTitle(region)));
      button.append(el(
        doc, "span", "nur-map-row-meta", uiCopy(STATE_WORD[region.state] ?? uiSource("Unclear")),
      ));
      button.title = formatV197SystemStateReason(region);
      button.addEventListener("click", () => actions.select(region.node_id));
      item.append(button);
      list.append(item);
    }
    systems.append(list);
    scroll.append(systems);

    // The candidate strip, on the surface rather than behind a hidden panel.
    const pending = state.graph.suggested_changes.suggestions;
    if (pending.length) {
      scroll.append(el(doc, "p", "nur-map-nav-label", uiCopy("NUR suggests")));
      for (const suggestion of pending) scroll.append(candidateCard(suggestion));
    }

    pane.append(scroll);
    return pane;
  }

  function mapPathsView(): HTMLElement {
    const pane = el(doc, "section", "nur-map-pane nur-map-workspace");
    const scroll = el(doc, "div", "nur-map-pane-scroll");
    scroll.dataset.mapPaths = "true";
    scroll.append(el(doc, "p", "nur-map-detail-kind", uiCopy("Paths")));

    const comparison = state.comparison;
    if (!comparison) {
      scroll.append(el(doc, "h2", "nur-map-detail-title", uiCopy("Nothing to compare yet")));
      scroll.append(el(
        doc, "p", "nur-map-empty",
        uiCopy("Select a goal, then Paths compares the routes that actually exist toward it."),
      ));
      pane.append(scroll);
      return pane;
    }

    const goal = comparison.goal as { title: string } | undefined;
    scroll.append(el(doc, "h2", "nur-map-detail-title", text(goal?.title, uiCopy("This goal"))));
    scroll.append(el(doc, "p", "nur-map-lane-strategy", text(comparison.association_basis, "")));

    const lanes = (comparison.paths as Record<string, unknown>[] | undefined) ?? [];
    if (!lanes.length) {
      scroll.append(el(doc, "p", "nur-map-empty", text(comparison.note, "")));
      pane.append(scroll);
      return pane;
    }

    const holder = el(doc, "div", "nur-map-lanes");
    for (const lane of lanes) {
      const card = el(doc, "article", "nur-map-lane");
      card.append(el(doc, "h3", "nur-map-lane-name", text(lane.name, uiCopy("Route"))));
      card.append(el(doc, "p", "nur-map-lane-strategy", text(lane.strategy, "")));

      const dims = el(doc, "div", "nur-map-lane-dims");
      const add = (label: string, value: unknown) => {
        const cell = el(doc, "div");
        cell.append(el(doc, "div", "nur-map-dim-label", label));
        const notAssessed = uiCopy("Not assessed");
        const notRecorded = uiCopy("Not recorded");
        const shown = text(value, notAssessed);
        const body = el(doc, "div", "nur-map-dim-value", shown);
        // §19: an unmeasured dimension is styled as absent, not as a value.
        if (shown === notAssessed || shown === notRecorded) {
          body.classList.add("is-unmeasured");
        }
        cell.append(body);
        dims.append(cell);
      };
      add(uiCopy("First step"), lane.first_step);
      add(uiCopy("Effort"), lane.effort);
      add(uiCopy("Time horizon"), lane.time_horizon);
      add(uiCopy("Reversibility"), mapReversibilityLabel(lane.reversibility));
      add(uiCopy("Evidence"), lane.evidence_strength);
      add(uiCopy("Expected outcome"), lane.expected_outcome);
      add(uiCopy("Fallback"), lane.fallback);
      card.append(dims);

      card.append(field(doc, uiCopy("Uncertainty"), text(lane.uncertainty, "")));

      const milestones = (lane.milestones as { title: string; done: boolean }[] | undefined) ?? [];
      if (milestones.length) {
        const list = el(doc, "ul", "nur-map-milestones");
        for (const milestone of milestones) {
          const item = el(doc, "li", "nur-map-milestone");
          if (milestone.done) item.classList.add("is-done");
          item.append(doc.createTextNode(`${milestone.done ? "✓" : "○"} ${milestone.title}`));
          list.append(item);
        }
        card.append(list);
      }

      const blockers = (lane.blockers as { title: string; status: string }[] | undefined) ?? [];
      if (blockers.length) {
        card.append(field(
          doc, uiCopy("Blockers"),
          blockers.map((row) => uiFormat("{0} ({1})", [
            row.title,
            mapBlockerStatusLabel(row.status),
          ])).join(" · "),
        ));
      }
      holder.append(card);
    }
    scroll.append(holder);
    scroll.append(el(doc, "p", "nur-map-empty", text(comparison.note, "")));
    pane.append(scroll);
    return pane;
  }

  function mapDecisionsView(): HTMLElement {
    const pane = el(doc, "section", "nur-map-pane nur-map-workspace");
    const scroll = el(doc, "div", "nur-map-pane-scroll");
    scroll.dataset.mapDecisions = "true";
    scroll.append(el(doc, "p", "nur-map-detail-kind", uiCopy("Decisions")));

    const analysis = state.analysis;
    if (!analysis) {
      scroll.append(el(doc, "h2", "nur-map-detail-title", uiCopy("No open decision")));
      scroll.append(el(
        doc, "p", "nur-map-empty",
        uiCopy("Unresolved forks appear here with their options, trade-offs and what each would cost to walk back."),
      ));
      pane.append(scroll);
      return pane;
    }

    const decision = analysis.decision as { statement: string } | undefined;
    scroll.append(el(doc, "h2", "nur-map-detail-title", text(decision?.statement, uiCopy("Decision"))));

    const options = (analysis.options as Record<string, unknown>[] | undefined) ?? [];
    const matrix = (analysis.comparison_matrix as {
      dimension: string; values: Record<string, string>;
    }[] | undefined) ?? [];

    if (matrix.length && options.length) {
      const scrollBox = el(doc, "div", "nur-map-matrix-scroll");
      const table = el(doc, "table", "nur-map-matrix");
      const head = el(doc, "thead");
      const headRow = el(doc, "tr");
      headRow.append(el(doc, "th", undefined, uiCopy("Dimension")));
      for (const option of options) {
        headRow.append(el(doc, "th", undefined, text(option.label, uiCopy("Option"))));
      }
      head.append(headRow);
      table.append(head);
      const body = el(doc, "tbody");
      for (const row of matrix) {
        const line = el(doc, "tr");
        line.append(el(doc, "th", undefined, row.dimension));
        for (const option of options) {
          line.append(el(doc, "td", undefined, text(row.values[String(option.id)], "—")));
        }
        body.append(line);
      }
      table.append(body);
      scrollBox.append(table);
      scroll.append(scrollBox);
    }

    const recommendation = analysis.recommendation as {
      label: string; because: string; changes_if: string;
    } | null;
    if (recommendation) {
      const card = el(doc, "div", "nur-map-doubt");
      card.append(el(doc, "p", "nur-map-doubt-label", uiCopy("NUR's reading")));
      card.append(el(doc, "p", "nur-map-field-value", recommendation.because));
      // The assumption is always visible next to the recommendation.
      card.append(el(doc, "p", "nur-map-field-value", recommendation.changes_if));
      scroll.append(card);
    } else {
      scroll.append(el(doc, "p", "nur-map-empty", text(analysis.note, "")));
    }

    const actionsRow = el(doc, "div", "nur-map-candidate-actions");
    actionsRow.append(capsule(
      doc, uiCopy("Choose an option"),
      uiCopy("Not built yet as a drawer. POST /map/decisions/{id}/choose/{option} is live and tested; only the owner can call it."),
    ));
    actionsRow.append(capsule(
      doc, uiCopy("Run an experiment first"),
      uiCopy("Not built yet. Experiments exist in the backend but are not wired to decisions."),
    ));
    actionsRow.append(capsule(
      doc, uiCopy("Ask a consultation"),
      uiCopy("Not built yet. Consultations are a separate surface."),
    ));
    scroll.append(actionsRow);

    pane.append(scroll);
    return pane;
  }

  function mapDetailPanel(): HTMLElement {
    const pane = el(doc, "aside", "nur-map-pane nur-map-detail");
    pane.setAttribute("aria-label", uiCopy("Selection detail"));
    const scroll = el(doc, "div", "nur-map-pane-scroll");

    const node = state.graph.nodes.find((row) => row.id === state.selected);
    if (!node) {
      scroll.append(el(doc, "p", "nur-map-detail-kind", uiCopy("Nothing selected")));
      scroll.append(el(
        doc, "p", "nur-map-empty",
        uiCopy("Select something on the Map to understand its role, evidence and possible movement."),
      ));
      // Candidates remain reachable with nothing selected: they are the one thing
      // waiting on the owner rather than on work.
      const pending = state.graph.suggested_changes.suggestions;
      if (pending.length) {
        scroll.append(el(doc, "p", "nur-map-nav-label", uiCopy("NUR suggests")));
        for (const suggestion of pending) scroll.append(candidateCard(suggestion));
      }
      pane.append(scroll);
      return pane;
    }

    const header = el(doc, "div", "nur-map-detail-header");
    header.append(el(
      doc, "p", "nur-map-detail-kind",
      uiFormat("{0} · {1}", [uiCopy(KIND_WORD[node.kind] ?? uiSource("Object")), uiCopy(STATE_WORD[node.status] ?? uiSource("Unclear"))]),
    ));
    header.append(el(doc, "h2", "nur-map-detail-title", mapNodeLabel(node)));
    scroll.append(header);

    const tabs = el(doc, "div", "nur-map-tabs");
    tabs.setAttribute("role", "tablist");
    ([
      ["overview", uiSource("Overview")], ["path", uiSource("Path")], ["evidence", uiSource("Evidence")],
      ["activity", uiSource("Activity")], ["nur", uiSource("NUR View")],
    ] as [DetailTab, UiCopyKey][]).forEach(([tab, label]) => {
      const button = el(doc, "button", "nur-map-tab", uiCopy(label));
      button.type = "button";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", state.tab === tab ? "true" : "false");
      button.dataset.mapTab = tab;
      button.addEventListener("click", () => actions.setTab(tab));
      tabs.append(button);
    });
    scroll.append(tabs);

    const body = el(doc, "div");
    body.dataset.mapTabPanel = state.tab;
    body.setAttribute("role", "tabpanel");
    if (state.tab === "overview") overviewTab(body, node);
    if (state.tab === "path") pathTab(body, node);
    if (state.tab === "evidence") evidenceTab(body);
    if (state.tab === "activity") activityTab(body);
    if (state.tab === "nur") nurViewTab(body, node);
    scroll.append(body);

    pane.append(scroll);
    return pane;
  }

  function overviewTab(into: HTMLElement, node: GraphNode): void {
    const data = node.data;
    if (node.kind === "MASTER_STAR") {
      // §8: the centre is the owner's current operating state, not NUR as a
      // separate being. Every line below is a count or a row from their ledger.
      const counts = state.graph.counts;
      const read = (key: string): { ref: string; label: string }[] =>
        (state.smart?.[key] as { ref: string; label: string }[] | undefined) ?? [];
      const focus = read("current_focus");
      const decisions = read("needs_decision");
      const blocked = read("blocked");
      const momentum = read("momentum");
      const fragile = read("fragile_paths");

      into.dataset.mapCurrentPosition = "true";
      into.append(field(
        doc, uiCopy("Active priorities"),
        focus.length ? focus.map((row) => row.label).join(" · ") : uiCopy("None recorded"),
        focus.length === 0,
      ));
      into.append(field(
        doc, uiCopy("Open decisions"),
        decisions.length
          ? uiFormat("{0} waiting on you — {1}", [decisions.length, decisions[0].label])
          : uiCopy("None waiting on you"),
        decisions.length === 0,
      ));
      into.append(field(
        doc, uiCopy("Current constraints"),
        blocked.length
          ? blocked.length === 1
            ? uiFormat("{0} goal blocked", [blocked.length])
            : uiFormat("{0} goals blocked", [blocked.length])
          : uiCopy("Nothing is blocked"),
        blocked.length === 0,
      ));
      into.append(field(
        doc, uiCopy("Recent movement"),
        momentum.length
          ? momentum.length === 1
            ? uiFormat("{0} outcome in the last 14 days", [momentum.length])
            : uiFormat("{0} outcomes in the last 14 days", [momentum.length])
          : uiCopy("No outcome recorded in the last 14 days"),
        momentum.length === 0,
      ));
      into.append(field(
        doc, uiCopy("Major risks"),
        fragile.length
          ? fragile.length === 1
            ? uiFormat("{0} assumption past review", [fragile.length])
            : uiFormat("{0} assumptions past review", [fragile.length])
          : uiCopy("No assumption is past its review date"),
        fragile.length === 0,
      ));
      const states = state.graph.system_regions
        .map((row) => uiFormat("{0}: {1}", [systemRegionTitle(row), uiCopy(STATE_WORD[row.state] ?? uiSource("Unclear"))]))
        .join(" · ");
      into.append(field(doc, uiCopy("Systems"), states || uiCopy("No Systems")));
      // Confidence in words, and only from what is actually observable. A number
      // here would be the fake precision §10 forbids.
      const recorded = (counts.goals ?? 0) + (counts.decisions ?? 0)
        + (counts.blockers ?? 0) + (counts.semantic_edges ?? 0);
      into.append(field(
        doc, uiCopy("How much of this NUR can see"),
        recorded === 0
          ? uiCopy("Almost nothing is recorded yet, so NUR's model of your position is close to empty. Anything it says now rests on very little.")
          : uiFormat("{0} recorded objects and connections. Anything you have not written down is invisible here.", [recorded]),
        recorded === 0,
      ));
      return;
    }
    if (node.kind === "SYSTEM") {
      const region = state.graph.system_regions.find((row) => row.node_id === node.id);
      if (region) {
        into.append(field(
          doc, uiCopy("State"),
          uiFormat("{0} {1}", [STATE_GLYPH[region.state] ?? "", uiCopy(STATE_WORD[region.state] ?? uiSource("Unclear"))]),
        ));
        into.append(field(doc, uiCopy("Why"), formatV197SystemStateReason(region)));
        into.append(field(doc, uiCopy("Active goals"), String(region.active_goal_count)));
        into.append(field(doc, uiCopy("Unresolved blockers"), String(region.blocker_count)));
      }
    }
    if (node.kind === "BLOCKER") {
      into.append(field(doc, uiCopy("Category"), mapBlockerCategoryLabel(data.category)));
      into.append(field(
        doc, uiCopy("Basis"),
        uiCopy(BASIS_PRESENTATION[
          data.basis === "NUR_INFERRED" ? "MODEL_INFERENCE"
            : data.basis === "OBSERVED" ? "DIRECT_FACT" : "USER_INTERPRETATION"
        ]?.word ?? uiSource("Unresolved")),
      ));
      // A blocker NUR only proposed is never presented as established.
      if (data.confirmed_by_owner === false) {
        const notice = el(doc, "div", "nur-map-doubt");
        notice.append(el(doc, "p", "nur-map-doubt-label", uiCopy("Not confirmed")));
        notice.append(el(
          doc, "p", "nur-map-field-value",
          uiCopy("NUR proposed this. It is not treated as a real blocker until you say it is."),
        ));
        into.append(notice);
      }
      const affects = (data.affects as { type?: string; id?: string }[] | undefined) ?? [];
      into.append(field(
        doc, uiCopy("What it affects"),
        affects.length
          ? affects.map((ref) => labelOf(`${ref.type}:${ref.id}`)).join(" · ")
          : uiCopy("Nothing linked yet"),
        affects.length === 0,
      ));
      into.append(field(doc, uiCopy("Evidence items"), String(data.evidence_count ?? 0)));
    }
    if (node.kind === "DECISION") {
      into.append(field(doc, uiCopy("Options recorded"), String(data.option_count ?? 0)));
      into.append(field(
        doc, uiCopy("Resolved"),
        data.chosen_option_id
          ? labelOf(structuralValue(`decision-option:${data.chosen_option_id}`))
          : uiCopy("Not yet"),
        !data.chosen_option_id,
      ));
      into.append(field(doc, uiCopy("Rationale"), text(data.rationale, uiCopy("None recorded"))));
    }
    if (node.kind === "GOAL") {
      into.append(field(doc, uiCopy("Progress"), uiFormat("{0}% verified", [text(data.progress_percent, "0")])));
      into.append(field(doc, uiCopy("Target date"), text(data.target_date, uiCopy("No target date"))));
      into.append(field(doc, uiCopy("Why it matters"), text(data.why, uiCopy("Not recorded"))));
    }
    if (node.kind === "DECISION_OPTION") {
      into.append(field(doc, uiCopy("Reversibility"), mapReversibilityLabel(data.reversibility)));
      into.append(field(doc, uiCopy("Time horizon"), text(data.time_horizon, uiCopy("Not stated")), !data.time_horizon));
      into.append(field(doc, uiCopy("Risks recorded"), String(data.risk_count ?? 0)));
    }
    if (typeof data.annotation_count === "number") {
      into.append(field(doc, uiCopy("Your notes"), String(data.annotation_count)));
    }
    if (!into.childElementCount) {
      into.append(el(
        doc, "p", "nur-map-empty",
        uiCopy("This object carries no recorded detail beyond its name and place."),
      ));
    }
  }

  function pathTab(into: HTMLElement, node: GraphNode): void {
    const dependencies = state.graph.edges.filter(
      (edge) => edge.target === node.id && edge.kind === "DEPENDS_ON",
    );
    const blocks = state.graph.edges.filter(
      (edge) => edge.target === node.id && edge.kind === "BLOCKS",
    );
    const children = state.graph.nodes.filter((row) => row.parent_id === node.id);

    into.append(field(
      doc, uiCopy("Depends on"),
      dependencies.length
        ? dependencies.map((edge) => labelOf(edge.source)).join(" · ")
        : uiCopy("Nothing recorded"),
      dependencies.length === 0,
    ));
    into.append(field(
      doc, uiCopy("Blocked by"),
      blocks.length ? blocks.map((edge) => labelOf(edge.source)).join(" · ") : uiCopy("Nothing"),
      blocks.length === 0,
    ));
    into.append(field(
      doc, uiCopy("Contains"),
      children.length ? children.map((row) => row.label).join(" · ") : uiCopy("Nothing yet"),
      children.length === 0,
    ));

    const row = el(doc, "div", "nur-map-candidate-actions");
    if (node.kind === "GOAL") {
      const compare = capsule(doc, uiCopy("Compare paths"));
      compare.addEventListener("click", () => {
        state.selected = node.id;
        actions.setMode("paths");
      });
      row.append(compare);
    }
    row.append(capsule(
      doc, uiCopy("Continue Plan"),
      uiCopy("Not built yet. Plan execution lives on the Plan page, which owns the step flow."),
    ));
    row.append(capsule(
      doc, uiCopy("Add to Timeline"),
      uiCopy("Not built yet from Map. Timeline owns scheduling; POST /timeline/from-goal exists."),
    ));
    into.append(row);
  }

  function evidenceTab(into: HTMLElement): void {
    const evidence = state.evidence;
    if (!evidence) {
      into.append(el(doc, "p", "nur-map-empty", uiCopy("Loading the evidence for this object…")));
      return;
    }
    const supporting = (evidence.supporting as Record<string, unknown>[] | undefined) ?? [];
    const contradicting = (evidence.contradicting as Record<string, unknown>[] | undefined) ?? [];
    const missing = (evidence.missing_information as string[] | undefined) ?? [];

    const render = (rows: Record<string, unknown>[], against: boolean): void => {
      for (const row of rows) {
        const card = el(doc, "div", "nur-map-card");
        if (against) card.classList.add("is-contradicting");
        const cls = String(row.evidence_class ?? "USER_INTERPRETATION");
        const presentation = BASIS_PRESENTATION[cls] ?? BASIS_PRESENTATION.USER_INTERPRETATION;
        // Basis is always visible, in words and with a glyph — never hue alone.
        const badge = el(doc, "p", `nur-map-card-basis ${presentation.cls}`);
        badge.textContent = uiFormat("{0} {1}", [presentation.glyph, uiCopy(presentation.word)]);
        card.append(badge);
        card.append(el(doc, "p", "nur-map-field-value", text(row.body, "")));
        card.append(el(doc, "p", "nur-map-row-meta", uiFormat("Source: {0}", [mapEvidenceSourceLabel(row.source)])));
        into.append(card);
      }
    };

    into.append(el(doc, "p", "nur-map-nav-label", uiCopy("Supporting")));
    if (supporting.length) render(supporting, false);
    else into.append(el(doc, "p", "nur-map-empty", uiCopy("Nothing supports this yet.")));

    into.append(el(doc, "p", "nur-map-nav-label", uiCopy("Contradicting")));
    if (contradicting.length) render(contradicting, true);
    else into.append(el(doc, "p", "nur-map-empty", uiCopy("Nothing argues against this yet.")));

    // Naming what is absent is part of the evidence picture.
    if (missing.length) {
      into.append(el(doc, "p", "nur-map-nav-label", uiCopy("Missing information")));
      for (const line of missing) {
        into.append(el(doc, "p", "nur-map-empty", line));
      }
    }
  }

  function activityTab(into: HTMLElement): void {
    const activity = state.activity;
    const items = (activity?.items as Record<string, unknown>[] | undefined) ?? [];
    if (!items.length) {
      into.append(el(doc, "p", "nur-map-empty", uiCopy("Nothing has happened to this object yet.")));
      return;
    }
    const list = el(doc, "ul", "nur-map-nav-list");
    for (const row of items) {
      const item = el(doc, "li", "nur-map-card");
      item.append(el(doc, "p", "nur-map-card-basis", mapActivityKindLabel(row.kind)));
      item.append(el(doc, "p", "nur-map-field-value", text(row.title, "")));
      item.append(el(doc, "p", "nur-map-row-meta", text(row.at, "")));
      list.append(item);
    }
    into.append(list);
  }

  function nurViewTab(into: HTMLElement, node: GraphNode): void {
    const predictions = (state.predictions?.items as Record<string, unknown>[] | undefined) ?? [];
    if (predictions.length) {
      into.append(el(doc, "p", "nur-map-nav-label", uiCopy("Predictions")));
      for (const row of predictions) {
        const card = el(doc, "div", "nur-map-card");
        const badge = el(doc, "p", "nur-map-card-basis nur-map-basis-prediction");
        badge.textContent = uiCopy("◇ Prediction");
        card.append(badge);
        card.append(el(doc, "p", "nur-map-field-value", text(row.statement, "")));
        // Confidence is shown as a range word, and certainty is impossible.
        card.append(el(
          doc, "p", "nur-map-row-meta",
          row.confidence === null || row.confidence === undefined
            ? uiCopy("No confidence recorded · never certain")
            : uiFormat("Confidence {0} · never certain", [row.confidence]),
        ));
        const assumptions = (row.assumptions as string[] | undefined) ?? [];
        if (assumptions.length) {
          card.append(el(doc, "p", "nur-map-row-meta", uiFormat("Rests on: {0}", [assumptions.join("; ")])));
        }
        if (row.overdue_for_review) {
          card.append(el(
            doc, "p", "nur-map-row-meta",
            uiCopy("Past its review date — anything resting on this rests on an unchecked assumption."),
          ));
        }
        if (row.resolution) {
          card.append(el(doc, "p", "nur-map-row-meta", uiFormat("Outcome: {0}", [
            mapPredictionResolutionLabel(row.resolution),
          ])));
        }
        into.append(card);
      }
    } else {
      into.append(el(doc, "p", "nur-map-empty", uiCopy("NUR has made no prediction about this.")));
    }

    // §17: this section is required and is never omitted.
    const doubt = el(doc, "div", "nur-map-doubt");
    doubt.dataset.mapDoubt = "true";
    doubt.append(el(doc, "p", "nur-map-doubt-label", uiCopy("What NUR may be wrong about")));
    const kindWord = uiCopy(KIND_WORD[node.kind] ?? uiSource("Object"));
    doubt.append(el(
      doc, "p", "nur-map-field-value",
      node.kind === "BLOCKER" && node.data.basis === "NUR_INFERRED"
        ? uiCopy("This blocker was inferred, not stated. NUR may have read a delay as an obstacle when it was a choice.")
        : uiFormat("NUR sees this {0} only through what has been recorded. Anything you have not written down is invisible here, so its place on the Map may be more confident than the evidence deserves.", [kindWord]),
    ));
    into.append(doubt);
  }

  function candidateCard(suggestion: Suggestion): HTMLElement {
    const card = el(doc, "div", "nur-map-candidate");
    card.dataset.mapCandidate = suggestion.id;
    const mark = el(doc, "p", "nur-map-candidate-mark");
    // A candidate is marked as a candidate, in words as well as by its dashes.
    mark.textContent = uiFormat("◈ NUR suggests · {0}", [
      mapSuggestionTypeLabel(suggestion.suggestion_type),
    ]);
    card.append(mark);
    card.append(el(doc, "p", "nur-map-field-value", suggestion.explanation));

    const doubt = el(doc, "div", "nur-map-doubt");
    doubt.append(el(doc, "p", "nur-map-doubt-label", uiCopy("May be wrong about")));
    doubt.append(el(doc, "p", "nur-map-field-value", suggestion.may_be_wrong_about));
    card.append(doubt);

    const row = el(doc, "div", "nur-map-candidate-actions");
    const accept = capsule(doc, uiCopy("Accept"));
    accept.classList.add("nur-map-capsule-sm");
    accept.dataset.mapAccept = suggestion.id;
    accept.addEventListener("click", () => actions.accept(suggestion.id));
    const reject = capsule(doc, uiCopy("Reject"));
    reject.classList.add("nur-map-capsule-sm");
    reject.dataset.mapReject = suggestion.id;
    reject.addEventListener("click", () => actions.reject(suggestion.id, false));
    const never = capsule(doc, uiCopy("Never suggest this kind"));
    never.classList.add("nur-map-capsule-sm");
    never.addEventListener("click", () => actions.reject(suggestion.id, true));
    row.append(accept, reject, never);
    card.append(row);
    return card;
  }

  // ── paint ──────────────────────────────────────────────────────────────────

  function paint(): void {
    const searchFocus = captureV197SearchFocus(doc, SEARCH_SELECTOR);
    doc.getElementById(ROOT_ID)?.remove();
    const root = el(doc, "div");
    root.id = ROOT_ID;
    root.dataset.v197NativeAdjunct = "true";

    const shell = el(doc, "div", "nur-map-shell");
    // Exposed so a caller can wait for the graph rather than racing the first
    // paint, and so the loading state is observable rather than inferred.
    root.dataset.mapLoaded = state.loaded ? "true" : "false";
    if (isMobile && state.selected) shell.classList.add("is-mobile-detail");
    shell.append(mapHeader());

    if (state.error) {
      const banner = el(doc, "div", "nur-map-banner");
      banner.dataset.mapError = "true";
      banner.textContent = state.error;
      const retry = capsule(doc, uiCopy("Retry"));
      retry.classList.add("nur-map-capsule-sm");
      retry.addEventListener("click", () => { void loadGraph(); });
      banner.append(doc.createTextNode(" "));
      banner.append(retry);
      shell.append(banner);
    } else if (state.notice) {
      const banner = el(doc, "div", "nur-map-banner is-notice");
      banner.textContent = state.notice;
      shell.append(banner);
    }

    const zones = el(doc, "div", "nur-map-zones");
    zones.append(mapNavigator());
    if (state.mode === "paths") zones.append(mapPathsView());
    else if (state.mode === "decisions") zones.append(mapDecisionsView());
    // On a phone, Focus is a list. The galaxy is Visual mode, reached explicitly.
    else if (isMobile && state.mode === "focus") zones.append(mapMobileFocusList());
    else zones.append(mapCanvas());
    zones.append(mapDetailPanel());
    shell.append(zones);

    root.append(shell);
    root.append(createV197StarSeal(doc));
    host.append(root);
    restoreV197SearchFocus(root, SEARCH_SELECTOR, searchFocus);
  }

  paint();
  await loadGraph();
  return true;
}
