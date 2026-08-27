/**
 * Orbit — the relational world, rendered V197-native.
 *
 * Plain DOM and SVG through the bridge, not React. The §29 component tree is
 * preserved as the function decomposition below (`orbitHeader`, `orbitLeftRail`,
 * `orbitCanvas`, `orbitListView`, `orbitThreadsView`, `orbitDetailPanel` and the
 * tab renderers), because the architecture law is that the canonical V197
 * document owns the visible product and `#root` never appears on a product page.
 *
 * Everything displayed here comes from `/api/v1/orbit-*`. There is no seeded
 * person, no sample edge and no placeholder activity anywhere in this file: an
 * owner with an empty Orbit sees the empty state, because inventing relational
 * gravity would be the worst possible lie for this particular surface.
 *
 * The one rule that shapes the detail panel: a reading's *basis* is always
 * visible. A signal the owner stated and a signal NUR inferred are rendered with
 * different marks and different words, an inferred one always shows the evidence
 * it rests on and the evidence against it, and no card ever presents a guess as
 * a fact.
 */

import ORBIT_CSS from "../styles/v197-orbit.css?raw";
import { markV197HolographicWordmark } from "./v197Brand";
import {
  cancelV197SearchCommit,
  captureV197SearchFocus,
  restoreV197SearchFocus,
  scheduleV197SearchCommit,
} from "./v197SearchInput";
import { createV197StartupStar } from "./v197StarSeal";
import { claimV197SurfaceHost, releaseV197SurfaceHost } from "./v197SurfaceHost";
import type { V197ApiClient } from "./v197ApiClient";
import {
  activeUiLocale,
  structuralValue,
  type UiCopyKey,
  uiCopy,
  uiFormat,
  uiSource,
} from "../lib/i18n";

const ROOT_ID = "nur-orbit-root";
const STYLE_ID = "nur-orbit-style";
const BODY_CLASS = "nur-v197-orbit-active";
const SEARCH_KEY = "orbit";
const SEARCH_SELECTOR = ".nur-orbit-search";

export const ORBIT_ROUTE = "/universe/orbits";

export type OrbitBand = "INNER" | "NEAR" | "OUTER" | "PERIPHERAL" | "DORMANT";

const BANDS: OrbitBand[] = ["INNER", "NEAR", "OUTER", "PERIPHERAL", "DORMANT"];

/** Ring radius as a fraction of the field's half-height, inner band nearest. */
const BAND_RADIUS: Record<OrbitBand, number> = {
  INNER: 0.22,
  NEAR: 0.4,
  OUTER: 0.58,
  PERIPHERAL: 0.76,
  DORMANT: 0.92,
};

/** Node radius per band. Controlled, so a score can never inflate a planet. */
const BAND_NODE_RADIUS: Record<OrbitBand, number> = {
  INNER: 15,
  NEAR: 12.5,
  OUTER: 10,
  PERIPHERAL: 8,
  DORMANT: 8,
};

const BAND_LABEL: Record<OrbitBand, UiCopyKey> = {
  INNER: uiSource("Inner"),
  NEAR: uiSource("Near"),
  OUTER: uiSource("Outer"),
  PERIPHERAL: uiSource("Peripheral"),
  DORMANT: uiSource("Dormant"),
};

const SIGNAL_KINDS = ["CONNECTION", "TRUST", "MOMENTUM", "TENSION"] as const;

const BASIS_WORD: Record<string, UiCopyKey> = {
  USER_STATED: uiSource("You said this"),
  OBSERVED: uiSource("Measured from activity"),
  NUR_INFERRED: uiSource("NUR inferred this"),
};

const THREAD_GROUPS: { status: string; label: UiCopyKey }[] = [
  { status: "ACTIVE", label: uiSource("Active") },
  { status: "WAITING_ON_YOU", label: uiSource("Waiting on you") },
  { status: "WAITING_ON_OTHERS", label: uiSource("Waiting on others") },
  { status: "CONSULTATION", label: uiSource("Consultation") },
  { status: "RESOLVED", label: uiSource("Resolved") },
  { status: "DORMANT", label: uiSource("Dormant") },
];

const RELATIONAL_STATE_WORD: Readonly<Record<string, UiCopyKey>> = {
  STABLE: uiSource("Stable"),
  DEEPENING: uiSource("Deepening"),
  RECONNECTING: uiSource("Reconnecting"),
  DRIFTING: uiSource("Drifting"),
  UNCLEAR: uiSource("Unclear"),
  TENSE: uiSource("Tense"),
  REPAIRING: uiSource("Repairing"),
  DORMANT: uiSource("Dormant"),
};

const GROUP_TYPE_WORD: Readonly<Record<string, UiCopyKey>> = {
  CIRCLE: uiSource("Circle"),
};

const GROUP_PRIVACY_WORD: Readonly<Record<string, UiCopyKey>> = {
  PRIVATE_ORGANIZER: uiSource("Private organizer"),
  SHARED_CONTEXT: uiSource("Shared context"),
  GROUP_NUR: uiSource("Group NUR"),
  WITNESS_ONLY: uiSource("Witness only"),
};

const SIGNAL_KIND_WORD: Readonly<Record<string, UiCopyKey>> = {
  CONNECTION: uiSource("Connection"),
  TRUST: uiSource("Trust"),
  MOMENTUM: uiSource("Momentum"),
  TENSION: uiSource("Tension"),
};

const THREAD_STATUS_WORD: Readonly<Record<string, UiCopyKey>> = Object.fromEntries(
  THREAD_GROUPS.map(row => [row.status, row.label]),
);

const CONTEXT_VISIBILITY_WORD: Readonly<Record<string, UiCopyKey>> = {
  PRIVATE: uiSource("Private"),
  ORBIT_SHARED: uiSource("Shared with Orbit"),
  GROUP_SHARED: uiSource("Shared with group"),
  CAPSULE_SHARED: uiSource("Shared by capsule"),
  SYSTEM_SHARED: uiSource("Shared with System"),
};

const CONTEXT_SOURCE_WORD: Readonly<Record<string, UiCopyKey>> = {
  CONTEXT: uiSource("Context"),
  TALK: uiSource("Talk"),
  JOURNAL: uiSource("Journal"),
  PLAN: uiSource("Plan"),
  SYSTEM: uiSource("System"),
  TIMELINE_EVENT: uiSource("Timeline event"),
  PROJECT: uiSource("Project"),
  RESEARCH_SOURCE: uiSource("Research source"),
  WEB_SIGNAL: uiSource("Web signal"),
  ORBIT: uiSource("Orbit"),
  INSIGHT: uiSource("Insight"),
  OWNER_NOTE: uiSource("Owner note"),
  CONVERSATION_SUMMARY: uiSource("Conversation summary"),
};

const ORBIT_ERROR_CODE_WORD: Readonly<Record<string, UiCopyKey>> = {
  CAPABILITY_DENIED: uiSource("This action is not available with the current permission."),
  CSRF_MISSING: uiSource("Your NUR session needs to be renewed."),
  SESSION_EXPIRED: uiSource("Your NUR session needs to be renewed."),
  NOT_FOUND: uiSource("That Orbit record is no longer available."),
  CONFLICT: uiSource("That Orbit record changed before NUR could save this action."),
  RATE_LIMITED: uiSource("NUR is receiving too many requests. Try again shortly."),
};

