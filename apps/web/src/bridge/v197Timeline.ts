/**
 * Timeline — past, present and possible futures, rendered V197-native.
 *
 * Plain DOM through the bridge, not React. §58's component tree is preserved as
 * the function decomposition below (`timelineHeader`, `timelineNavigator`,
 * `timelineFlowView`, `timelineCalendarView`, `timelineHorizonsView`,
 * `timelineReviewView`, `timelineDetailPanel` and the tab renderers), because
 * the architecture law is that the canonical V197 document owns the visible
 * product and `#root` never appears on a product page.
 *
 * Everything comes from `/api/v1/timeline*`. Timeline owns no life entity of its
 * own: entries are `timeline_events` and `scheduled_actions`, both read from the
 * canonical endpoints those tables already have — an owner with an empty
 * Timeline sees Now and nothing else, never an invented event.
 *
 * The rule this file exists to protect: a drag never reschedules silently.
 * Moving a future entry always opens the ripple dialog — current time, proposed
 * time, and everything downstream that depends on it — and nothing is written
 * until the owner picks a mode. The keyboard path (the Time tab's Reschedule
 * control) goes through the exact same dialog, so neither path can drift from
 * the other's guarantee.
 */

import TIMELINE_CSS from "../styles/v197-timeline.css?raw";
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
import {
  activeUiLocale,
  type UiCopyKey,
  uiCopy,
  uiFormat,
  uiSource,
  verbatimUserText,
} from "../lib/i18n";

const ROOT_ID = "nur-timeline-root";
const STYLE_ID = "nur-timeline-style";
const SEARCH_KEY = "timeline";
const SEARCH_SELECTOR = ".nur-timeline-search";

export const TIMELINE_ROUTE = "/universe/timeline";

export type TimelineMode = "flow" | "calendar" | "horizons" | "review";

type DetailTab = "overview" | "time" | "links" | "activity" | "nur";

interface Entry {
  ref: string;
  id: string;
  kind: string;
  event_type: string;
  title: string;
  description: string | null;
  status: string;
  time_kind: string;
  date_precision: string;
  scheduled_for: string | null;
  ends_at: string | null;
  all_day: boolean;
  actual_start_at: string | null;
  actual_end_at: string | null;
  completion_state: string | null;
  occurred_at: string | null;
  system_slug: string | null;
  goal_id: string | null;
  plan_id: string | null;
  orbit_id: string | null;
  phase_id: string | null;
  visibility_scope: string;
  energy_type: string | null;
  importance: number;
  source_type: string;
  lane?: string;
}

interface Phase {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
}

interface Dependency {
  id: string;
  predecessor_ref: string;
  successor_ref: string;
  dependency_kind: string;
  lag_minutes: number;
  user_confirmed: boolean;
}

const EMPTY_FLOW = {
  now: new Date().toISOString(),
  entries: [] as Entry[],
  unscheduled: [] as Entry[],
  phases: [] as Phase[],
  dependencies: [] as Dependency[],
  counts: { total: 0, past: 0, present: 0, future: 0, unscheduled: 0 },
};

/** §5's truth states, each with a word and a glyph — never colour alone. */
const STATUS_PRESENTATION: Record<string, { word: UiCopyKey; glyph: string }> = {
  PLANNED: { word: uiSource("Planned"), glyph: "○" },
  SCHEDULED: { word: uiSource("Scheduled"), glyph: "◔" },
  IN_PROGRESS: { word: uiSource("In progress"), glyph: "◐" },
  DUE: { word: uiSource("Due"), glyph: "◑" },
  COMPLETED: { word: uiSource("Completed"), glyph: "◆" },
  PARTIALLY_COMPLETED: { word: uiSource("Partially completed"), glyph: "◒" },
  MISSED: { word: uiSource("Missed"), glyph: "△" },
  RESCHEDULED: { word: uiSource("Rescheduled"), glyph: "↻" },
  CANCELLED: { word: uiSource("Cancelled"), glyph: "×" },
  OBSERVED: { word: uiSource("Observed"), glyph: "◆" },
  PREDICTED: { word: uiSource("Predicted"), glyph: "◇" },
  INFERRED: { word: uiSource("Inferred"), glyph: "◈" },
  IMPORTED: { word: uiSource("Imported"), glyph: "⇩" },
  ARCHIVED: { word: uiSource("Archived"), glyph: "·" },
};

const HORIZON_LABEL: Record<string, UiCopyKey> = {
  NOW: uiSource("Now"),
  THIS_WEEK: uiSource("This Week"),
  THIRTY_DAYS: uiSource("30 Days"),
  NINETY_DAYS: uiSource("90 Days"),
  SIX_MONTHS: uiSource("6 Months"),
  ONE_YEAR: uiSource("1 Year"),
  SOMEDAY: uiSource("Someday"),
};

const EVENT_TYPE_WORD: Readonly<Record<string, UiCopyKey>> = {
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
  CONSULTATION_RETURN_COMPLETED: uiSource("Consultation return completed"),
  INSIGHT_REVIEW_DUE: uiSource("Insight review due"),
};

const SOURCE_TYPE_WORD: Readonly<Record<string, UiCopyKey>> = {
  OWNER: uiSource("Owner"),
  OWNER_NOTE: uiSource("Owner note"),
  PLAN_STEP: uiSource("Plan step"),
  GOAL: uiSource("Goal"),
  SCHEDULED_ACTION: uiSource("Scheduled action"),
  TIMELINE_EVENT: uiSource("Timeline event"),
  OUTCOME: uiSource("Outcome"),
  INSIGHT: uiSource("Insight"),
  FEASIBILITY: uiSource("Feasibility"),
  AGENT: uiSource("Agent"),
  ORBIT: uiSource("Orbit"),
  CONSULTATION: uiSource("Consultation"),
  PROJECT: uiSource("Project"),
  RESEARCH_SOURCE: uiSource("Research source"),
  WEB_SIGNAL: uiSource("Web signal"),
};

const DATE_PRECISION_WORD: Readonly<Record<string, UiCopyKey>> = {
  EXACT: uiSource("Exact time"),
  DATE_ONLY: uiSource("Date only"),
  WINDOW: uiSource("Time window"),
  BEFORE_DATE: uiSource("Before date"),
  AFTER_DEPENDENCY: uiSource("After dependency"),
  FLEXIBLE_WEEK: uiSource("Flexible week"),
  HORIZON: uiSource("Horizon"),
  UNSCHEDULED: uiSource("Unscheduled"),
};

const COMPLETION_STATE_WORD: Readonly<Record<string, UiCopyKey>> = {
  SUCCESSFUL: uiSource("Successful"),
  PARTIALLY_SUCCESSFUL: uiSource("Partially successful"),
  COMPLETED_BUT_INEFFECTIVE: uiSource("Completed but ineffective"),
  ABANDONED_INTENTIONALLY: uiSource("Intentionally stopped"),
  FAILED: uiSource("Failed"),
  UNKNOWN: uiSource("Not assessed"),
};

const REVIEW_TYPE_WORD: Readonly<Record<string, UiCopyKey>> = {
  DAILY: uiSource("Daily review"),
  WEEKLY: uiSource("Weekly review"),
  MONTHLY: uiSource("Monthly review"),
  PROJECT: uiSource("Project review"),
  PREDICTION: uiSource("Prediction review"),
};