const ORBIT_ERROR_STATUS_WORD: Readonly<Record<number, UiCopyKey>> = {
  0: uiSource("NUR could not reach the service."),
  200: uiSource("NUR returned an invalid response."),
  400: uiSource("NUR could not use that request."),
  401: uiSource("Your NUR session needs to be renewed."),
  403: uiSource("This action is not available with the current permission."),
  404: uiSource("That Orbit record is no longer available."),
  409: uiSource("That Orbit record changed before NUR could save this action."),
  422: uiSource("NUR could not use one of the submitted values."),
  429: uiSource("NUR is receiving too many requests. Try again shortly."),
  500: uiSource("NUR could not complete that Orbit request."),
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

export function orbitRelationalStateLabel(value: unknown): string {
  return controlledLabel(RELATIONAL_STATE_WORD, value);
}

export function orbitGroupTypeLabel(value: unknown): string {
  return controlledLabel(GROUP_TYPE_WORD, value);
}

export function orbitPrivacyModeLabel(value: unknown): string {
  return controlledLabel(GROUP_PRIVACY_WORD, value);
}

export function orbitSignalKindLabel(value: unknown): string {
  return controlledLabel(SIGNAL_KIND_WORD, value);
}

export function orbitThreadStatusLabel(value: unknown): string {
  return controlledLabel(THREAD_STATUS_WORD, value);
}

export function orbitContextVisibilityLabel(value: unknown): string {
  return controlledLabel(CONTEXT_VISIBILITY_WORD, value);
}

export function orbitContextSourceLabel(value: unknown): string {
  return controlledLabel(CONTEXT_SOURCE_WORD, value);
}

/** Visible errors are localized classifications; raw diagnostics stay in devtools. */
export function orbitVisibleFailure(
  error: unknown,
  fallback: UiCopyKey = uiSource("NUR could not complete that Orbit request."),
  context = "request",
): string {
  console.error(`[NUR Orbit] ${context}`, error);
  const detail = typeof error === "object" && error !== null
    ? error as { code?: unknown; status?: unknown }
    : null;
  const code = controlledToken(detail?.code);
  const status = typeof detail?.status === "number" ? detail.status : null;
  const source = (code && ORBIT_ERROR_CODE_WORD[code])
    || (status !== null && ORBIT_ERROR_STATUS_WORD[status])
    || (status !== null && status >= 500 ? ORBIT_ERROR_STATUS_WORD[500] : undefined)
    || fallback;
  return uiCopy(source);
}

export interface OrbitPerson {
  id: string;
  display_name: string;
  handle: string | null;
  relationship_type: string | null;
  orbit_level: OrbitBand | null;
  orbit_level_suggestion: OrbitBand | null;
  orbit_level_suggestion_reason: string | null;
  relational_state: string | null;
  tags: string[];
  user_summary: string | null;
  nur_summary: string | null;
  avatar_ref: string | null;
  memory_allowed: boolean;
  inference_allowed: boolean;
  sharing_allowed: boolean;
  capsule_eligible: boolean;
  archived_at: string | null;
  last_interaction_at: string | null;
  privacy_scope: string;
}

export interface OrbitGroupRow {
  id: string;
  name: string;
  purpose: string | null;
  group_type: string;
  privacy_mode: string;
  shared_memory_enabled: boolean;
  group_nur_enabled: boolean;
  system_slug: string | null;
  archived_at: string | null;
  member_count: number;
}

export interface OrbitEdge {
  id: string;
  source_person_id: string;
  target_person_id: string | null;
  target_group_id: string | null;
  relationship_type: string | null;
  strength_user: number | null;
  activity_score: number;
  reciprocity_score: number;
  momentum_score: number;
  tension_score: number;
  confidence: number | null;
}

export interface OrbitLayoutRow {
  entity_type: "PERSON" | "GROUP";
  entity_id: string;
  x: number;
  y: number;
  pinned: boolean;
  collapsed: boolean;
}

export interface OrbitSignal {
  id: string;
  person_id: string;
  signal_kind: string;
  basis: string;
  value: number | null;
  confidence: number | null;
  evidence: unknown[];
  contradictory_evidence: unknown[];
}

export interface OrbitField {
  people: OrbitPerson[];
  groups: OrbitGroupRow[];
  relationships: OrbitEdge[];
  layout: OrbitLayoutRow[];
  thread_counts: Record<string, number>;
}

export interface OrbitThreadRow {
  id: string;
  person_id: string | null;
  group_id: string | null;
  topic: string;
  participants: unknown[];
  status: string;
  last_event_at: string | null;
  last_event_summary: string | null;
  open_decision: string | null;
  next_action: string | null;
  plan_id: string | null;
  system_slug: string | null;
}

type OrbitView = "orbit" | "list" | "threads";
type DetailTab = "overview" | "context" | "threads" | "plans" | "insights";

interface OrbitState {
  view: OrbitView;
  field: OrbitField;
  threads: OrbitThreadRow[];
  query: string;
  bandFilter: OrbitBand | "ALL" | "GROUPS";
  selected: { type: "PERSON" | "GROUP"; id: string } | null;
  tab: DetailTab;
  sort: "name" | "band" | "recent";
  signals: OrbitSignal[];
  context: Record<string, unknown>[];
  insights: Record<string, unknown>[];
  personThreads: OrbitThreadRow[];
  expandedWhy: string | null;
  error: string | null;
}

// ── small DOM helpers, matching the adjunct idiom ────────────────────────────

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

/** Every control in Orbit is a capsule. There is no boxed-button helper. */
function capsule(
  doc: Document, label: string, variant: "primary" | "default" | "quiet" | "destructive" = "default",
): HTMLButtonElement {
  const node = el(doc, "button", "nur-orbit-capsule", label);
  node.type = "button";
  if (variant === "primary") node.classList.add("is-primary");
  if (variant === "quiet") node.classList.add("is-quiet");
  if (variant === "destructive") node.classList.add("is-destructive");
  return node;
}

function chip(doc: Document, label: string, pressed: boolean, count?: number): HTMLButtonElement {
  const node = el(doc, "button", "nur-orbit-chip");
  node.type = "button";
  node.setAttribute("aria-pressed", pressed ? "true" : "false");
  node.append(doc.createTextNode(label));
  if (typeof count === "number") {
    node.append(el(doc, "span", "nur-orbit-count", String(count)));
  }
  return node;
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = ORBIT_CSS;
  doc.head.append(style);
}

function bandOf(person: OrbitPerson): OrbitBand | "UNPLACED" {
  return person.orbit_level ?? "UNPLACED";
}

function activityOf(person: OrbitPerson): "active" | "stable" | "dormant" {
  if (person.archived_at || person.orbit_level === "DORMANT") return "dormant";
  if (!person.last_interaction_at) return "stable";
  const days = (Date.now() - new Date(person.last_interaction_at).getTime()) / 86_400_000;
  return days <= 14 ? "active" : days > 90 ? "dormant" : "stable";
}

/** Edge meaning from stored scores. Drives both hue and dash pattern. */
function edgeMeaning(edge: OrbitEdge): string {
  if (edge.tension_score >= 40) return "tense";
  if (edge.target_group_id) return "collaborative";
  if (edge.momentum_score >= 50) return "collaborative";
  if ((edge.strength_user ?? 0) >= 75) return "intense";
  if (edge.confidence !== null && edge.confidence < 0.4) return "uncertain";
  if (edge.activity_score <= 5) return "dormant";
  return "active";
}

function relativeDate(value: string | null): string {
  if (!value) return uiCopy("No recorded activity");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const days = Math.floor((Date.now() - parsed.getTime()) / 86_400_000);
  if (days <= 0) return uiCopy("Today");
  if (days === 1) return uiCopy("Yesterday");
  if (days < 30) return uiFormat("{0} days ago", [days]);
  return parsed.toLocaleDateString(activeUiLocale());
}

function orbitCreationActions(
  doc: Document,
  actions: Actions,
  className: string,
): HTMLElement {
  const row = el(doc, "div", className);
  const addPerson = capsule(doc, uiCopy("✦ Add a person"), "primary");
  addPerson.dataset.orbitAction = "add-person";
  addPerson.addEventListener("click", () => actions.addPerson());

  const createGroup = capsule(doc, uiCopy("Create Group"));
  createGroup.dataset.orbitAction = "create-group";
  createGroup.addEventListener("click", () => actions.createGroup());
  row.append(addPerson, createGroup);
  return row;
}

// ── header ───────────────────────────────────────────────────────────────────

function orbitHeader(doc: Document, state: OrbitState, actions: Actions): HTMLElement {
  const header = el(doc, "header", "nur-orbit-header");

  const titleBlock = el(doc, "div");
  const title = el(doc, "h1", "nur-orbit-title", uiCopy("Orbit"));
  markV197HolographicWordmark(title);
  titleBlock.append(title);
  titleBlock.append(
    el(doc, "p", "nur-orbit-subtitle", uiCopy("People, circles and relational gravity")),
  );
  header.append(titleBlock);

  const switcher = el(doc, "div", "nur-orbit-segmented");
  switcher.setAttribute("role", "tablist");
  switcher.setAttribute("aria-label", uiCopy("Orbit view"));
  for (const [view, label] of [
    ["orbit", uiSource("Orbit")], ["list", uiSource("List")], ["threads", uiSource("Threads")],
  ] as [OrbitView, UiCopyKey][]) {
    const tab = capsule(doc, uiCopy(label));
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", state.view === view ? "true" : "false");
    tab.dataset.orbitView = view;
    tab.addEventListener("click", () => actions.setView(view));
    switcher.append(tab);
  }
  header.append(switcher);

  header.append(el(doc, "div", "nur-orbit-header-spacer"));

  const search = el(doc, "input", "nur-orbit-search");
  search.type = "search";
  search.placeholder = uiCopy("Search people, groups, plans or threads");
  search.setAttribute("aria-label", uiCopy("Search people, groups, plans or threads"));
  search.value = state.query;
  search.addEventListener("input", () => {
    scheduleV197SearchCommit(doc, SEARCH_KEY, search.value, actions.setQuery);
  });
  header.append(search);

  if (state.view !== "orbit") {
    header.append(orbitCreationActions(doc, actions, "nur-orbit-header-actions"));
  }

  return header;
}

// ── left rail ────────────────────────────────────────────────────────────────

function orbitLeftRail(doc: Document, state: OrbitState, actions: Actions): HTMLElement {
  const rail = el(doc, "aside", "nur-orbit-rail");
  rail.setAttribute("aria-label", uiCopy("Orbit filters"));

  const people = state.field.people;
  const countIn = (band: OrbitBand) => people.filter((p) => p.orbit_level === band).length;

  const scopes = el(doc, "section", "nur-orbit-rail-section");
  scopes.append(el(doc, "h2", "nur-orbit-rail-heading", uiCopy("Scopes")));
  const scopeChips = el(doc, "div", "nur-orbit-chips");
  const scopeDefs: [OrbitBand | "ALL" | "GROUPS", UiCopyKey, number][] = [
    ["ALL", uiSource("All"), people.length],
    ["INNER", uiSource("Inner"), countIn("INNER")],
    ["NEAR", uiSource("Near"), countIn("NEAR")],
    ["OUTER", uiSource("Outer"), countIn("OUTER")],
    ["PERIPHERAL", uiSource("Peripheral"), countIn("PERIPHERAL")],
    ["DORMANT", uiSource("Dormant"), countIn("DORMANT")],
    ["GROUPS", uiSource("Groups"), state.field.groups.length],
  ];
  for (const [key, label, count] of scopeDefs) {
    const node = chip(doc, uiCopy(label), state.bandFilter === key, count);
    node.dataset.orbitScope = String(key);
    node.addEventListener("click", () => actions.setBandFilter(key));
    scopeChips.append(node);
  }
  scopes.append(scopeChips);
  rail.append(scopes);

  // Smart segments, each computed from real rows. A segment with nothing in it
  // shows zero rather than being hidden, so the owner can see it is empty.
  const segments = el(doc, "section", "nur-orbit-rail-section");
  segments.append(el(doc, "h2", "nur-orbit-rail-heading", uiCopy("Segments")));
  const segChips = el(doc, "div", "nur-orbit-chips");
  const active = people.filter((p) => activityOf(p) === "active").length;
  const dormant = people.filter((p) => activityOf(p) === "dormant").length;
  const emerging = people.filter((p) => !p.orbit_level && !p.archived_at).length;
  const needsAttention = people.filter(
    (p) => p.relational_state === "TENSE" || p.relational_state === "DRIFTING"
      || p.orbit_level_suggestion !== null,
  ).length;
  for (const [label, count] of [
    [uiSource("Active now"), active], [uiSource("Needs attention"), needsAttention],
    [uiSource("Emerging"), emerging], [uiSource("Dormant"), dormant],
  ] as [UiCopyKey, number][]) {
    const node = chip(doc, uiCopy(label), false, count);
    node.disabled = count === 0;
    segChips.append(node);
  }
  segments.append(segChips);
  rail.append(segments);

  const create = el(doc, "section", "nur-orbit-rail-section");
  create.append(el(doc, "h2", "nur-orbit-rail-heading", uiCopy("Context")));
  // Import is declared and honestly disabled: suggesting people from Talk and
  // Journal requires an approval step that does not exist yet, and adding
  // inferred people without it is exactly what the spec forbids.
  const importBtn = capsule(doc, uiCopy("Import from NUR context"), "quiet");
  importBtn.style.width = "100%";
  importBtn.style.marginTop = "6px";
  importBtn.disabled = true;
  importBtn.title = uiCopy("Not connected yet. Importing would add people NUR inferred from Talk and Journal, and that needs an explicit approval step before anything is stored.");
  create.append(importBtn);
  rail.append(create);

  return rail;
}

// ── the field ────────────────────────────────────────────────────────────────

function orbitCanvas(doc: Document, state: OrbitState, actions: Actions): HTMLElement {
  const surface = el(doc, "section", "nur-orbit-field-surface");

  const visible = visiblePeople(state);
  const fieldIsEmpty = visible.length === 0 && state.field.groups.length === 0;

  const width = 900;
  const height = 620;
  const cx = width / 2;
  const cy = height / 2;
  const canvas = svg(doc, "svg", {
    class: "nur-orbit-canvas",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
    role: "img",
  });
  canvas.setAttribute(
    "aria-label",
    uiFormat("Relational field: {0} people, {1} groups. A parallel list of every node is available in List view.", [visible.length, state.field.groups.length]),
  );
  if (state.selected) canvas.dataset.hasSelection = "true";

  const defs = svg(doc, "defs");
  const ringSpectrum = svg(doc, "linearGradient", {
    id: "nur-orbit-ring-spectrum",
    x1: "0%", y1: "18%", x2: "100%", y2: "82%",
  });
  for (const [offset, color] of [
    ["0%", "#ffd35a"],
    ["18%", "#ff7a45"],
    ["35%", "#ff52ab"],
    ["52%", "#b66cff"],
    ["68%", "#4fccff"],
    ["84%", "#48ebaf"],
    ["100%", "#f8d98a"],
  ]) {
    ringSpectrum.append(svg(doc, "stop", { offset, "stop-color": color }));
  }
  defs.append(ringSpectrum);
  canvas.append(defs);

  // Layer 1 — deep space. A fixed, deterministic scatter: a random field would
  // shift on every re-render and read as flicker.
  const stars = svg(doc, "g", { class: "nur-orbit-deep-stars" });
  const starColors = ["#fff8df", "#ffd35a", "#ff7a45", "#ff52ab", "#b66cff", "#4fccff", "#48ebaf"];
  for (let i = 0; i < 180; i += 1) {
    const t = (i * 2654435761) % 100000;
    stars.append(svg(doc, "circle", {
      cx: (t % width), cy: ((t * 7) % height),
      r: i % 17 === 0 ? 1.25 : i % 7 === 0 ? 0.8 : 0.45,
      fill: starColors[i % starColors.length],
      opacity: i % 11 === 0 ? 0.42 : 0.2,
    }));
  }
  canvas.append(stars);

  // Layer 2 — orbit geometry.
  const rings = svg(doc, "g", {});
  for (const band of BANDS) {
    const rx = BAND_RADIUS[band] * (width / 2) * 0.92;
    const ry = BAND_RADIUS[band] * (height / 2) * 0.92;
    const ring = svg(doc, "ellipse", {
      cx, cy, rx, ry, class: "nur-orbit-ring", stroke: "url(#nur-orbit-ring-spectrum)",
    });
    ring.setAttribute("data-band", band);
    rings.append(ring);
    const label = svg(doc, "text", {
      x: cx, y: cy - ry - 5, class: "nur-orbit-ring-label", "text-anchor": "middle",
    });
    label.textContent = uiCopy(BAND_LABEL[band]);
    rings.append(label);
  }
  canvas.append(rings);

  // Position every node, honouring a saved layout where one exists.
  const layoutBy = new Map(state.field.layout.map((l) => [`${l.entity_type}:${l.entity_id}`, l]));
  const positions = new Map<string, { x: number; y: number }>();
  const byBand = new Map<OrbitBand, OrbitPerson[]>();
  for (const person of visible) {
    const band = (person.orbit_level ?? "PERIPHERAL") as OrbitBand;
    byBand.set(band, [...(byBand.get(band) ?? []), person]);
  }
  for (const band of BANDS) {
    const members = byBand.get(band) ?? [];
    members.forEach((person, index) => {
      const saved = layoutBy.get(`PERSON:${person.id}`);
      if (saved) {
        positions.set(person.id, { x: cx + saved.x, y: cy + saved.y });
        return;
      }
      const angle = (index / Math.max(members.length, 1)) * Math.PI * 2 - Math.PI / 2;
      positions.set(person.id, {
        x: cx + Math.cos(angle) * BAND_RADIUS[band] * (width / 2) * 0.92,
        y: cy + Math.sin(angle) * BAND_RADIUS[band] * (height / 2) * 0.92,
      });
    });
  }
  state.field.groups.forEach((group, index) => {
    const saved = layoutBy.get(`GROUP:${group.id}`);
    const angle = (index / Math.max(state.field.groups.length, 1)) * Math.PI * 2 + Math.PI / 4;
    positions.set(group.id, saved
      ? { x: cx + saved.x, y: cy + saved.y }
      : {
          x: cx + Math.cos(angle) * 0.66 * (width / 2),
          y: cy + Math.sin(angle) * 0.66 * (height / 2),
        });
  });

  // Layer 3 — relationships.
  const edges = svg(doc, "g", {});
  const connected = new Set<string>();
  for (const edge of state.field.relationships) {
    const from = positions.get(edge.source_person_id);
    const targetId = edge.target_person_id ?? edge.target_group_id ?? "";
    const to = positions.get(targetId);
    if (!from || !to) continue;
    const line = svg(doc, "line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: "nur-orbit-edge",
    });
    line.setAttribute("data-meaning", edgeMeaning(edge));
    const touchesSelection = state.selected
      && (edge.source_person_id === state.selected.id || targetId === state.selected.id);
    if (touchesSelection) {
      line.setAttribute("data-connected", "true");
      connected.add(edge.source_person_id);
      connected.add(targetId);
    }
    edges.append(line);
  }
  canvas.append(edges);

  // Layer 4 — person and group nodes. The relational center is mounted as the
  // exact loading-screen sigil after the SVG so it keeps the canonical DOM,
  // rays and three orbits instead of becoming a simplified circle drawing.
  const nodes = svg(doc, "g", {});
  for (const person of visible) {
    const at = positions.get(person.id);
    if (!at) continue;
    const band = (person.orbit_level ?? "PERIPHERAL") as OrbitBand;
    const radius = BAND_NODE_RADIUS[band];
    const group = svg(doc, "g", { class: "nur-orbit-node" });
    group.dataset.orbitNode = person.id;
    group.dataset.activity = activityOf(person);
    if (state.selected?.id === person.id) group.dataset.selected = "true";
    if (connected.has(person.id)) group.dataset.connected = "true";

    group.append(svg(doc, "circle", {
      cx: at.x, cy: at.y, r: radius + 7, class: "nur-orbit-node-halo",
      fill: "rgba(255,211,90,0.09)",
    }));
    group.append(svg(doc, "circle", {
      cx: at.x, cy: at.y, r: radius, class: "nur-orbit-node-core",
      fill: "rgba(3,3,7,0.9)",
      stroke: person.relational_state === "TENSE"
        ? "rgba(255,82,111,0.7)"
        : person.inference_allowed ? "rgba(193,107,255,0.6)" : "rgba(255,211,90,0.6)",
      "stroke-width": band === "INNER" ? 2 : 1.2,
    }));
    const initials = person.display_name.trim().slice(0, 2).toUpperCase();
    const text = svg(doc, "text", {
      x: at.x, y: at.y + 3.5, "text-anchor": "middle",
      class: "nur-orbit-node-label",
    });
    text.textContent = initials;
    group.append(text);
    const label = svg(doc, "text", {
      x: at.x, y: at.y + radius + 14, "text-anchor": "middle",
      class: "nur-orbit-node-label",
    });
    label.textContent = person.display_name;
    group.append(label);
    const tip = svg(doc, "title", {});
    tip.textContent = uiFormat("{0} · {1} · {2}", [
      person.display_name,
      person.relationship_type ?? uiCopy("Relationship not set"),
      person.orbit_level ? uiFormat("{0} Orbit", [uiCopy(BAND_LABEL[person.orbit_level])]) : uiCopy("Not yet placed"),
    ]);
    group.append(tip);
    group.addEventListener("click", () => actions.select("PERSON", person.id));
    nodes.append(group);
  }

  // Groups render as small constellations, never as large person nodes.
  for (const groupRow of state.field.groups) {
    const at = positions.get(groupRow.id);
    if (!at) continue;
    const node = svg(doc, "g", { class: "nur-orbit-node" });
    node.dataset.orbitNode = groupRow.id;
    node.dataset.orbitGroup = "true";
    if (state.selected?.id === groupRow.id) node.dataset.selected = "true";
    node.append(svg(doc, "circle", {
      cx: at.x, cy: at.y, r: 26, class: "nur-orbit-node-halo",
      fill: "rgba(33,232,255,0.05)",
    }));
    const particles = Math.min(Math.max(groupRow.member_count, 3), 7);
    for (let i = 0; i < particles; i += 1) {
      const angle = (i / particles) * Math.PI * 2;
      node.append(svg(doc, "circle", {
        cx: at.x + Math.cos(angle) * 15, cy: at.y + Math.sin(angle) * 15, r: 2.4,
        fill: "rgba(255,248,223,0.7)",
      }));
    }
    node.append(svg(doc, "circle", {
      cx: at.x, cy: at.y, r: 5, fill: "rgba(255,211,90,0.85)",
    }));
    const label = svg(doc, "text", {
      x: at.x, y: at.y + 40, "text-anchor": "middle", class: "nur-orbit-node-label",
    });
    label.textContent = uiFormat("{0} · {1}", [groupRow.name, groupRow.member_count]);
    node.append(label);
    const tip = svg(doc, "title", {});
    tip.textContent = uiFormat("{0} · {1} members · {2} · Group NUR {3}", [
      groupRow.name,
      groupRow.member_count,
      groupRow.purpose ?? uiCopy("No purpose set"),
      groupRow.group_nur_enabled ? uiCopy("active") : uiCopy("off"),
    ]);
    node.append(tip);
    node.addEventListener("click", () => actions.select("GROUP", groupRow.id));
    nodes.append(node);
  }
  canvas.append(nodes);
  surface.append(canvas);

  const anchor = el(doc, "div", "nur-orbit-anchor-sigil");
  anchor.setAttribute("role", "img");
  anchor.setAttribute("aria-label", uiCopy("You - your relational center"));
  anchor.dataset.nurOrbitAnchor = "v197-startup-sigil";
  anchor.append(createV197StartupStar(doc));
  surface.append(anchor);

  if (fieldIsEmpty) {
    surface.classList.add("is-empty");
    surface.append(orbitEmptyState(doc, state, actions));
  } else {
    surface.classList.add("has-field-actions");
    surface.append(orbitCreationActions(doc, actions, "nur-orbit-field-actions"));
  }
  return surface;
}

function orbitEmptyState(doc: Document, _state: OrbitState, actions: Actions): HTMLElement {
  const empty = el(doc, "div", "nur-orbit-empty");
  empty.dataset.nurOrbitEmptyLayout = "bottom-footer";
  empty.append(el(doc, "p", undefined,
    uiCopy("Your Orbit begins with one person, one signal, one shared field.")));
  const row = el(doc, "div", "nur-orbit-empty-actions");
  const add = capsule(doc, uiCopy("✦ Add first person"), "primary");
  add.addEventListener("click", () => actions.addPerson());
  const group = capsule(doc, uiCopy("Create a group"));
  group.addEventListener("click", () => actions.createGroup());
  row.append(add, group);
  empty.append(row);
  return empty;
}

// ── list view ────────────────────────────────────────────────────────────────

function visiblePeople(state: OrbitState): OrbitPerson[] {
  const query = state.query.trim().toLowerCase();
  let rows = state.field.people;
  if (state.bandFilter !== "ALL" && state.bandFilter !== "GROUPS") {
    rows = rows.filter((p) => p.orbit_level === state.bandFilter);
  }
  if (state.bandFilter === "GROUPS") rows = [];
  if (query) {
    rows = rows.filter((p) =>
      p.display_name.toLowerCase().includes(query)
      || (p.relationship_type ?? "").toLowerCase().includes(query)
      || p.tags.some((tag) => String(tag).toLowerCase().includes(query)));
  }
  const order = (p: OrbitPerson) => (p.orbit_level ? BANDS.indexOf(p.orbit_level) : BANDS.length);
  return [...rows].sort((a, b) => {
    if (state.sort === "band") return order(a) - order(b);
    if (state.sort === "recent") {
      return (b.last_interaction_at ?? "").localeCompare(a.last_interaction_at ?? "");
    }
    return a.display_name.localeCompare(b.display_name);
  });
}