const TIMELINE_ERROR_CODE_WORD: Readonly<Record<string, UiCopyKey>> = {
  CAPABILITY_DENIED: uiSource("This action is not available with the current permission."),
  CSRF_MISSING: uiSource("Your NUR session needs to be renewed."),
  SESSION_EXPIRED: uiSource("Your NUR session needs to be renewed."),
  NOT_FOUND: uiSource("That Timeline record is no longer available."),
  CONFLICT: uiSource("That Timeline record changed before NUR could save this action."),
  RATE_LIMITED: uiSource("NUR is receiving too many requests. Try again shortly."),
};

const TIMELINE_ERROR_STATUS_WORD: Readonly<Record<number, UiCopyKey>> = {
  0: uiSource("NUR could not reach the service."),
  200: uiSource("NUR returned an invalid response."),
  400: uiSource("NUR could not use that request."),
  401: uiSource("Your NUR session needs to be renewed."),
  403: uiSource("This action is not available with the current permission."),
  404: uiSource("That Timeline record is no longer available."),
  409: uiSource("That Timeline record changed before NUR could save this action."),
  422: uiSource("NUR could not use one of the submitted values."),
  429: uiSource("NUR is receiving too many requests. Try again shortly."),
  500: uiSource("NUR could not complete that Timeline request."),
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

export function timelineEventTypeLabel(value: unknown): string {
  return controlledLabel(EVENT_TYPE_WORD, value, uiSource("Event"));
}

export function timelineSourceTypeLabel(value: unknown): string {
  return controlledLabel(SOURCE_TYPE_WORD, value);
}

export function timelineDatePrecisionLabel(value: unknown): string {
  return controlledLabel(DATE_PRECISION_WORD, value);
}

export function timelineCompletionStateLabel(value: unknown): string {
  return controlledLabel(COMPLETION_STATE_WORD, value, uiSource("Not assessed"));
}

export function timelineReviewTypeLabel(value: unknown): string {
  return controlledLabel(REVIEW_TYPE_WORD, value);
}

/** Visible errors are localized classifications; raw diagnostics stay in devtools. */
export function timelineVisibleFailure(
  error: unknown,
  fallback: UiCopyKey = uiSource("NUR could not complete that Timeline request."),
  context = "request",
): string {
  console.error(`[NUR Timeline] ${context}`, error);
  const detail = typeof error === "object" && error !== null
    ? error as { code?: unknown; status?: unknown }
    : null;
  const code = controlledToken(detail?.code);
  const status = typeof detail?.status === "number" ? detail.status : null;
  const source = (code && TIMELINE_ERROR_CODE_WORD[code])
    || (status !== null && TIMELINE_ERROR_STATUS_WORD[status])
    || (status !== null && status >= 500 ? TIMELINE_ERROR_STATUS_WORD[500] : undefined)
    || fallback;
  return uiCopy(source);
}

const OBJECT_FILTERS: { key: string; label: UiCopyKey; types: string[] }[] = [
  { key: "all", label: uiSource("All"), types: [] },
  { key: "actions", label: uiSource("Actions"), types: ["ACTION"] },
  { key: "events", label: uiSource("Events"), types: ["EVENT"] },
  { key: "milestones", label: uiSource("Milestones"), types: ["GOAL_MILESTONE", "MILESTONE"] },
  { key: "decisions", label: uiSource("Decisions"), types: ["DECISION"] },
  { key: "time_blocks", label: uiSource("Time Blocks"), types: ["TIME_BLOCK"] },
];

const STATUS_FILTERS: { key: string; label: UiCopyKey; statuses: string[] }[] = [
  { key: "all", label: uiSource("All"), statuses: [] },
  { key: "active", label: uiSource("Active"), statuses: ["IN_PROGRESS", "DUE", "SCHEDULED"] },
  { key: "upcoming", label: uiSource("Upcoming"), statuses: ["PLANNED", "PREDICTED"] },
  { key: "overdue", label: uiSource("Overdue"), statuses: [] },
  { key: "completed", label: uiSource("Completed"), statuses: ["COMPLETED", "OBSERVED"] },
  { key: "rescheduled", label: uiSource("Rescheduled"), statuses: ["RESCHEDULED", "MISSED"] },
];

interface TimelineState {
  mode: TimelineMode;
  flow: typeof EMPTY_FLOW;
  horizons: Record<string, unknown> | null;
  review: Record<string, unknown> | null;
  calendar: Record<string, unknown> | null;
  smart: Record<string, unknown> | null;
  query: string;
  systemFilter: string;
  objectFilter: string;
  statusFilter: string;
  selected: string | null;
  tab: DetailTab;
  evidence: Record<string, unknown> | null;
  dependencies: { predecessors: Dependency[]; successors: Dependency[] } | null;
  rescheduleHistory: Record<string, unknown>[] | null;
  ripple: {
    entryId: string;
    entryTitle: string;
    currentStartAt: string | null;
    proposedStartAt: string;
    affected: { ref: string; title: string; proposed_start_at: string }[];
    note: string;
  } | null;
  showOutline: boolean;
  error: string | null;
  notice: string | null;
  loaded: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document, tag: K, className?: string, content?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function capsule(doc: Document, label: string, disabledReason?: string): HTMLButtonElement {
  const node = el(doc, "button", "nur-timeline-capsule", label);
  node.type = "button";
  if (disabledReason) {
    node.disabled = true;
    node.setAttribute("aria-disabled", "true");
    node.title = disabledReason;
    node.setAttribute("aria-description", disabledReason);
  }
  return node;
}

function chip(doc: Document, label: string, pressed: boolean): HTMLButtonElement {
  const node = el(doc, "button", "nur-timeline-capsule nur-timeline-capsule-sm", label);
  node.type = "button";
  node.setAttribute("aria-pressed", pressed ? "true" : "false");
  return node;
}

function field(doc: Document, label: string, value: string, unmeasured = false): HTMLElement {
  const wrap = el(doc, "div", "nur-timeline-field");
  wrap.append(el(doc, "p", "nur-timeline-field-label", label));
  const body = el(doc, "p", "nur-timeline-field-value", value);
  if (unmeasured) body.classList.add("is-unmeasured");
  wrap.append(body);
  return wrap;
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = TIMELINE_CSS;
  doc.head.append(style);
}

function text(value: unknown, fallback = uiCopy("Not recorded")): string {
  if (typeof value === "string" && value.trim()) return verbatimUserText(value);
  if (typeof value === "number") return String(value);
  return fallback;
}

export function formatV197RescheduleReason(row: {
  source?: unknown;
  reason?: unknown;
}): string {
  const source = typeof row.source === "string" ? row.source.trim().toUpperCase() : "";
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if (!reason) return uiCopy("No reason given");
  if (source === "OWNER") return verbatimUserText(reason);
  if (source === "RIPPLE") {
    const match = /^Ripple from\s+(.+)$/u.exec(reason);
    if (match?.[1]) return uiFormat("Ripple from {0}", [verbatimUserText(match[1])]);
  }
  return uiCopy("Rescheduled by a recorded dependency change.");
}

function fmt(iso: string | null): string {
  if (!iso) return uiCopy("No time set");
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(activeUiLocale(), {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function dayKey(iso: string | null): string {
  if (!iso) return "unscheduled";
  return new Date(iso).toISOString().slice(0, 10);
}

/** Past / present / future / overdue, decided from the real timestamp.
 *
 * The server sends a `lane` already, but it groups an overdue commitment with
 * ordinary history — and §60 gives overdue its own restrained Coral Flame
 * treatment, because something still owed is not the same as something finished.
 */
function laneOf(entry: Entry, nowMs: number): string {
  const settled = ["COMPLETED", "OBSERVED", "CANCELLED", "ARCHIVED"];
  if (settled.includes(entry.status)) return "past";
  if (["IN_PROGRESS", "DUE"].includes(entry.status)) return "present";
  if (!entry.scheduled_for) return "future";
  const when = new Date(entry.scheduled_for).getTime();
  if (when < nowMs) return "overdue";
  if (when <= nowMs + 86_400_000) return "present";
  return "future";
}

function dayLabel(key: string, now: Date): string {
  if (key === "unscheduled") return "";
  const date = new Date(`${key}T00:00:00Z`);
  const days = Math.round((date.getTime() - new Date(now.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return uiCopy("Today");
  if (days === 1) return uiCopy("Tomorrow");
  if (days === -1) return uiCopy("Yesterday");
  return date.toLocaleDateString(activeUiLocale(), { month: "short", day: "numeric" });
}

export async function renderV197Timeline(
  doc: Document, route: string, api: V197ApiClient,
): Promise<boolean> {
  cancelV197SearchCommit(doc, SEARCH_KEY);
  if (route !== TIMELINE_ROUTE) {
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

  const state: TimelineState = {
    mode: "flow",
    flow: EMPTY_FLOW,
    horizons: null,
    review: null,
    calendar: null,
    smart: null,
    query: "",
    systemFilter: "ALL",
    objectFilter: "all",
    statusFilter: "all",
    selected: null,
    tab: "overview",
    evidence: null,
    dependencies: null,
    rescheduleHistory: null,
    ripple: null,
    showOutline: false,
    error: null,
    notice: null,
    loaded: false,
  };

  // ── data ───────────────────────────────────────────────────────────────────

  async function loadFlow(): Promise<void> {
    try {
      state.flow = (await api.get<typeof EMPTY_FLOW>("/timeline/flow")) ?? EMPTY_FLOW;
      state.error = null;
    } catch (error) {
      // §52: a failure must not remove the whole Timeline. The last-known state
      // stays on screen and the notice is restrained.
      state.error = timelineVisibleFailure(
        error,
        uiSource("Part of the Timeline could not update."),
        "load flow",
      );
    }
    try {
      state.smart = await api.get<Record<string, unknown>>("/timeline/smart-sections");
    } catch (error) {
      console.error("[NUR Timeline] load smart sections", error);
      state.smart = null;
    }
    state.loaded = true;
    paint();
  }

  async function loadHorizons(): Promise<void> {
    try {
      state.horizons = await api.get<Record<string, unknown>>("/timeline/horizons");
    } catch (error) {
      console.error("[NUR Timeline] load horizons", error);
      state.horizons = null;
    }
    paint();
  }

  async function loadReview(): Promise<void> {
    try {
      state.review = await api.get<Record<string, unknown>>("/timeline/review");
    } catch (error) {
      console.error("[NUR Timeline] load review", error);
      state.review = null;
    }
    paint();
  }

  async function loadCalendar(): Promise<void> {
    try {
      state.calendar = await api.get<Record<string, unknown>>("/timeline/calendar?view=week");
    } catch (error) {
      console.error("[NUR Timeline] load calendar", error);
      state.calendar = null;
    }
    paint();
  }

  async function loadSelection(ref: string): Promise<void> {
    const [, id] = ref.split(":");
    try {
      if (ref.startsWith("timeline_event:")) {
        const [deps, history] = await Promise.all([
          api.get<{ predecessors: Dependency[]; successors: Dependency[] }>(
            `/timeline/entries/${id}/dependencies`,
          ),
          api.get<{ items: Record<string, unknown>[] }>(
            `/timeline/entries/${id}/reschedule-history`,
          ),
        ]);
        state.dependencies = deps ?? null;
        state.rescheduleHistory = history?.items ?? [];
      } else {
        state.dependencies = null;
        state.rescheduleHistory = [];
      }
    } catch (error) {
      console.error("[NUR Timeline] load selection detail", error);
      state.dependencies = null;
      state.rescheduleHistory = [];
    }
    paint();
  }

  async function mutate(run: () => Promise<unknown>, notice?: string): Promise<void> {
    try {
      await run();
      state.error = null;
      state.notice = notice ?? null;
      await loadFlow();
    } catch (error) {
      state.error = timelineVisibleFailure(error, uiSource("That did not work."), "mutation");
      paint();
    }
  }

  const actions = {
    setMode(mode: TimelineMode) {
      state.mode = mode;
      paint();
      if (mode === "horizons" && !state.horizons) void loadHorizons();
      if (mode === "review" && !state.review) void loadReview();
      if (mode === "calendar" && !state.calendar) void loadCalendar();
    },
    setQuery(query: string) { state.query = query; paint(); },
    setSystemFilter(slug: string) { state.systemFilter = slug; paint(); },
    setObjectFilter(key: string) { state.objectFilter = key; paint(); },
    setStatusFilter(key: string) { state.statusFilter = key; paint(); },
    setTab(tab: DetailTab) { state.tab = tab; paint(); },
    toggleOutline() { state.showOutline = !state.showOutline; paint(); },
    select(ref: string) {
      state.selected = ref;
      state.tab = "overview";
      state.dependencies = null;
      state.rescheduleHistory = null;
      paint();
      void loadSelection(ref);
    },
    jumpToToday() {
      state.mode = "flow";
      paint();
      const target = doc.getElementById("nur-timeline-now-anchor");
      target?.scrollIntoView({ block: "center" });
    },
    start(entryId: string) {
      void mutate(
        () => api.post(`/timeline/entries/${entryId}/start`, {}),
        uiCopy("Marked in progress."),
      );
    },
    complete(entryId: string) {
      void mutate(
        () => api.post(`/timeline/entries/${entryId}/complete`, {}),
        uiCopy("Completed."),
      );
    },
    miss(entryId: string) {
      void mutate(
        () => api.post(`/timeline/entries/${entryId}/miss`, {}),
        uiCopy("Marked missed."),
      );
    },
    archive(entryId: string) {
      void mutate(
        () => api.post(`/timeline/entries/${entryId}/archive`, {}),
        uiCopy("Archived."),
      );
    },
    confirmObserved(entryId: string) {
      void mutate(
        () => api.post(`/timeline/entries/${entryId}/confirm-observed`, {}),
        uiCopy("Confirmed as observed."),
      );
    },
    /** Opens the ripple dialog. Never writes anything by itself. */
    async openReschedule(entryId: string, entryTitle: string, currentStartAt: string | null, newStartAt: string): Promise<void> {
      try {
        const preview = await api.post<{
          affected: { ref: string; title: string; proposed_start_at: string }[];
          note: string;
        }>("/timeline/ripple-preview", { entry_id: entryId, new_start_at: newStartAt });
        state.ripple = {
          entryId, entryTitle, currentStartAt, proposedStartAt: newStartAt,
          affected: preview.affected, note: preview.note,
        };
        paint();
      } catch (error) {
        state.error = timelineVisibleFailure(
          error,
          uiSource("Could not preview that move."),
          "preview reschedule",
        );
        paint();
      }
    },
    cancelRipple() { state.ripple = null; paint(); },
    async applyRipple(mode: string): Promise<void> {
      if (!state.ripple) return;
      const { entryId, proposedStartAt } = state.ripple;
      state.ripple = null;
      await mutate(
        () => api.post("/timeline/ripple-apply", {
          entry_id: entryId, new_start_at: proposedStartAt, mode,
        }),
        mode === "MOVE_ONLY"
          ? uiCopy("Moved. Nothing downstream was touched.")
          : uiCopy("Moved, and downstream items were updated with a recorded reason."),
      );
    },
    /** The non-drag alternative: nudge by whole days, keyboard-reachable. */
    nudgeEntry(entry: Entry, days: number) {
      const base = entry.scheduled_for ? new Date(entry.scheduled_for) : new Date();
      base.setUTCDate(base.getUTCDate() + days);
      void actions.openReschedule(entry.id, entry.title, entry.scheduled_for, base.toISOString());
    },
  };

  // ── derived ────────────────────────────────────────────────────────────────

  function visibleEntries(): Entry[] {
    const objectFilter = OBJECT_FILTERS.find((row) => row.key === state.objectFilter);
    const statusFilter = STATUS_FILTERS.find((row) => row.key === state.statusFilter);
    const query = state.query.trim().toLowerCase();
    const now = new Date(state.flow.now).getTime();
    return state.flow.entries.filter((entry) => {
      if (objectFilter && objectFilter.types.length && !objectFilter.types.includes(entry.event_type)) {
        return false;
      }
      if (state.systemFilter !== "ALL" && entry.system_slug !== state.systemFilter) return false;
      if (statusFilter?.key === "overdue") {
        const when = entry.scheduled_for ? new Date(entry.scheduled_for).getTime() : null;
        if (!(when !== null && when < now && !["COMPLETED", "CANCELLED", "MISSED", "ARCHIVED"].includes(entry.status))) {
          return false;
        }
      } else if (statusFilter && statusFilter.statuses.length && !statusFilter.statuses.includes(entry.status)) {
        return false;
      }
      if (query && !entry.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function entryByRef(ref: string): Entry | undefined {
    return state.flow.entries.find((row) => row.ref === ref)
      ?? state.flow.unscheduled.find((row) => row.ref === ref);
  }

  // ── §58 components ─────────────────────────────────────────────────────────

  function timelineHeader(): HTMLElement {
    const header = el(doc, "header", "nur-timeline-header");

    const title = el(doc, "div", "nur-timeline-title");
    const heading = el(doc, "h1", undefined, uiCopy("Timeline"));
    markV197HolographicWordmark(heading);
    title.append(heading);
    title.append(el(doc, "p", "nur-timeline-subtitle", uiCopy("Past, present and possible futures")));
    header.append(title);

    const modes = el(doc, "div", "nur-timeline-header-actions");
    modes.setAttribute("role", "tablist");
    modes.setAttribute("aria-label", uiCopy("Timeline view mode"));
    ([
      ["flow", uiSource("Flow")], ["calendar", uiSource("Calendar")],
      ["horizons", uiSource("Horizons")], ["review", uiSource("Review")],
    ] as [TimelineMode, UiCopyKey][]).forEach(([mode, label]) => {
      const button = chip(doc, uiCopy(label), state.mode === mode);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", state.mode === mode ? "true" : "false");
      button.dataset.timelineMode = mode;
      button.addEventListener("click", () => actions.setMode(mode));
      modes.append(button);
    });
    header.append(modes);

    const tools = el(doc, "div", "nur-timeline-header-actions");
    const jump = capsule(doc, uiCopy("Jump to Today"));
    jump.dataset.timelineJumpToday = "true";
    jump.addEventListener("click", () => actions.jumpToToday());
    tools.append(jump);
    const search = el(doc, "input", "nur-timeline-search");
    search.type = "search";
    search.placeholder = uiCopy("Search events, actions, milestones or memories");
    search.value = state.query;
    search.setAttribute("aria-label", uiCopy("Search the Timeline"));
    search.style.width = "220px";
    search.addEventListener("input", () => {
      scheduleV197SearchCommit(doc, SEARCH_KEY, search.value, actions.setQuery);
    });
    tools.append(search);
    tools.append(capsule(
      doc, uiCopy("Add"),
      uiCopy("Not built yet as a guided flow. The creation endpoint (POST /timeline/events) is live and tested; the celestial action menu is not."),
    ));
    tools.append(capsule(
      doc, uiCopy("Ask NUR to Schedule"),
      uiCopy("Not built. There is no model provider connected in this deployment, so Timeline never proposes a schedule it did not read from your own rows."),
    ));
    header.append(tools);
    return header;
  }

  function timelineNavigator(): HTMLElement {
    const pane = el(doc, "aside", "nur-timeline-pane nur-timeline-nav");
    pane.setAttribute("aria-label", uiCopy("Time navigator"));
    const scroll = el(doc, "div", "nur-timeline-pane-scroll");

    const modeGroup = el(doc, "div", "nur-timeline-nav-group");
    modeGroup.append(el(doc, "p", "nur-timeline-nav-label", uiCopy("Objects")));
    const objectChips = el(doc, "div", "nur-timeline-chips");
    for (const row of OBJECT_FILTERS) {
      const button = chip(doc, uiCopy(row.label), state.objectFilter === row.key);
      button.addEventListener("click", () => actions.setObjectFilter(row.key));
      objectChips.append(button);
    }
    modeGroup.append(objectChips);
    scroll.append(modeGroup);

    const statusGroup = el(doc, "div", "nur-timeline-nav-group");
    statusGroup.append(el(doc, "p", "nur-timeline-nav-label", uiCopy("Status")));
    const statusChips = el(doc, "div", "nur-timeline-chips");
    for (const row of STATUS_FILTERS) {
      const button = chip(doc, uiCopy(row.label), state.statusFilter === row.key);
      button.addEventListener("click", () => actions.setStatusFilter(row.key));
      statusChips.append(button);
    }
    statusGroup.append(statusChips);
    scroll.append(statusGroup);

    const sections: [string, UiCopyKey][] = [
      ["now", uiSource("Now")], ["next", uiSource("Next")], ["overdue", uiSource("Overdue")],
      ["awaiting_dependency", uiSource("Awaiting Dependency")], ["needs_review", uiSource("Needs Review")],
      ["unscheduled", uiSource("Unscheduled")], ["repeating", uiSource("Repeating")],
    ];
    for (const [key, label] of sections) {
      const rows = (state.smart?.[key] as { ref: string; label: string }[] | undefined) ?? [];
      const group = el(doc, "div", "nur-timeline-nav-group");
      group.dataset.timelineSection = key;
      group.append(el(doc, "p", "nur-timeline-nav-label", uiCopy(label)));
      if (!rows.length) {
        group.append(el(doc, "p", "nur-timeline-empty", uiCopy("Nothing here yet.")));
      } else {
        const list = el(doc, "ul", "nur-timeline-nav-list");
        for (const row of rows.slice(0, 6)) {
          const item = el(doc, "li");
          const button = el(doc, "button", "nur-timeline-row");
          button.type = "button";
          if (state.selected === row.ref) button.classList.add("is-selected");
          button.append(el(doc, "span", undefined, "◦"));
          button.append(el(doc, "span", "nur-timeline-row-label", row.label));
          button.append(el(doc, "span", "nur-timeline-row-meta", ""));
          button.addEventListener("click", () => actions.select(row.ref));
          item.append(button);
          list.append(item);
        }
        group.append(list);
      }
      scroll.append(group);
    }

    pane.append(scroll);
    return pane;
  }

  function truthBadge(entry: Entry): string {
    const presentation = STATUS_PRESENTATION[entry.status] ?? { word: uiSource("Unclear"), glyph: "○" };
    return uiFormat("{0} {1}", [presentation.glyph, uiCopy(presentation.word)]);
  }

  function entryRow(entry: Entry, lane: string, branchIndex: number | null = null): HTMLElement {
    const row = el(doc, "div", `nur-timeline-entry is-${lane}`);
    row.dataset.timelineEntry = entry.ref;
    row.dataset.timelineLane = lane;
    if (branchIndex !== null) {
      row.dataset.timelineBranch = branchIndex % 2 === 0 ? "left" : "right";
      row.classList.add(branchIndex % 2 === 0 ? "is-branch-left" : "is-branch-right");
    }
    row.setAttribute("tabindex", "0");
    row.setAttribute("role", "button");
    if (state.selected === entry.ref) row.classList.add("is-selected");

    row.append(el(doc, "span", "nur-timeline-entry-glyph", truthBadge(entry).split(" ")[0]));
    const body = el(doc, "div", "nur-timeline-entry-body");
    body.append(el(doc, "p", "nur-timeline-entry-title", entry.title));
    body.append(el(
      doc, "p", "nur-timeline-entry-meta",
      uiFormat("{0} · {1}", [fmt(entry.scheduled_for), uiCopy(STATUS_PRESENTATION[entry.status]?.word ?? uiSource("Unclear"))]),
    ));
    row.append(body);

    row.addEventListener("click", () => actions.select(entry.ref));
    row.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Enter" || key === " ") {
        event.preventDefault();
        actions.select(entry.ref);
      } else if (lane === "future" && (key === "ArrowUp" || key === "ArrowDown")) {
        event.preventDefault();
        actions.nudgeEntry(entry, key === "ArrowDown" ? 1 : -1);
      }
    });

    // Drag to reschedule: only future entries are draggable, and the gesture
    // always ends at the ripple dialog — never a silent write.
    if (lane === "future") {
      let dragging = false;
      let moved = false;
      let originY = 0;
      row.addEventListener("pointerdown", (event) => {
        const pointer = event as PointerEvent;
        if (pointer.button !== 0) return;
        dragging = true;
        moved = false;
        originY = pointer.clientY;
        row.setPointerCapture(pointer.pointerId);
      });
      row.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const dy = (event as PointerEvent).clientY - originY;
        if (!moved && Math.abs(dy) < 6) return;
        moved = true;
        row.classList.add("is-dragging");
      });
      row.addEventListener("pointerup", (event) => {
        if (!dragging) return;
        dragging = false;
        row.classList.remove("is-dragging");
        const pointer = event as PointerEvent;
        if (row.hasPointerCapture?.(pointer.pointerId)) {
          row.releasePointerCapture(pointer.pointerId);
        }
        if (!moved) return;
        // Each ~28px of vertical drag proposes one day of movement — a coarse,
        // legible mapping rather than sub-minute pixel physics.
        const dy = pointer.clientY - originY;
        const proposedDays = Math.round(dy / 28);
        if (proposedDays === 0) return;
        actions.nudgeEntry(entry, proposedDays);
      });
    }

    return row;
  }

  function timelineFlowView(): HTMLElement {
    const pane = el(doc, "section", "nur-timeline-pane nur-timeline-workspace");
    pane.setAttribute("aria-label", uiCopy("Living Timeline"));
    const wrap = el(doc, "div", "nur-timeline-flow-wrap");

    if (!state.loaded) {
      const loading = el(doc, "div", "nur-timeline-pane-scroll");
      loading.dataset.timelineLoading = "true";
      loading.append(el(doc, "p", "nur-timeline-empty", uiCopy("Assembling your history and horizon…")));
      wrap.append(loading);
      pane.append(wrap);
      return pane;
    }

    const entries = visibleEntries();
    if (!entries.length && !state.flow.unscheduled.length) {
      const empty = el(doc, "div", "nur-timeline-pane-scroll");
      empty.dataset.timelineEmpty = "true";
      empty.append(el(doc, "h2", "nur-timeline-detail-title", uiCopy("Your Timeline begins where memory meets intention.")));
      empty.append(el(
        doc, "p", "nur-timeline-empty",
        uiCopy("Nothing has been recorded yet. Once something is scheduled or logged, it appears here in its place in time."),
      ));
      wrap.append(empty);
      pane.append(wrap);
      return pane;
    }

    const scroll = el(doc, "div", "nur-timeline-flow-scroll");
    const spine = el(doc, "div", "nur-timeline-spine");
    const now = new Date(state.flow.now);

    const nowMs = now.getTime();
    const nowHorizon = (): HTMLElement => {
      const horizon = el(doc, "div", "nur-timeline-now-horizon");
      horizon.id = "nur-timeline-now-anchor";
      horizon.dataset.timelineNow = "true";
      horizon.append(el(doc, "span", "nur-timeline-now-sigil"));
      horizon.append(el(
        doc, "span", "nur-timeline-now-label",
        now.toLocaleString(activeUiLocale(), {
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        }),
      ));
      return horizon;
    };

    // The horizon goes exactly where the present is, by timestamp — not before
    // whichever day contains it. Placing it at day granularity put a line
    // labelled "2:49 PM" above an entry timed 12:49 PM, so the page contradicted
    // its own label.
    const sorted = entries.slice().sort((a, b) => {
      const left = a.scheduled_for ? new Date(a.scheduled_for).getTime() : nowMs;
      const right = b.scheduled_for ? new Date(b.scheduled_for).getTime() : nowMs;
      return left - right;
    });
    let insertedNow = false;
    let currentKey: string | null = null;
    let group: HTMLElement | null = null;
    let branchIndex = 0;

    for (const entry of sorted) {
      const when = entry.scheduled_for ? new Date(entry.scheduled_for).getTime() : nowMs;
      if (!insertedNow && when > nowMs) {
        spine.append(nowHorizon());
        insertedNow = true;
        // Force a fresh day group so the horizon is not visually trapped inside
        // the previous group's box.
        currentKey = null;
      }
      const key = dayKey(entry.scheduled_for);
      if (key !== currentKey || group === null) {
        group = el(doc, "div", "nur-timeline-day-group");
        group.append(el(doc, "p", "nur-timeline-day-label", dayLabel(key, now)));
        spine.append(group);
        currentKey = key;
      }
      group.append(entryRow(entry, laneOf(entry, nowMs), branchIndex));
      branchIndex += 1;
    }
    if (!insertedNow) spine.append(nowHorizon());

    scroll.append(spine);

    if (state.flow.unscheduled.length) {
      const holding = el(doc, "div", "nur-timeline-unscheduled");
      holding.dataset.timelineUnscheduled = "true";
      holding.append(el(doc, "p", "nur-timeline-nav-label", uiCopy("Unscheduled")));
      for (const entry of state.flow.unscheduled) {
        holding.append(entryRow(entry, "future"));
      }
      scroll.append(holding);
    }

    wrap.append(scroll);

    const controls = el(doc, "div", "nur-timeline-canvas-controls");
    const outline = chip(doc, uiCopy("Outline"), state.showOutline);
    outline.dataset.timelineOutlineToggle = "true";
    outline.addEventListener("click", () => actions.toggleOutline());
    controls.append(outline);
    wrap.append(controls);

    if (state.showOutline) wrap.append(timelineAccessibilityOutline(entries));
    if (state.ripple) wrap.append(rippleDialog());

    pane.append(wrap);
    return pane;
  }

  function timelineAccessibilityOutline(entries: Entry[]): HTMLElement {
    const box = el(doc, "div", "nur-timeline-pane-scroll");
    box.dataset.timelineOutline = "true";
    box.style.position = "absolute";
    box.style.inset = "0";
    box.style.background = "rgba(0,0,0,0.94)";
    box.append(el(doc, "p", "nur-timeline-nav-label", uiCopy("Timeline outline")));
    const list = el(doc, "ul", "nur-timeline-outline");
    for (const entry of entries) {
      const item = el(doc, "li");
      const button = el(doc, "button", "nur-timeline-row");
      button.type = "button";
      const presentation = STATUS_PRESENTATION[entry.status] ?? { word: uiSource("Unclear") };
      const summary = uiFormat("{0}. {1}. Due {2}. {3}.", [
        entry.title,
        timelineEventTypeLabel(entry.event_type),
        fmt(entry.scheduled_for),
        uiCopy(presentation.word),
      ]);
      button.setAttribute("aria-label", summary);
      button.append(el(doc, "span", undefined, "·"));
      button.append(el(doc, "span", "nur-timeline-row-label", entry.title));
      button.append(el(doc, "span", "nur-timeline-row-meta", uiCopy(presentation.word)));
      button.addEventListener("click", () => actions.select(entry.ref));
      item.append(button);
      list.append(item);
    }
    box.append(list);
    const close = capsule(doc, uiCopy("Close outline"));
    close.addEventListener("click", () => actions.toggleOutline());
    box.append(close);
    return box;
  }

  function rippleDialog(): HTMLElement {
    const dialog = el(doc, "div", "nur-timeline-ripple-dialog");
    dialog.dataset.timelineRippleDialog = "true";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const card = el(doc, "div", "nur-timeline-ripple-card");
    card.append(el(doc, "h2", "nur-timeline-ripple-title", uiFormat("Move \"{0}\"?", [state.ripple!.entryTitle])));
    card.append(el(
      doc, "p", "nur-timeline-ripple-move",
      uiFormat("From {0} to {1}.", [fmt(state.ripple!.currentStartAt), fmt(state.ripple!.proposedStartAt)]),
    ));
    card.append(el(doc, "p", "nur-timeline-ripple-move", state.ripple!.note));

    if (state.ripple!.affected.length) {
      const list = el(doc, "ul", "nur-timeline-ripple-affected");
      for (const item of state.ripple!.affected) {
        list.append(el(doc, "li", undefined, uiFormat("{0} → {1}", [item.title, fmt(item.proposed_start_at)])));
      }
      card.append(list);
    }

    const actionsBox = el(doc, "div", "nur-timeline-ripple-actions");
    const moveOnly = capsule(doc, uiCopy("Move this only"));
    moveOnly.dataset.timelineRippleMode = "MOVE_ONLY";
    moveOnly.addEventListener("click", () => void actions.applyRipple("MOVE_ONLY"));
    actionsBox.append(moveOnly);
    if (state.ripple!.affected.length) {
      const shift = capsule(doc, uiCopy("Shift dependent actions"));
      shift.dataset.timelineRippleMode = "SHIFT_DEPENDENTS";
      shift.addEventListener("click", () => void actions.applyRipple("SHIFT_DEPENDENTS"));
      actionsBox.append(shift);
      const compress = capsule(doc, uiCopy("Compress later work"));
      compress.dataset.timelineRippleMode = "COMPRESS_LATER";
      compress.addEventListener("click", () => void actions.applyRipple("COMPRESS_LATER"));
      actionsBox.append(compress);
      const flag = capsule(doc, uiCopy("Keep dates and flag risk"));
      flag.dataset.timelineRippleMode = "KEEP_AND_FLAG";
      flag.addEventListener("click", () => void actions.applyRipple("KEEP_AND_FLAG"));
      actionsBox.append(flag);
    }
    const cancel = capsule(doc, uiCopy("Cancel"));
    cancel.dataset.timelineRippleCancel = "true";
    cancel.addEventListener("click", () => actions.cancelRipple());
    actionsBox.append(cancel);
    card.append(actionsBox);
    dialog.append(card);
    return dialog;
  }

  function timelineCalendarView(): HTMLElement {
    const pane = el(doc, "section", "nur-timeline-pane nur-timeline-workspace");
    const scroll = el(doc, "div", "nur-timeline-pane-scroll");
    scroll.dataset.timelineCalendar = "true";
    scroll.append(el(doc, "p", "nur-timeline-detail-kind", uiCopy("Calendar · This week")));

    const entries = (state.calendar?.entries as Entry[] | undefined) ?? [];
    if (!entries.length) {
      scroll.append(el(doc, "p", "nur-timeline-empty", uiCopy("Nothing exact-timed this week.")));
      pane.append(scroll);
      return pane;
    }
    const groups = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = dayKey(entry.scheduled_for);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    for (const [key, rows] of Array.from(groups.entries()).sort()) {
      const day = el(doc, "div", "nur-timeline-calendar-day");
      day.append(el(doc, "p", "nur-timeline-calendar-date", dayLabel(key, new Date())));
      for (const entry of rows) day.append(entryRow(entry, entry.lane ?? "future"));
      scroll.append(day);
    }
    scroll.append(el(
      doc, "p", "nur-timeline-empty",
      uiCopy("A grouped agenda, not a pixel-grid calendar — the exact-time scheduling surface, simplified deliberately."),
    ));
    pane.append(scroll);
    return pane;
  }

  function timelineHorizonsView(): HTMLElement {
    const pane = el(doc, "section", "nur-timeline-pane nur-timeline-workspace");
    const scroll = el(doc, "div", "nur-timeline-pane-scroll");
    scroll.dataset.timelineHorizons = "true";
    scroll.append(el(doc, "p", "nur-timeline-detail-kind", uiCopy("Horizons")));

    if (!state.horizons) {
      scroll.append(el(doc, "p", "nur-timeline-empty", uiCopy("Loading horizons…")));
      pane.append(scroll);
      return pane;
    }

    const buckets = state.horizons.buckets as Record<string, { ref: string; label: string }[]>;
    const grid = el(doc, "div", "nur-timeline-horizons");
    for (const key of ["NOW", "THIS_WEEK", "THIRTY_DAYS", "NINETY_DAYS", "SIX_MONTHS", "ONE_YEAR", "SOMEDAY"]) {
      const col = el(doc, "div", "nur-timeline-horizon-col");
      col.dataset.timelineHorizonBucket = key;
      col.append(el(doc, "p", "nur-timeline-horizon-label", uiCopy(HORIZON_LABEL[key] ?? uiSource("Someday"))));
      const rows = buckets[key] ?? [];
      if (!rows.length) {
        col.append(el(doc, "p", "nur-timeline-empty", uiCopy("Nothing here.")));
      } else {
        for (const row of rows) {
          const item = el(doc, "div", "nur-timeline-horizon-item", row.label);
          item.addEventListener("click", () => actions.select(row.ref));
          col.append(item);
        }
      }
      grid.append(col);
    }
    scroll.append(grid);

    const drift = (state.horizons.drift as { ref: string; reschedule_count: number }[] | undefined) ?? [];
    if (drift.length) {
      const banner = el(doc, "div", "nur-timeline-drift");
      banner.dataset.timelineDrift = "true";
      banner.textContent = drift.length === 1
        ? uiFormat("{0} item moved outward more than once — worth a look, not a judgement.", [drift.length])
        : uiFormat("{0} items moved outward more than once — worth a look, not a judgement.", [drift.length]);
      scroll.append(banner);
    }
    pane.append(scroll);
    return pane;
  }

  function timelineReviewView(): HTMLElement {
    const pane = el(doc, "section", "nur-timeline-pane nur-timeline-workspace");
    const scroll = el(doc, "div", "nur-timeline-pane-scroll");
    scroll.dataset.timelineReview = "true";
    scroll.append(el(doc, "p", "nur-timeline-detail-kind", uiCopy("Review")));

    if (!state.review) {
      scroll.append(el(doc, "p", "nur-timeline-empty", uiCopy("Loading this week's comparison…")));
      pane.append(scroll);
      return pane;
    }

    const findings = state.review.live_findings as Record<string, unknown>;
    scroll.append(el(doc, "h2", "nur-timeline-detail-title", uiCopy("This week: planned versus actual")));

    const grid = el(doc, "div", "nur-timeline-review-grid");
    const stat = (label: string, value: string) => {
      const box = el(doc, "div", "nur-timeline-stat");
      box.append(el(doc, "p", "nur-timeline-stat-label", label));
      box.append(el(doc, "p", "nur-timeline-stat-value", value));
      grid.append(box);
    };
    stat(uiCopy("Entries"), String(findings.period_entry_count ?? 0));
    stat(uiCopy("Completed"), String(findings.completed_count ?? 0));
    stat(uiCopy("Missed"), String(findings.missed_count ?? 0));
    stat(uiCopy("Rescheduled"), String(findings.reschedule_count ?? 0));
    scroll.append(grid);

    const distribution = findings.system_time_distribution as Record<string, string> | undefined;
    if (distribution && Object.keys(distribution).length) {
      scroll.append(field(
        doc, uiCopy("System time distribution"),
        Object.entries(distribution).map(([slug, pct]) => `${slug}: ${pct}`).join(" · "),
      ));
    }

    const generate = capsule(doc, uiCopy("Generate this week's review"));
    generate.dataset.timelineGenerateReview = "true";
    generate.addEventListener("click", () => {
      const now = new Date();
      const start = new Date(now.getTime() - 7 * 86_400_000);
      void mutate(() => api.post("/timeline/reviews/generate", {
        review_type: "WEEKLY", period_start: start.toISOString(), period_end: now.toISOString(),
      }), uiCopy("Review generated from your own recorded rows."));
      void loadReview();
    });
    scroll.append(generate);

    const recent = (state.review.recent_reviews as Record<string, unknown>[] | undefined) ?? [];
    if (recent.length) {
      scroll.append(el(doc, "p", "nur-timeline-nav-label", uiCopy("Recent reviews")));
      for (const row of recent) {
        const card = el(doc, "div", "nur-timeline-card");
        card.append(el(doc, "p", "nur-timeline-field-value", timelineReviewTypeLabel(row.review_type)));
        card.append(el(doc, "p", "nur-timeline-row-meta", text(row.summary, uiCopy("Computed, not written"))));
        scroll.append(card);
      }
    }

    scroll.append(el(
      doc, "p", "nur-timeline-empty",
      uiCopy("Deterministic — computed from your own recorded timestamps, no model consulted."),
    ));
    pane.append(scroll);
    return pane;
  }

  function timelineDetailPanel(): HTMLElement {
    const pane = el(doc, "aside", "nur-timeline-pane nur-timeline-detail");
    pane.setAttribute("aria-label", uiCopy("Selection detail"));
    const scroll = el(doc, "div", "nur-timeline-pane-scroll");

    const entry = state.selected ? entryByRef(state.selected) : undefined;
    if (!entry) {
      scroll.append(el(doc, "p", "nur-timeline-detail-kind", uiCopy("Nothing selected")));
      scroll.append(el(
        doc, "p", "nur-timeline-empty",
        uiCopy("Select something in time to explore its meaning, dependencies and outcome."),
      ));
      pane.append(scroll);
      return pane;
    }

    const header = el(doc, "div", "nur-timeline-detail-header");
    header.append(el(doc, "p", "nur-timeline-detail-kind", uiFormat("{0} · {1}", [
      timelineEventTypeLabel(entry.event_type),
      truthBadge(entry),
    ])));
    header.append(el(doc, "h2", "nur-timeline-detail-title", entry.title));
    scroll.append(header);

    const tabs = el(doc, "div", "nur-timeline-tabs");
    tabs.setAttribute("role", "tablist");
    ([
      ["overview", uiSource("Overview")], ["time", uiSource("Time")], ["links", uiSource("Links")],
      ["activity", uiSource("Activity")], ["nur", uiSource("NUR View")],
    ] as [DetailTab, UiCopyKey][]).forEach(([tab, label]) => {
      const button = el(doc, "button", "nur-timeline-tab", uiCopy(label));
      button.type = "button";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", state.tab === tab ? "true" : "false");
      button.dataset.timelineTab = tab;
      button.addEventListener("click", () => actions.setTab(tab));
      tabs.append(button);
    });
    scroll.append(tabs);

    const body = el(doc, "div");
    body.dataset.timelineTabPanel = state.tab;
    body.setAttribute("role", "tabpanel");
    if (state.tab === "overview") overviewTab(body, entry);
    if (state.tab === "time") timeTab(body, entry);
    if (state.tab === "links") linksTab(body, entry);
    if (state.tab === "activity") activityTab(body);
    if (state.tab === "nur") nurViewTab(body, entry);
    scroll.append(body);

    pane.append(scroll);
    return pane;
  }

  function overviewTab(into: HTMLElement, entry: Entry): void {
    into.append(field(doc, uiCopy("Description"), text(entry.description, uiCopy("None recorded")), !entry.description));
    into.append(field(doc, uiCopy("System"), text(entry.system_slug, uiCopy("Not linked")), !entry.system_slug));
    into.append(field(doc, uiCopy("Priority"), uiFormat("{0}/100", [entry.importance])));
    into.append(field(doc, uiCopy("Source"), timelineSourceTypeLabel(entry.source_type)));

    const row = el(doc, "div", "nur-timeline-nav-group");
    const controls = el(doc, "div", "nur-timeline-chips");
    if (entry.kind === "timeline_event") {
      if (["PLANNED", "SCHEDULED"].includes(entry.status)) {
        const start = capsule(doc, uiCopy("Start"));
        start.addEventListener("click", () => actions.start(entry.id));
        controls.append(start);
      }
      if (!["COMPLETED", "CANCELLED", "ARCHIVED"].includes(entry.status)) {
        const complete = capsule(doc, uiCopy("Complete"));
        complete.addEventListener("click", () => actions.complete(entry.id));
        controls.append(complete);
        const miss = capsule(doc, uiCopy("Mark missed"));
        miss.addEventListener("click", () => actions.miss(entry.id));
        controls.append(miss);
      }
      if (["PREDICTED", "INFERRED", "IMPORTED"].includes(entry.status)) {
        const confirm = capsule(doc, uiCopy("Confirm observed"));
        confirm.addEventListener("click", () => actions.confirmObserved(entry.id));
        controls.append(confirm);
      }
      const archive = capsule(doc, uiCopy("Archive"));
      archive.addEventListener("click", () => actions.archive(entry.id));
      controls.append(archive);
    }
    row.append(controls);
    into.append(row);
  }

  function timeTab(into: HTMLElement, entry: Entry): void {
    into.append(field(doc, uiCopy("Precision"), timelineDatePrecisionLabel(entry.date_precision)));
    into.append(field(doc, uiCopy("Planned"), fmt(entry.scheduled_for)));
    into.append(field(doc, uiCopy("Ends"), fmt(entry.ends_at), !entry.ends_at));
    into.append(field(doc, uiCopy("Actual start"), fmt(entry.actual_start_at), !entry.actual_start_at));
    into.append(field(doc, uiCopy("Actual end"), fmt(entry.actual_end_at), !entry.actual_end_at));
    into.append(field(
      doc, uiCopy("Completion quality"),
      timelineCompletionStateLabel(entry.completion_state), !entry.completion_state,
    ));

    if (entry.kind === "timeline_event" && entry.scheduled_for) {
      const reschedule = capsule(doc, uiCopy("Reschedule"));
      reschedule.dataset.timelineReschedule = "true";
      reschedule.addEventListener("click", () => {
        // The keyboard/pointer-free path: proposes one day forward, opening the
        // exact same ripple dialog a drag would.
        void actions.openReschedule(
          entry.id, entry.title, entry.scheduled_for,
          new Date(new Date(entry.scheduled_for!).getTime() + 86_400_000).toISOString(),
        );
      });
      into.append(reschedule);
    }

    const history = state.rescheduleHistory ?? [];
    if (history.length) {
      into.append(el(doc, "p", "nur-timeline-nav-label", uiCopy("Reschedule history")));
      for (const row of history) {
        const card = el(doc, "div", "nur-timeline-card");
        card.append(el(
          doc, "p", "nur-timeline-field-value",
          uiFormat("{0} → {1}", [fmt(row.previous_start_at as string | null), fmt(row.new_start_at as string | null)]),
        ));
        card.append(el(doc, "p", "nur-timeline-row-meta", formatV197RescheduleReason(row)));
        into.append(card);
      }
    }
  }

  function linksTab(into: HTMLElement, entry: Entry): void {
    into.append(field(doc, uiCopy("Goal"), entry.goal_id ? entry.goal_id : uiCopy("None"), !entry.goal_id));
    into.append(field(doc, uiCopy("Plan"), entry.plan_id ? entry.plan_id : uiCopy("None"), !entry.plan_id));
    into.append(field(doc, uiCopy("Orbit"), entry.orbit_id ? entry.orbit_id : uiCopy("None"), !entry.orbit_id));

    const deps = state.dependencies;
    into.append(field(
      doc, uiCopy("Depends on"),
      deps?.predecessors.length
        ? deps.predecessors.map((row) => row.predecessor_ref).join(" · ")
        : uiCopy("Nothing recorded"),
      !deps?.predecessors.length,
    ));
    into.append(field(
      doc, uiCopy("Blocks"),
      deps?.successors.length
        ? deps.successors.map((row) => row.successor_ref).join(" · ")
        : uiCopy("Nothing recorded"),
      !deps?.successors.length,
    ));

    const row = el(doc, "div", "nur-timeline-chips");
    row.append(capsule(
      doc, uiCopy("Open on Map"),
      uiCopy("Not built yet as an in-panel jump. The object exists on Map through the same dependency edges shown here."),
    ));
    into.append(row);
  }

  function activityTab(into: HTMLElement): void {
    into.append(el(
      doc, "p", "nur-timeline-empty",
      uiCopy("Activity for this entry is not yet composed into one feed here; its reschedule history is on the Time tab."),
    ));
  }

  function nurViewTab(into: HTMLElement, entry: Entry): void {
    const doubt = el(doc, "div", "nur-timeline-doubt");
    doubt.dataset.timelineDoubt = "true";
    doubt.append(el(doc, "p", "nur-timeline-doubt-label", uiCopy("What NUR may be wrong about")));
    doubt.append(el(
      doc, "p", "nur-timeline-field-value",
      entry.status === "PREDICTED"
        ? uiCopy("This is a prediction, not a confirmed fact. NUR only sees what you have recorded, and a horizon passing quietly is not the same as it happening.")
        : uiFormat("NUR reads this {0} only from what has been recorded. Anything you have not written down is invisible here, so its urgency or importance may be more confident than the evidence deserves.", [timelineEventTypeLabel(entry.event_type)]),
    ));
    into.append(doubt);
  }

  // ── paint ──────────────────────────────────────────────────────────────────

  function paint(): void {
    const searchFocus = captureV197SearchFocus(doc, SEARCH_SELECTOR);
    doc.getElementById(ROOT_ID)?.remove();
    const root = el(doc, "div");
    root.id = ROOT_ID;
    root.dataset.v197NativeAdjunct = "true";
    root.dataset.timelineLoaded = state.loaded ? "true" : "false";

    const shell = el(doc, "div", "nur-timeline-shell");
    if (isMobile && state.selected) shell.classList.add("is-mobile-detail");
    shell.append(timelineHeader());

    if (state.error) {
      const banner = el(doc, "div", "nur-timeline-banner");
      banner.dataset.timelineError = "true";
      banner.textContent = state.error;
      const retry = capsule(doc, uiCopy("Retry"));
      retry.classList.add("nur-timeline-capsule-sm");
      retry.addEventListener("click", () => { void loadFlow(); });
      banner.append(doc.createTextNode(" "));
      banner.append(retry);
      shell.append(banner);
    } else if (state.notice) {
      const banner = el(doc, "div", "nur-timeline-banner is-notice");
      banner.textContent = state.notice;
      shell.append(banner);
    }

    const zones = el(doc, "div", "nur-timeline-zones");
    zones.append(timelineNavigator());
    if (state.mode === "calendar") zones.append(timelineCalendarView());
    else if (state.mode === "horizons") zones.append(timelineHorizonsView());
    else if (state.mode === "review") zones.append(timelineReviewView());
    else zones.append(timelineFlowView());
    zones.append(timelineDetailPanel());
    shell.append(zones);

    root.append(shell);
    root.append(createV197StarSeal(doc));
    host.append(root);
    restoreV197SearchFocus(root, SEARCH_SELECTOR, searchFocus);
  }

  paint();
  await loadFlow();
  return true;
}