function orbitListView(doc: Document, state: OrbitState, actions: Actions): HTMLElement {
  const surface = el(doc, "section", "nur-orbit-field-surface");
  const rows = visiblePeople(state);

  if (rows.length === 0 && state.field.groups.length === 0) {
    surface.classList.add("is-empty");
    surface.append(orbitEmptyState(doc, state, actions));
    return surface;
  }

  const list = el(doc, "div", "nur-orbit-list");
  list.setAttribute("role", "table");
  list.setAttribute("aria-label", uiCopy("Orbit people"));

  const head = el(doc, "div", "nur-orbit-list-head");
  head.setAttribute("role", "row");
  for (const [label, sort] of [
    [uiSource("Person"), "name"], [uiSource("Orbit"), "band"], [uiSource("Relationship"), null],
    [uiSource("Activity"), "recent"], [uiSource("Next move"), null], [uiSource("Privacy"), null],
  ] as [UiCopyKey, OrbitState["sort"] | null][]) {
    const cell = el(doc, "div");
    cell.setAttribute("role", "columnheader");
    if (sort) {
      const button = el(doc, "button", undefined, uiCopy(label));
      button.type = "button";
      button.addEventListener("click", () => actions.setSort(sort));
      cell.append(button);
    } else {
      cell.textContent = uiCopy(label);
    }
    head.append(cell);
  }
  list.append(head);

  for (const person of rows) {
    const row = el(doc, "button", "nur-orbit-row");
    row.type = "button";
    row.setAttribute("role", "row");
    row.dataset.orbitRow = person.id;
    if (state.selected?.id === person.id) row.setAttribute("aria-selected", "true");

    const name = el(doc, "div", "nur-orbit-row-name");
    name.append(el(doc, "strong", undefined, person.display_name));
    if (person.orbit_level_suggestion) {
      const flag = el(doc, "span", "nur-orbit-privacy", uiCopy("· suggestion"));
      flag.title = person.orbit_level_suggestion_reason ?? "";
      name.append(flag);
    }
    row.append(name);

    const band = el(doc, "div");
    const pill = el(doc, "span", "nur-orbit-band",
      person.orbit_level ? uiCopy(BAND_LABEL[person.orbit_level]) : uiCopy("Unplaced"));
    pill.dataset.band = bandOf(person);
    band.append(pill);
    row.append(band);

    row.append(el(doc, "div", undefined, person.relationship_type ?? uiCopy("Not set")));
    row.append(el(doc, "div", undefined, relativeDate(person.last_interaction_at)));
    row.append(el(doc, "div", undefined,
      person.relational_state ? orbitRelationalStateLabel(person.relational_state) : uiCopy("No move recorded")));

    const privacy = el(doc, "div");
    const mark = el(doc, "span", "nur-orbit-privacy",
      person.sharing_allowed ? uiCopy("Shareable") : uiCopy("Private only"));
    mark.dataset.shared = person.sharing_allowed ? "true" : "false";
    privacy.append(mark);
    row.append(privacy);

    row.addEventListener("click", () => actions.select("PERSON", person.id));
    list.append(row);
  }

  for (const group of state.field.groups) {
    const row = el(doc, "button", "nur-orbit-row");
    row.type = "button";
    row.setAttribute("role", "row");
    row.dataset.orbitRow = group.id;
    if (state.selected?.id === group.id) row.setAttribute("aria-selected", "true");
    const name = el(doc, "div", "nur-orbit-row-name");
    name.append(el(doc, "strong", undefined, group.name));
    name.append(el(doc, "span", "nur-orbit-privacy", uiFormat("· {0} members", [group.member_count])));
    row.append(name);
    const band = el(doc, "div");
    const pill = el(doc, "span", "nur-orbit-band", uiCopy("Group"));
    pill.dataset.band = "UNPLACED";
    band.append(pill);
    row.append(band);
    row.append(el(doc, "div", undefined, orbitGroupTypeLabel(group.group_type)));
    row.append(el(doc, "div", undefined, group.purpose ?? uiCopy("No purpose set")));
    row.append(el(doc, "div", undefined,
      group.group_nur_enabled ? uiCopy("Group NUR active") : uiCopy("Group NUR off")));
    const privacy = el(doc, "div");
    const mark = el(doc, "span", "nur-orbit-privacy", orbitPrivacyModeLabel(group.privacy_mode));
    mark.dataset.shared = group.privacy_mode === "PRIVATE_ORGANIZER" ? "false" : "true";
    privacy.append(mark);
    row.append(privacy);
    row.addEventListener("click", () => actions.select("GROUP", group.id));
    list.append(row);
  }

  surface.append(list);
  return surface;
}

// ── threads view ─────────────────────────────────────────────────────────────

function orbitThreadsView(doc: Document, state: OrbitState, actions: Actions): HTMLElement {
  const surface = el(doc, "section", "nur-orbit-field-surface");
  const list = el(doc, "div", "nur-orbit-list");

  if (state.threads.length === 0) {
    const empty = el(doc, "div", "nur-orbit-empty");
    empty.append(el(doc, "p", undefined,
      uiCopy("No relational threads yet. A thread appears when a conversation, decision or shared plan is left open with someone.")));
    const add = capsule(doc, uiCopy("✦ Add a person"), "primary");
    add.addEventListener("click", () => actions.addPerson());
    const row = el(doc, "div", "nur-orbit-empty-actions");
    row.append(add);
    empty.append(row);
    surface.append(empty);
    return surface;
  }

  const nameFor = (thread: OrbitThreadRow): string => {
    if (thread.person_id) {
      return state.field.people.find((p) => p.id === thread.person_id)?.display_name
        ?? uiCopy("Unknown person");
    }
    if (thread.group_id) {
      return state.field.groups.find((g) => g.id === thread.group_id)?.name ?? uiCopy("Unknown group");
    }
    return uiCopy("Unattributed");
  };

  for (const bucket of THREAD_GROUPS) {
    const inBucket = state.threads.filter((t) => t.status === bucket.status);
    if (inBucket.length === 0) continue;
    const section = el(doc, "section", "nur-orbit-rail-section");
    section.append(el(doc, "h2", "nur-orbit-rail-heading",
      uiFormat("{0} · {1}", [uiCopy(bucket.label), inBucket.length])));
    for (const thread of inBucket) {
      const card = el(doc, "div", "nur-orbit-item");
      card.append(el(doc, "strong", undefined, thread.topic));
      card.append(el(doc, "div", "nur-orbit-item-meta",
        uiFormat("{0} · {1}", [nameFor(thread), relativeDate(thread.last_event_at)])));
      if (thread.open_decision) {
        card.append(el(doc, "div", "nur-orbit-item-meta",
          uiFormat("Open decision: {0}", [thread.open_decision])));
      }
      if (thread.next_action) {
        card.append(el(doc, "div", "nur-orbit-item-meta", uiFormat("Next: {0}", [thread.next_action])));
      }
      section.append(card);
    }
    list.append(section);
  }
  surface.append(list);
  return surface;
}

// ── detail panel ─────────────────────────────────────────────────────────────

function orbitDetailPanel(doc: Document, state: OrbitState, actions: Actions): HTMLElement {
  const panel = el(doc, "aside", "nur-orbit-detail");
  panel.setAttribute("aria-label", uiCopy("Orbit detail"));
  panel.setAttribute("role", "region");

  if (!state.selected) {
    panel.append(el(doc, "p", "nur-orbit-detail-empty",
      uiCopy("Select a person or group to explore its Orbit.")));
    return panel;
  }

  if (state.selected.type === "GROUP") {
    const group = state.field.groups.find((g) => g.id === state.selected?.id);
    if (!group) {
      panel.append(el(doc, "p", "nur-orbit-detail-empty", uiCopy("That group is no longer here.")));
      return panel;
    }
    panel.append(el(doc, "h2", "nur-orbit-detail-name", group.name));
    panel.append(el(doc, "p", "nur-orbit-detail-meta",
      uiFormat("{0} members · {1}", [group.member_count, orbitPrivacyModeLabel(group.privacy_mode)])));
    if (group.purpose) panel.append(el(doc, "p", "nur-orbit-note", group.purpose));

    const actionsRow = el(doc, "div", "nur-orbit-actions");
    const openNur = capsule(doc, uiCopy("Open Group NUR"), "primary");
    if (!group.group_nur_enabled) {
      // Honestly disabled with the reason, rather than a button that misleads.
      openNur.disabled = true;
      openNur.title = uiCopy("Group NUR is off for this circle. It needs a shared-context privacy mode, because a shared assistant must not read context no member agreed to share.");
    } else {
      openNur.title = uiCopy("Group NUR workspace is not built yet.");
      openNur.disabled = true;
    }
    actionsRow.append(openNur);
    panel.append(actionsRow);
    panel.append(el(doc, "p", "nur-orbit-note",
      group.group_nur_enabled
        ? uiCopy("Group NUR is enabled for this circle. The shared workspace itself is not built yet.")
        : uiCopy("Enable a shared-context privacy mode to allow Group NUR.")));
    return panel;
  }

  const person = state.field.people.find((p) => p.id === state.selected?.id);
  if (!person) {
    panel.append(el(doc, "p", "nur-orbit-detail-empty", uiCopy("That person is no longer here.")));
    return panel;
  }

  panel.append(el(doc, "h2", "nur-orbit-detail-name", person.display_name));
  panel.append(el(doc, "p", "nur-orbit-detail-meta",
    [
      person.relationship_type ?? uiCopy("Relationship not set"),
      person.orbit_level ? uiFormat("{0} Orbit", [uiCopy(BAND_LABEL[person.orbit_level])]) : uiCopy("Not yet placed"),
      person.sharing_allowed ? uiCopy("Shareable") : uiCopy("Private context"),
    ].join(" · ")));

  // A pending suggestion is shown with its reason and both answers, never applied.
  if (person.orbit_level_suggestion) {
    const box = el(doc, "div", "nur-orbit-why");
    box.append(el(doc, "div", undefined,
      uiFormat("Suggested move to {0} Orbit.", [uiCopy(BAND_LABEL[person.orbit_level_suggestion])])));
    box.append(el(doc, "div", "nur-orbit-item-meta",
      person.orbit_level_suggestion_reason ?? ""));
    const row = el(doc, "div", "nur-orbit-actions");
    const accept = capsule(doc, uiCopy("Accept"), "quiet");
    accept.addEventListener(
      "click", () => actions.setBand(person.id, person.orbit_level_suggestion as OrbitBand),
    );
    const keep = capsule(doc, uiCopy("Keep as is"), "quiet");
    keep.addEventListener(
      "click", () => actions.setBand(person.id, person.orbit_level ?? "PERIPHERAL"),
    );
    row.append(accept, keep);
    box.append(row);
    panel.append(box);
  }

  const primary = el(doc, "div", "nur-orbit-actions");
  for (const [label, hint] of [
    [uiSource("Open Talk"), uiSource("Talk does not yet accept a person as context.")],
    [uiSource("Add Context"), uiSource("Linking existing context from this panel is not built yet.")],
    [uiSource("Start Plan"), uiSource("Creating a shared plan from Orbit is not built yet.")],
  ] as [UiCopyKey, UiCopyKey][]) {
    const button = capsule(doc, uiCopy(label), label === uiSource("Open Talk") ? "primary" : "default");
    button.disabled = true;
    button.title = uiCopy(hint);
    primary.append(button);
  }
  const archive = capsule(doc, uiCopy("Archive"), "destructive");
  archive.addEventListener("click", () => actions.archive(person.id));
  primary.append(archive);
  panel.append(primary);

  const tabs = el(doc, "div", "nur-orbit-tabs");
  tabs.setAttribute("role", "tablist");
  for (const [tab, label] of [
    ["overview", uiSource("Overview")], ["context", uiSource("Shared Context")], ["threads", uiSource("Threads")],
    ["plans", uiSource("Plans")], ["insights", uiSource("Insights")],
  ] as [DetailTab, UiCopyKey][]) {
    const node = el(doc, "button", "nur-orbit-tab", uiCopy(label));
    node.type = "button";
    node.setAttribute("role", "tab");
    node.setAttribute("aria-selected", state.tab === tab ? "true" : "false");
    node.dataset.orbitTab = tab;
    node.addEventListener("click", () => actions.setTab(tab));
    tabs.append(node);
  }
  panel.append(tabs);

  if (state.tab === "overview") panel.append(overviewTab(doc, state, person, actions));
  if (state.tab === "context") panel.append(contextTab(doc, state));
  if (state.tab === "threads") panel.append(threadsTab(doc, state));
  if (state.tab === "plans") panel.append(plansTab(doc));
  if (state.tab === "insights") panel.append(insightsTab(doc, state));

  return panel;
}

function overviewTab(
  doc: Document, state: OrbitState, person: OrbitPerson, actions: Actions,
): HTMLElement {
  const wrap = el(doc, "div");

  if (person.user_summary) {
    const box = el(doc, "div", "nur-orbit-item");
    box.append(el(doc, "div", undefined, person.user_summary));
    box.append(el(doc, "div", "nur-orbit-item-meta", uiCopy("Written by you")));
    wrap.append(box);
  }
  if (person.nur_summary) {
    const box = el(doc, "div", "nur-orbit-item");
    box.append(el(doc, "div", undefined, person.nur_summary));
    box.append(el(doc, "div", "nur-orbit-item-meta", uiCopy("NUR observation, not your words")));
    wrap.append(box);
  }

  for (const kind of SIGNAL_KINDS) {
    const matching = state.signals.filter((s) => s.signal_kind === kind);
    const card = el(doc, "div", "nur-orbit-signal");
    const top = el(doc, "div", "nur-orbit-signal-top");
    top.append(el(doc, "span", "nur-orbit-signal-name", orbitSignalKindLabel(kind)));
    const best = matching.find((s) => s.basis === "USER_STATED") ?? matching[0];
    top.append(el(doc, "span", "nur-orbit-signal-value",
      best?.value !== null && best?.value !== undefined ? String(best.value) : "—"));
    card.append(top);

    if (!best) {
      card.append(el(doc, "div", "nur-orbit-item-meta", uiCopy("Nothing recorded")));
      wrap.append(card);
      continue;
    }

    // Every basis present is shown. A stated reading and an inferred one are
    // different claims and neither is allowed to stand in for the other.
    for (const signal of matching) {
      const badge = el(doc, "span", "nur-orbit-basis", uiCopy(BASIS_WORD[signal.basis] ?? uiSource("Unresolved")));
      badge.dataset.basis = signal.basis;
      card.append(badge);
    }

    const why = capsule(doc, uiCopy("Why is NUR showing this?"), "quiet");
    why.dataset.orbitWhy = kind;
    why.setAttribute("aria-expanded", state.expandedWhy === kind ? "true" : "false");
    why.addEventListener("click", () => actions.toggleWhy(kind));
    card.append(why);

    if (state.expandedWhy === kind) {
      const box = el(doc, "div", "nur-orbit-why");
      for (const signal of matching) {
        const basisLabel = uiCopy(BASIS_WORD[signal.basis] ?? uiSource("Unresolved"));
        box.append(el(doc, "div", "nur-orbit-item-meta",
          signal.confidence !== null
            ? uiFormat("{0} · confidence {1}", [basisLabel, signal.confidence])
            : basisLabel));
        const evidence = signal.evidence ?? [];
        if (evidence.length) {
          const list = el(doc, "ul");
          for (const item of evidence) {
            list.append(el(doc, "li", undefined, JSON.stringify(item)));
          }
          box.append(list);
        } else if (signal.basis === "USER_STATED") {
          box.append(el(doc, "div", undefined, uiCopy("You stated this directly.")));
        }
        const against = signal.contradictory_evidence ?? [];
        if (against.length) {
          const doubt = el(doc, "div", "nur-orbit-why-doubt");
          doubt.append(el(doc, "div", undefined, uiCopy("Evidence against this reading:")));
          const list = el(doc, "ul");
          for (const item of against) list.append(el(doc, "li", undefined, JSON.stringify(item)));
          doubt.append(list);
          box.append(doubt);
        }
      }
      if (matching.some((s) => s.basis === "NUR_INFERRED")) {
        box.append(el(doc, "div", "nur-orbit-why-doubt",
          uiCopy("NUR may be overgeneralizing from a small number of interactions. Review the evidence before treating this as settled.")));
      }
      card.append(box);
    }
    wrap.append(card);
  }

  if (!person.inference_allowed) {
    wrap.append(el(doc, "p", "nur-orbit-note",
      uiCopy("Inference is off for this person, so NUR records only what you state or what activity measures. Nothing here is a guess.")));
  }
  return wrap;
}

function contextTab(doc: Document, state: OrbitState): HTMLElement {
  const wrap = el(doc, "div");
  if (state.context.length === 0) {
    wrap.append(el(doc, "p", "nur-orbit-note",
      uiCopy("No context is linked to this person yet.")));
    return wrap;
  }
  for (const link of state.context) {
    const card = el(doc, "div", "nur-orbit-item");
    card.append(el(doc, "strong", undefined, orbitContextSourceLabel(link.source_type ?? "CONTEXT")));
    if (link.link_reason) {
      card.append(el(doc, "div", undefined, String(link.link_reason)));
    }
    card.append(el(doc, "div", "nur-orbit-item-meta",
      ("" + uiFormat("{0} ·", [orbitContextVisibilityLabel(link.visibility_scope ?? "PRIVATE")]) + " ")
      + relativeDate(String(link.created_at ?? ""))));
    wrap.append(card);
  }
  return wrap;
}

function threadsTab(doc: Document, state: OrbitState): HTMLElement {
  const wrap = el(doc, "div");
  if (state.personThreads.length === 0) {
    wrap.append(el(doc, "p", "nur-orbit-note", uiCopy("No open threads with this person.")));
    return wrap;
  }
  for (const thread of state.personThreads) {
    const card = el(doc, "div", "nur-orbit-item");
    card.append(el(doc, "strong", undefined, thread.topic));
    card.append(el(doc, "div", "nur-orbit-item-meta",
      uiFormat("{0} · {1}", [orbitThreadStatusLabel(thread.status), relativeDate(thread.last_event_at)])));
    if (thread.next_action) {
      card.append(el(doc, "div", "nur-orbit-item-meta", uiFormat("Next: {0}", [thread.next_action])));
    }
    wrap.append(card);
  }
  return wrap;
}

function plansTab(doc: Document): HTMLElement {
  const wrap = el(doc, "div");
  // Declared and honest: shared plans are a real object elsewhere in NUR, but
  // nothing links a plan to a person yet, so this shows no invented progress.
  wrap.append(el(doc, "p", "nur-orbit-note",
    uiCopy("Shared plans are not linked to people yet. When a plan names a participant it will appear here with its owner, milestones and Timeline connection.")));
  return wrap;
}

function insightsTab(doc: Document, state: OrbitState): HTMLElement {
  const wrap = el(doc, "div");
  if (state.insights.length === 0) {
    wrap.append(el(doc, "p", "nur-orbit-note",
      uiCopy("No relational insights yet. NUR records one only when it can show the evidence behind it and say where it might be wrong.")));
    return wrap;
  }
  for (const insight of state.insights) {
    const card = el(doc, "div", "nur-orbit-item");
    card.append(el(doc, "strong", undefined, String(insight.observation ?? "")));
    const evidence = (insight.evidence_refs as unknown[]) ?? [];
    if (evidence.length) {
      const list = el(doc, "ul");
      for (const item of evidence) list.append(el(doc, "li", undefined, JSON.stringify(item)));
      card.append(list);
    }
    if (insight.confidence !== null && insight.confidence !== undefined) {
      card.append(el(doc, "div", "nur-orbit-item-meta", uiFormat("Confidence {0}", [insight.confidence])));
    }
    if (insight.alternative_interpretation) {
      card.append(el(doc, "div", "nur-orbit-item-meta",
        uiFormat("Alternative reading: {0}", [insight.alternative_interpretation])));
    }
    if (insight.recommended_move) {
      card.append(el(doc, "div", "nur-orbit-item-meta",
        uiFormat("Suggested move: {0}", [insight.recommended_move])));
    }
    // Always last and always present — the schema will not store an insight
    // without it, so it can be rendered unconditionally.
    card.append(el(doc, "div", "nur-orbit-why-doubt",
      uiFormat("What NUR may be wrong about: {0}", [String(insight.may_be_wrong_about ?? "")])));
    wrap.append(card);
  }
  return wrap;
}

// ── controller ───────────────────────────────────────────────────────────────

interface Actions {
  setView(view: OrbitView): void;
  setQuery(query: string): void;
  setBandFilter(band: OrbitBand | "ALL" | "GROUPS"): void;
  setSort(sort: OrbitState["sort"]): void;
  select(type: "PERSON" | "GROUP", id: string): void;
  setTab(tab: DetailTab): void;
  toggleWhy(kind: string): void;
  setBand(personId: string, band: OrbitBand): void;
  archive(personId: string): void;
  addPerson(): void;
  createGroup(): void;
}

const EMPTY_FIELD: OrbitField = {
  people: [], groups: [], relationships: [], layout: [], thread_counts: {},
};

/**
 * Render the Orbit surface for `/universe/orbits`.
 *
 * Returns false for any other route, so the caller can fall through to the
 * canonical V197 document exactly as the other adjuncts do.
 */
export async function renderV197Orbit(
  doc: Document, route: string, api: V197ApiClient,
): Promise<boolean> {
  cancelV197SearchCommit(doc, SEARCH_KEY);
  if (route !== ORBIT_ROUTE) {
    doc.body.classList.remove(BODY_CLASS);
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
    doc.body.classList.remove(BODY_CLASS);
    // No canonical viewport means no honest place to render. Falling back to a
    // full-screen overlay is exactly the behaviour this replaced.
    releaseV197SurfaceHost(doc);
    return false;
  }
  const host: HTMLElement = claimed;
  doc.body.classList.add(BODY_CLASS);

  const state: OrbitState = {
    view: doc.defaultView && doc.defaultView.innerWidth <= 900
      ? structuralValue("list")
      : structuralValue("orbit"),
    field: EMPTY_FIELD,
    threads: [],
    query: "",
    bandFilter: structuralValue("ALL"),
    selected: null,
    tab: structuralValue("overview"),
    sort: structuralValue("band"),
    signals: [],
    context: [],
    insights: [],
    personThreads: [],
    expandedWhy: null,
    error: null,
  };

  const actions: Actions = {
    setView(view) { state.view = view; paint(); },
    setQuery(query) { state.query = query; paint(); },
    setBandFilter(band) { state.bandFilter = band; paint(); },
    setSort(sort) { state.sort = sort; paint(); },
    setTab(tab) { state.tab = tab; paint(); },
    toggleWhy(kind) { state.expandedWhy = state.expandedWhy === kind ? null : kind; paint(); },
    select(type, id) {
      state.selected = { type, id };
      state.tab = "overview";
      state.expandedWhy = null;
      state.signals = [];
      state.context = [];
      state.insights = [];
      state.personThreads = [];
      paint();
      if (type === "PERSON") void loadPerson(id);
    },
    setBand(personId, band) {
      void mutate(() => api.patch(`/orbit-entities/${personId}`, { orbit_level: band }));
    },
    archive(personId) {
      void mutate(() => api.post(`/orbit-entities/${personId}/archive`, {}));
    },
    addPerson() {
      const view = doc.defaultView;
      const name = view ? view.prompt(uiCopy("Who should join your Orbit?"))?.trim() : null;
      if (!name) return;
      void mutate(() => api.post("/orbits/people", { display_name: name }));
    },
    createGroup() {
      const view = doc.defaultView;
      const name = view ? view.prompt(uiCopy("Name this circle"))?.trim() : null;
      if (!name) return;
      void mutate(() => api.post("/orbit-groups", { name }));
    },
  };

  async function mutate(run: () => Promise<unknown>): Promise<void> {
    try {
      await run();
      state.error = null;
      await loadField();
    } catch (error) {
      state.error = orbitVisibleFailure(error, uiSource("That did not work."), "mutation");
      paint();
    }
  }

  async function loadField(): Promise<void> {
    try {
      const [field, threads] = await Promise.all([
        api.get<OrbitField>("/orbit-field"),
        api.get<OrbitThreadRow[]>("/orbit-threads"),
      ]);
      state.field = field ?? EMPTY_FIELD;
      state.threads = threads ?? [];
      state.error = null;
    } catch (error) {
      state.field = EMPTY_FIELD;
      state.error = orbitVisibleFailure(error, uiSource("Orbit could not load."), "load field");
    }
    paint();
  }

  async function loadPerson(personId: string): Promise<void> {
    try {
      const [signals, context, insights, threads] = await Promise.all([
        api.get<OrbitSignal[]>(`/orbit-entities/${personId}/signals`),
        api.get<Record<string, unknown>[]>(`/orbit-entities/${personId}/context`),
        api.get<Record<string, unknown>[]>(`/orbit-entities/${personId}/insights`),
        api.get<OrbitThreadRow[]>(`/orbit-entities/${personId}/threads`),
      ]);
      state.signals = signals ?? [];
      state.context = context ?? [];
      state.insights = insights ?? [];
      state.personThreads = threads ?? [];
    } catch (error) {
      // Detail is supplementary. A failure here must not blank the field.
      console.error("[NUR Orbit] load person detail", error);
      state.signals = [];
    }
    paint();
  }

  function paint(): void {
    const searchFocus = captureV197SearchFocus(doc, SEARCH_SELECTOR);
    doc.getElementById(ROOT_ID)?.remove();
    const root = el(doc, "div");
    root.id = ROOT_ID;
    root.dataset.v197NativeAdjunct = "true";

    const shell = el(doc, "div", "nur-orbit-shell");
    shell.append(orbitHeader(doc, state, actions));

    const workspace = el(doc, "div", "nur-orbit-workspace");
    workspace.append(orbitLeftRail(doc, state, actions));
    if (state.view === "orbit") workspace.append(orbitCanvas(doc, state, actions));
    if (state.view === "list") workspace.append(orbitListView(doc, state, actions));
    if (state.view === "threads") workspace.append(orbitThreadsView(doc, state, actions));
    workspace.append(orbitDetailPanel(doc, state, actions));
    shell.append(workspace);

    if (state.error) {
      const notice = el(doc, "p", "nur-orbit-inline-error", state.error);
      notice.setAttribute("role", "status");
      shell.append(notice);
    }

    root.append(shell);
    host.append(root);
    restoreV197SearchFocus(root, SEARCH_SELECTOR, searchFocus);
  }

  paint();
  await loadField();
  return true;
}
