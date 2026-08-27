import type {
  V197BridgeSnapshot,
  V197InsightDetail,
  V197InsightEvidenceResponse,
  V197InsightWhyChanged,
  V197MapNode,
  V197Plan,
  V197PlanStep,
  V197SystemSnapshot,
  V197TalkThreadRow,
} from "./v197ApiClient";
import { applyV197Locale } from "./v197I18n";
import { hydrateReadOnlyV197 } from "./v197Mutations";
import { renderPersistedGlow } from "./v197Rewards";
import {
  v197SystemDefinition,
  v197SystemNextMove,
  v197SystemPrediction,
  v197SystemProgressFormula,
  v197SystemQuestion,
  v197SystemTitle,
} from "./v197SystemCopy";
import {
  activeUiLocale,
  markVerbatimUserContent,
  setVerbatimUserText,
  uiCopy,
  uiFormat,
  uiSource,
  type UiCopyKey,
} from "../lib/i18n";

/**
 * The six Star Systems, in canonical order. This must match
 * `apps/api/app/living/catalog.py`; a mismatch silently drops or duplicates
 * System slots because the mapping is by title.
 */
const CORE_SYSTEMS = [
  "Ambition",
  "Rebuild",
  "Creation",
  "Growth",
  "Introspection",
  "Connection",
] as const;
type CoreSystemTitle = typeof CORE_SYSTEMS[number];
const NO_RELIABLE_INSIGHT = uiSource("NUR doesn't have enough evidence for a reliable pattern yet.");
const TOKEN_COPY: Record<string, UiCopyKey> = {
  ACTIVE: uiSource("Active"),
  AFTERNOON: uiSource("Afternoon"),
  ARCHIVED: uiSource("Archived"),
  BLOCKED: uiSource("Blocked"),
  CANDIDATE: uiSource("Candidate"),
  CHECKLIST_SUGGESTION: uiSource("Checklist suggestion"),
  COMMUNITY: uiSource("Community"),
  COMPLETED: uiSource("Completed"),
  CONNECTED: uiSource("Connected"),
  COUNCIL: uiSource("Council"),
  DISABLED: uiSource("Disabled"),
  ERROR: uiSource("Error"),
  EVENT: uiSource("Event"),
  EXPLICIT: uiSource("Explicit"),
  GROUP: uiSource("Group"),
  INACTIVE: uiSource("Inactive"),
  INTROSPECTION_SYSTEM: uiSource("Introspection System"),
  JOURNAL_ENTRY: uiSource("Journal entry"),
  MEMBER: uiSource("Member"),
  MISSED: uiSource("Missed"),
  MORNING: uiSource("Morning"),
  NIGHT: uiSource("Night"),
  NOT_CONNECTED: uiSource("Not connected"),
  OPEN: uiSource("Open"),
  ORBIT: uiSource("Orbit"),
  OUTCOME_REPORTED: uiSource("Outcome reported"),
  OUTCOME_RETURNED: uiSource("Outcome returned"),
  OWNER: uiSource("Owner"),
  OWNER_CONFIRMED: uiSource("Owner confirmed"),
  OWNER_REPORTED: uiSource("Owner reported"),
  OWNER_WRITTEN: uiSource("Owner written"),
  OWNER_CHECKIN_DERIVED_GUIDANCE: uiSource("Owner check-in derived guidance"),
  PAST: uiSource("Past"),
  PAUSED: uiSource("Paused"),
  PENDING: uiSource("Pending"),
  PERSON: uiSource("Person"),
  PREDICTION: uiSource("Prediction"),
  PRESENT: uiSource("Present"),
  PROJECT: uiSource("Project"),
  REJECTED: uiSource("Rejected"),
  RESCHEDULED: uiSource("Rescheduled"),
  RESEARCH_BRIEF: uiSource("Research brief"),
  ROOM: uiSource("Room"),
  SCHEDULED: uiSource("Scheduled"),
  SCHEDULED_ACTION: uiSource("Scheduled action"),
  STAGED: uiSource("Staged"),
  SURFACED: uiSource("Surfaced"),
  SYSTEM: uiSource("System"),
  SYSTEM_ACTION: uiSource("System action"),
  TODAY_CHECKIN: uiSource("Today check-in"),
  READY: uiSource("Ready"),
  WEEKLY: uiSource("Weekly"),
  OWNER_LEDGER: uiSource("Owner ledger"),
  OWNER_LEDGER_AGGREGATE: uiSource("Owner ledger aggregate"),
  OWNER_LEDGER_CALCULATION: uiSource("Owner ledger calculation"),
  DETERMINISTIC_OWNER_LEDGER_SYNTHESIS: uiSource("Deterministic owner-ledger synthesis"),
  DETERMINISTIC_INFERENCE: uiSource("Deterministic inference"),
  DETERMINISTIC_QUALITY_GATE: uiSource("Deterministic quality gate"),
  OWNER_SUPPLIED_SOURCE: uiSource("Owner supplied source"),
  AGENTIC_INSIGHT_OWNER_LEDGER: uiSource("Agentic Insight owner ledger"),
  OMEGA_CANDIDATE: uiSource("Omega candidate"),
  SUPPORTS: uiSource("Supports"),
  CONTRADICTS: uiSource("Contradicts"),
  PROVISIONAL: uiSource("Provisional"),
  ACCEPTED: uiSource("Accepted"),
  RETIRED: uiSource("Retired"),
  SHORT: uiSource("Short term"),
  MEDIUM: uiSource("Medium term"),
  LONG: uiSource("Long term"),
  AMBITION: uiSource("Ambition"),
  REBUILD: uiSource("Rebuild"),
  CREATION: uiSource("Creation"),
  GROWTH: uiSource("Growth"),
  INTROSPECTION: uiSource("Introspection"),
  CONNECTION: uiSource("Connection"),
};
const WORLD_FOCUS_COPY: Record<string, UiCopyKey> = {
  map: uiSource("Map"),
  orbits: uiSource("Orbits"),
  timeline: uiSource("Timeline"),
  insights: uiSource("Insights"),
  community: uiSource("Community"),
  research: uiSource("Research"),
  web: uiSource("Web signals"),
};
const CANONICAL_LINK_COPY: Record<string, UiCopyKey> = {
  timeline: uiSource("Timeline"),
  evidence: uiSource("Evidence"),
  insight: uiSource("Insight"),
  plan: uiSource("Plan"),
  system: uiSource("System"),
};

function coreSystemCopy(title: string): string {
  return CORE_SYSTEMS.includes(title as CoreSystemTitle)
    ? v197SystemTitle(undefined, title)
    : title;
}

function tokenCopy(value: unknown, fallback: UiCopyKey): string {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalized && TOKEN_COPY[normalized] ? uiCopy(TOKEN_COPY[normalized]) : uiCopy(fallback);
}

export function formatV197ControlledToken(value: unknown, fallback: UiCopyKey): string {
  return tokenCopy(value, fallback);
}

function empty(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function text(node: Element | null, value: string): void {
  if (node) node.textContent = value;
}

function ownText(node: Element | null, value: string): void {
  if (!node) return;
  const textNodes = [...node.childNodes].filter(child => child.nodeType === 3);
  const rendered = node.firstElementChild ? ` ${value}` : value;
  if (textNodes.length === 0) {
    node.append(node.ownerDocument.createTextNode(rendered));
    return;
  }
  textNodes[0].nodeValue = rendered;
  textNodes.slice(1).forEach(child => child.remove());
}

function shorten(value: string, max = 110): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function number(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "0";
}

function renderTalk(document: Document, rows: V197TalkThreadRow[]): void {
  const stream = document.querySelector<HTMLElement>("#talk-stream");
  if (!stream) return;

  // Every refresh rebuilds the transcript, which destroys the scroll position.
  // Two rules keep that from throwing the reader around:
  //   - if they were at the bottom, stay pinned to the bottom;
  //   - if they had scrolled up to read, restore exactly where they were.
  const distanceFromBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight;
  const wasPinned = stream.scrollHeight === 0 || distanceFromBottom < 48;
  const previousTop = stream.scrollTop;

  empty(stream);

  if (rows.length === 0) {
    const message = document.createElement("div");
    message.className = "talk-message nur";
    message.dataset.nurTalkEmpty = "true";
    const meta = document.createElement("div");
    meta.className = "talk-meta";
    meta.textContent = uiCopy("NUR · private ledger");
    message.append(meta, document.createTextNode(uiCopy("No persisted Talk turns yet. Say one true line to begin.")));
    stream.append(message);
    return;
  }

  rows.forEach(row => {
    const message = document.createElement("div");
    message.className = `talk-message ${row.who === "nur" ? "nur" : "user"}`;
    message.dataset.eventId = row.id;
    if (row.who === "nur") {
      const meta = document.createElement("div");
      meta.className = "talk-meta";
      meta.textContent = uiCopy("NUR · model-generated");
      message.append(meta);
    }
    const body = document.createElement("span");
    body.className = "talk-message-body";
    body.dataset.nurPersistedTalkText = row.id;
    if (row.text) setVerbatimUserText(body, row.text);
    else body.textContent = uiCopy("Persisted response without display text.");
    message.append(body);
    stream.append(message);
  });
  // Deferred to the next frame: immediately after appending, `scrollHeight` is
  // still the pre-layout value, so assigning it here landed the view near the
  // top — which is why the transcript jumped back to the first message on every
  // turn.
  const view = document.defaultView;
  const settle = (): void => {
    if (wasPinned) stream.scrollTop = stream.scrollHeight;
    else stream.scrollTop = Math.min(previousTop, stream.scrollHeight);
  };
  if (view) view.requestAnimationFrame(settle);
  else settle();
}

function renderJournal(document: Document, snapshot: V197BridgeSnapshot): void {
  const count = snapshot.journal.length;
  const latest = snapshot.journal[0];
  text(
    document.querySelector("#page-journal .page-sub"),
    count === 0
      ? uiCopy("Private by default. No persisted entries yet.")
      : uiFormat("{0} private {1} persisted in your owner ledger.", [count, count === 1 ? uiCopy("entry") : uiCopy("entries")]),
  );
  const prompt = document.querySelector("#page-journal .journal-prompt");
  text(prompt, latest ? uiFormat("Last held: “{0}”", [shorten(latest.body, 150)]) : uiCopy("What are you trying not to lose?"));
  if (latest) markVerbatimUserContent(prompt);
}

function renderToday(document: Document, snapshot: V197BridgeSnapshot): void {
  const today = snapshot.today;
  if (!today) {
    text(document.querySelector("#page-today .page-kicker"), uiCopy("Today in NUR · owner ledger unavailable"));
    return;
  }
  const parsed = new Date(`${today.date}T12:00:00`);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? today.date
    : parsed.toLocaleDateString(activeUiLocale(), { month: "long", day: "numeric", year: "numeric" });
  const dayLabel = Number.isNaN(parsed.getTime())
    ? today.day_label
    : parsed.toLocaleDateString(activeUiLocale(), { weekday: "long" });
  text(
    document.querySelector("#page-today .page-kicker"),
    uiFormat("Today in NUR · {0}, {1} · {2}", [
      dayLabel,
      dateLabel,
      formatV197ControlledToken(today.daypart, uiSource("Daypart unavailable")),
    ]),
  );
  text(
    document.querySelector("#page-today .page-sub"),
    uiFormat("{0} · {1} active goals · {2} completed · {3} missed · {4} Glow today.", [today.timezone, today.active_goals.length, today.completed_today.length, today.missed_today.length, today.glow_today]),
  );

  const dimensions = [today.body, today.mind, today.life];
  const labels = [uiCopy("Body"), uiCopy("Mind"), uiCopy("Life")];
  const dimensionCalculations = [
    uiSource("65% today's body check-in + 35% persisted Introspection System progress when a check-in exists"),
    uiSource("Check-in clarity and load blended with Ambition, Growth, and Rebuild"),
    uiSource("Mean persisted progress of Connection, Creation, and Rebuild"),
  ] as const;
  document.querySelectorAll<HTMLElement>("#page-today .reading-line").forEach((line, index) => {
    const dimension = dimensions[index];
    if (!dimension) return;
    text(line.querySelector(":scope > span:first-child"), labels[index]);
    const bar = line.querySelector<HTMLElement>(".reading-bar > i");
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, dimension.score))}%`;
    text(line.querySelector("strong"), uiFormat("{0}% · persisted evidence", [dimension.score]));
    const sources = Object.entries(dimension.sources).map(([key, value]) => uiFormat(
      "{0}: {1}",
      [
        formatV197ControlledToken(key, uiSource("Recorded source")),
        value ?? uiCopy("Not recorded"),
      ],
    )).join(" · ");
    line.title = uiFormat("{0}. Sources: {1}", [
      uiCopy(dimensionCalculations[index] ?? uiSource("Persisted owner evidence calculation")),
      sources,
    ]);
  });

  const nextMove = today.next_move;
  text(document.querySelector("#page-today .next-move .move-kicker"), nextMove ? uiCopy("One real next move") : uiCopy("No move is due"));
  const nextMoveTitle = document.querySelector("#page-today .next-move h3");
  const nextMoveCopy = nextMove?.returning_from_missed
    ? uiFormat("Return to: {0}", [nextMove.title.replace(/^Return to:\s*/u, "")])
    : nextMove?.title;
  text(nextMoveTitle, nextMoveCopy ?? uiCopy("Choose one capacity-matched move."));
  if (nextMove?.title) markVerbatimUserContent(nextMoveTitle);
  text(
    document.querySelector("#page-today .next-move p:last-of-type"),
    nextMove
      ? uiFormat("{0} · persisted owner ledger", [formatV197ControlledToken(nextMove.kind, uiSource("Recorded move"))])
      : uiCopy("Create a System action or schedule; NUR will not invent one."),
  );
  ensureTodayOperatingControls(document, snapshot);
}

function checkInRange(
  document: Document,
  id: string,
  labelText: string,
  value: number,
): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "nur-v197-checkin-field";
  label.htmlFor = id;
  const name = document.createElement("span");
  name.textContent = labelText;
  const output = document.createElement("output");
  output.textContent = String(value);
  const input = document.createElement("input");
  input.id = id;
  input.type = "range";
  input.min = "0";
  input.max = "10";
  input.step = "1";
  input.value = String(value);
  input.addEventListener("input", () => { output.textContent = input.value; });
  label.append(name, output, input);
  return label;
}

function ensureTodayOperatingControls(document: Document, snapshot: V197BridgeSnapshot): void {
  const readingLines = document.querySelector<HTMLElement>("#page-today .reading-lines");
  if (readingLines && !document.querySelector("#nur-v197-today-checkin")) {
    const chamber = document.createElement("section");
    chamber.id = "nur-v197-today-checkin";
    chamber.className = "nur-v197-checkin";
    chamber.hidden = true;
    const title = document.createElement("h3");
    title.textContent = uiCopy("Adjust today's real reading");
    const note = document.createElement("p");
    note.textContent = uiCopy("0 is low, 10 is high. Pain and emotional load are inverse capacity signals.");
    const fields = document.createElement("div");
    fields.className = "nur-v197-checkin-grid";
    fields.append(
      checkInRange(document, "nur-checkin-energy", uiCopy("Energy"), 5),
      checkInRange(document, "nur-checkin-pain", uiCopy("Pain / load"), 5),
      checkInRange(document, "nur-checkin-sleep", uiCopy("Sleep"), 5),
      checkInRange(document, "nur-checkin-nourishment", uiCopy("Food / water"), 5),
      checkInRange(document, "nur-checkin-movement", uiCopy("Movement"), 5),
      checkInRange(document, "nur-checkin-load", uiCopy("Emotional load"), 5),
      checkInRange(document, "nur-checkin-clarity", uiCopy("Clarity"), 5),
    );
    const noteInput = document.createElement("input");
    noteInput.id = "nur-checkin-note";
    noteInput.placeholder = uiCopy("One private note, optional");
    noteInput.autocomplete = "off";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "f4-primary compact";
    save.dataset.action = "save-today-checkin";
    save.textContent = uiCopy("Hold this reading →");
    chamber.append(title, note, fields, noteInput, save);
    readingLines.after(chamber);
  }

  const nextMove = document.querySelector<HTMLElement>("#page-today .next-move");
  let actions = document.querySelector<HTMLElement>("#nur-v197-today-actions");
  if (nextMove && !actions) {
    actions = document.createElement("div");
    actions.id = "nur-v197-today-actions";
    actions.className = "nur-v197-today-actions";
    ([
      ["today-did-it", uiSource("I did it")],
      ["today-missed-it", uiSource("I missed it")],
      ["today-make-easier", uiSource("Make today easier")],
    ] as const).forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "soft-button";
      button.dataset.action = action;
      button.textContent = uiCopy(label);
      actions?.append(button);
    });
    nextMove.append(actions);
  }
  const actionable = snapshot.today?.next_move?.kind === "SYSTEM_ACTION";
  actions?.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
    button.dataset.todayActionId = actionable ? snapshot.today?.next_move?.id ?? "" : "";
    button.disabled = !actionable;
    button.setAttribute("aria-disabled", String(!actionable));
    button.title = actionable ? uiCopy("Persist this owner action.") : uiCopy("A persisted System action is required.");
  });
}

function makeStep(document: Document, plan: V197Plan, step: V197PlanStep): HTMLElement {
  const row = document.createElement("div");
  row.className = `plan-step${step.done ? " done" : ""}`;
  row.dataset.planId = plan.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "plan-check nur-v136-v89-mini-host";
  button.dataset.planStepId = step.id;
  button.setAttribute("aria-label", step.done ? uiCopy("Reopen step") : uiCopy("Complete step"));
  button.setAttribute("aria-pressed", String(step.done));

  const copy = document.createElement("div");
  const title = document.createElement("h3");
  setVerbatimUserText(title, step.title);
  const body = document.createElement("p");
  if (step.body) setVerbatimUserText(body, step.body);
  else body.textContent = uiCopy("One persisted movement inside this Plan.");
  copy.append(title, body);

  const state = document.createElement("time");
  state.textContent = step.done ? uiCopy("returned") : uiCopy("open");
  row.append(button, copy, state);
  return row;
}

function ensureOutcomeComposer(document: Document): void {
  if (document.querySelector("#nur-outcome-composer")) return;
  const page = document.querySelector<HTMLElement>("#page-plan article.nur-panel, #page-plan .nur-panel");
  if (!page) return;
  const shell = document.createElement("div");
  shell.id = "nur-outcome-composer";
  shell.className = "thought-composer";
  shell.hidden = true;

  const input = document.createElement("input");
  input.id = "nur-outcome-input";
  input.autocomplete = "off";
  input.placeholder = uiCopy("What changed in the real world?");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "thought-send-button send-holo-pill";
  button.dataset.action = "return-outcome";
  button.textContent = uiCopy("Return outcome →");
  shell.append(input, button);
  page.append(shell);
}

function renderPlans(document: Document, plans: V197Plan[]): void {
  const current = plans[0];
  const list = document.querySelector<HTMLElement>("#page-plan .plan-list");
  const planTitle = document.querySelector("#page-plan .panel-title");
  text(planTitle, current?.title ?? uiCopy("No persisted Plan yet"));
  if (current?.title) markVerbatimUserContent(planTitle);
  text(
    document.querySelector("#page-plan .panel-sub"),
    current ? uiFormat("{0} persisted {1} · {2}", [
      current.steps.length,
      current.steps.length === 1 ? uiCopy("step") : uiCopy("steps"),
      formatV197ControlledToken(current.status, uiSource("Plan status")),
    ]) : uiCopy("Use the composer below to name one honest direction."),
  );
  if (list) {
    empty(list);
    if (current?.steps.length) current.steps.forEach(step => list.append(makeStep(document, current, step)));
    else {
      const state = document.createElement("div");
      state.className = "plan-step";
      const copy = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = uiCopy("A Plan begins after one direction is persisted.");
      copy.append(title);
      state.append(copy);
      list.append(state);
    }
  }
  ensureOutcomeComposer(document);
  const completedStep = current?.steps.find(step => step.done);
  const outcomeComposer = document.querySelector<HTMLElement>("#nur-outcome-composer");
  if (outcomeComposer) {
    outcomeComposer.hidden = !completedStep;
    if (completedStep) outcomeComposer.dataset.planStepId = completedStep.id;
    else delete outcomeComposer.dataset.planStepId;
  }
}

function systemNodes(snapshot: V197BridgeSnapshot): V197MapNode[] {
  const available = (snapshot.map?.nodes ?? []).filter(node => node.kind !== "PERSONAL_BRIDGE");
  return CORE_SYSTEMS.map(title => available.find(node => node.title === title)).filter((node): node is V197MapNode => Boolean(node));
}

function livingSystems(snapshot: V197BridgeSnapshot): V197SystemSnapshot[] {
  return CORE_SYSTEMS.map(title => snapshot.systems?.systems.find(row => row.title === title))
    .filter((row): row is V197SystemSnapshot => Boolean(row));
}

function renderSystemRail(document: Document, nodes: V197MapNode[], activeOrbitId: string | null): void {
  const list = document.querySelector<HTMLElement>(".clean-system-list");
  if (!list) return;
  const existing = [...list.querySelectorAll<HTMLButtonElement>(".clean-system-row")];
  while (existing.length < nodes.length) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "clean-system-row";
    const glyph = document.createElement("i");
    glyph.textContent = "✦";
    const label = document.createElement("span");
    row.append(glyph, label);
    list.append(row);
    existing.push(row);
  }
  existing.forEach((row, index) => {
    const node = nodes[index];
    if (!node) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    row.dataset.system = node.title;
    row.dataset.orbitId = node.id;
    row.dataset.page = "systems";
    text(row.querySelector(":scope > span:not(.nur-exact-mini-host)"), coreSystemCopy(node.title));
    const active = node.id === activeOrbitId || (!activeOrbitId && index === 0);
    row.classList.toggle("active", active);
    row.setAttribute("aria-pressed", String(active));
  });
}

function renderSystems(document: Document, snapshot: V197BridgeSnapshot): void {
  const living = livingSystems(snapshot);
  const nodes = systemNodes(snapshot);
  const activeOrbitId = snapshot.preferences?.active_orbit_id ?? living[0]?.orbit_id ?? nodes[0]?.id ?? null;
  const slots = [...document.querySelectorAll<HTMLButtonElement>(".universe-system-node")];
  slots.forEach((slot, index) => {
    const system = living[index];
    const node = nodes[index];
    // The canonical markup ships a fixed number of System slots. The Systems row
    // must show Systems, so a slot with no living System is hidden rather than
    // falling back to an arbitrary orbit — that fallback kept rendering retired
    // Systems (Money, Body) as though they still existed.
    if (!system) {
      // Both signals: the attribute for semantics and assistive technology, and
      // an inline style because canonical CSS sets `display` on this class and
      // would otherwise keep the slot painted.
      slot.hidden = true;
      // Canonical CSS declares `display` on this class with `!important`, which
      // beats both the `hidden` attribute and a plain inline style. Only an
      // important inline declaration wins.
      slot.style.setProperty("display", "none", "important");
      slot.dataset.nurSystemSlot = "retired";
      slot.removeAttribute("data-system-slug");
      slot.setAttribute("aria-hidden", "true");
      slot.tabIndex = -1;
      return;
    }
    slot.style.removeProperty("display");
    delete slot.dataset.nurSystemSlot;
    slot.removeAttribute("aria-hidden");
    slot.removeAttribute("tabindex");
    if (!node && !system) {
      slot.hidden = true;
      return;
    }
    const title = system?.title ?? node?.title ?? uiCopy("System");
    const orbitId = system?.orbit_id ?? node?.id ?? "";
    slot.hidden = false;
    slot.dataset.system = title;
    slot.dataset.systemSlug = system?.slug ?? "";
    slot.dataset.orbitId = orbitId;
    text(slot.querySelector(":scope > span:not(.nur-exact-mini-host) > b"), coreSystemCopy(title));
    const held = node ? Object.values(node.counts).reduce((sum, value) => sum + value, 0) : 0;
    text(
      slot.querySelector(":scope > span:not(.nur-exact-mini-host) > small"),
      system ? uiFormat("{0}% · {1} Glow", [system.progress_percent, system.progress_sources.glow_points]) : uiFormat("{0} held", [held]),
    );
    const active = orbitId === activeOrbitId || (!activeOrbitId && index === 0);
    slot.classList.toggle("active", active);
    slot.setAttribute("aria-pressed", String(active));
  });
  const railNodes = living.length
    ? living.map(system => ({
        id: system.orbit_id,
        title: system.title,
        kind: "SYSTEM",
        orbit_id: system.orbit_id,
        active: true,
        counts: { progress: system.progress_percent, glow: system.progress_sources.glow_points },
      }))
    : nodes;
  renderSystemRail(document, railNodes, activeOrbitId);

  const stateCards = [...document.querySelectorAll<HTMLElement>(".universe-state-strip > article")];
  const state = snapshot.ownerState;
  const facts: Array<[string, string, string]> = [
    [uiCopy("Systems"), number(state?.active_systems), uiCopy("owner-owned")],
    [uiCopy("Plans"), number(state?.plans_active), uiCopy("persisted")],
    [uiCopy("Outcomes"), number(state?.outcomes_returned), uiCopy("returned")],
    [uiCopy("Questions"), number(state?.open_questions), uiCopy("open")],
    [uiCopy("Research"), number(state?.research_staged), uiCopy("saved locally")],
    [uiCopy("Insights"), number(state?.insights_evolving), uiCopy("owner review")],
  ];
  stateCards.forEach((card, index) => {
    const fact = facts[index];
    if (!fact) return;
    text(card.querySelector("small"), fact[0]);
    text(card.querySelector("b"), fact[1]);
    text(card.querySelector("em, span"), fact[2]);
  });
}

function recordTitle(row: Record<string, unknown> | undefined, fallback: string): string {
  if (!row) return fallback;
  for (const key of ["title", "claim", "question", "summary"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function renderLiveUniverse(document: Document, snapshot: V197BridgeSnapshot): void {
  const live = snapshot.live;
  if (!live) return;

  const coverage = Math.round(Math.max(0, Math.min(1, live.state.confidence)) * 100);
  const stateSummary = live.next_moves[0] && typeof live.next_moves[0].title === "string"
    ? uiFormat("The clearest persisted next move is: {0}", [live.next_moves[0].title])
    : live.active_goals.length === 1
      ? uiFormat("{0} active goal needs a persisted next move.", [live.active_goals.length])
      : live.active_goals.length > 1
        ? uiFormat("{0} active goals need a persisted next move.", [live.active_goals.length])
        : uiCopy("No next move is persisted yet. NUR will not invent one.");
  text(
    document.querySelector("#page-systems .universe-hero-copy .page-sub"),
    uiFormat("{0} {1} owner-ledger sources · {2}% source coverage, not truth probability.", [stateSummary, live.state.source_count, coverage]),
  );
  text(
    document.querySelector(".universe-field-readout > span"),
    uiFormat("{0} active Systems · {1} open loops · {2} Glow today", [live.active_systems.length, live.open_loops.length, live.glow.today_points ?? 0]),
  );

  const cards = [...document.querySelectorAll<HTMLElement>(".universe-state-strip > article")];
  const nextMove = live.next_moves[0];
  const firstGoal = live.active_goals[0];
  const firstProject = live.projects[0];
  const firstSignal = live.signals[0];
  const firstChange = live.what_changed[0];
  const orbitCount = live.people_orbits.length + live.group_orbits.length;
  const facts: Array<[string, string, string, string, string]> = [
    [
      uiCopy("What NUR sees now"),
      shorten(stateSummary, 48),
      uiFormat("{0} persisted sources · {1}% coverage", [live.state.source_count, coverage]),
      "systems",
      "universe",
    ],
    [
      uiCopy("Future path"),
      recordTitle(firstGoal, uiFormat("{0} active goals", [live.active_goals.length])),
      uiFormat("{0} objectives · {1} plans", [live.active_objectives.length, live.active_plans.length]),
      "",
      "map",
    ],
    [
      uiCopy("People in your Orbit"),
      orbitCount ? uiFormat("{0} active people / groups", [orbitCount]) : uiCopy("No people or group Orbit yet"),
      orbitCount ? uiCopy("Open the owner-scoped Orbit ledger") : uiCopy("NUR will not invent social activity"),
      "",
      "orbits",
    ],
    [
      uiCopy("Projects & open loops"),
      recordTitle(firstProject, uiFormat("{0} open loops", [live.open_loops.length])),
      uiFormat("{0} projects · {1} unresolved", [live.projects.length, live.open_loops.length]),
      "",
      "orbits",
    ],
    [
      uiCopy("Next move"),
      recordTitle(nextMove, uiCopy("No persisted next move")),
      typeof nextMove?.why === "string" ? shorten(nextMove.why, 62) : uiCopy("NUR will not invent one"),
      "plan",
      "",
    ],
    [
      uiCopy("Signals & change"),
      recordTitle(firstSignal, recordTitle(firstChange, uiCopy("No recent persisted signal"))),
      uiFormat("{0} signals · {1} recent changes", [live.signals.length, live.what_changed.length]),
      "",
      "research",
    ],
  ];
  cards.forEach((card, index) => {
    const fact = facts[index];
    if (!fact) return;
    setLaneCard(card, fact[0], fact[1], fact[2]);
    if (fact[3]) card.dataset.page = fact[3];
    else delete card.dataset.page;
    if (fact[4]) card.dataset.worldFocus = fact[4];
    else delete card.dataset.worldFocus;
    card.setAttribute("role", "link");
    card.tabIndex = 0;
  });

  const lane = document.querySelector<HTMLElement>(".universe-system-lane");
  const laneCards = [...(lane?.querySelectorAll<HTMLElement>("article") ?? [])];
  const insight = live.latest_insights[0];
  const timeline = live.timeline_highlights[0];
  setLaneCard(
    laneCards[0],
    uiCopy("Latest insight"),
    recordTitle(insight, uiCopy("No candidate insight yet")),
    insight ? uiCopy("Evidence-linked owner insight") : uiCopy("NUR will not invent one"),
  );
  setLaneCard(
    laneCards[1],
    uiCopy("Latest timeline"),
    recordTitle(timeline, uiCopy("No Timeline event yet")),
    timeline ? uiCopy("Persisted owner event") : uiCopy("Nothing has been persisted in this slot"),
  );
  setLaneCard(
    laneCards[2],
    uiCopy("What changed"),
    recordTitle(firstChange, uiCopy("No recent persisted change")),
    firstChange ? uiCopy("Recent owner ledger, not a verified last-visit diff") : uiCopy("No invented change state"),
  );
  lane?.setAttribute("aria-label", uiCopy("Live Universe owner-ledger highlights"));
  document.body.dataset.nurLiveProvenance = live.provenance_label;
}

function renderSelectedSystem(document: Document, snapshot: V197BridgeSnapshot): void {
  const systems = livingSystems(snapshot);
  if (systems.length === 0) return;
  const activeOrbitId = snapshot.preferences?.active_orbit_id;
  const selectedTitle = document.body.dataset.nurSystem;
  const system = systems.find(row => row.orbit_id === activeOrbitId)
    ?? systems.find(row => row.title === selectedTitle)
    ?? systems[0];
  document.body.dataset.nurSystem = system.title;

  const panel = document.querySelector<HTMLElement>(".universe-insight-panel");
  if (panel) panel.dataset.nurLens = "system";
  ownText(document.querySelector(".system-badge"), uiFormat("{0} System", [coreSystemCopy(system.title)]));
  text(document.querySelector(".live-label"), uiCopy("OWNER LEDGER"));
  text(document.querySelector(".universe-insight-title small"), uiCopy("Definition"));
  text(document.querySelector(".universe-insight-title h2"), v197SystemTitle(system.slug, system.title));
  text(document.querySelector(".universe-insight-copy"), v197SystemDefinition(system));
  document.querySelectorAll<HTMLElement>(".signal-list span").forEach((slot, index) => {
    slot.textContent = v197SystemQuestion(system, index);
  });
  text(document.querySelector(".insight-opportunity small"), uiCopy("Suggested next move"));
  const nextMoveTitle = document.querySelector<HTMLElement>(".insight-opportunity b");
  text(nextMoveTitle, v197SystemNextMove(system));
  if (system.next_move.kind !== "CHECKLIST_SUGGESTION") markVerbatimUserContent(nextMoveTitle);
  text(document.querySelector(".insight-uncertainty span"), uiCopy("If ignored"));
  text(document.querySelector(".insight-uncertainty p"), v197SystemPrediction(system, "ignored"));
  text(document.querySelector(".insight-strength span"), uiCopy("Persisted progress"));
  text(document.querySelector(".insight-strength b"), uiFormat("{0}%", [system.progress_percent]));
  const decorativeStrengthBar = document.querySelector<HTMLElement>(".insight-strength i");
  if (decorativeStrengthBar) decorativeStrengthBar.hidden = true;
  text(document.querySelector(".insight-evidence small"), uiCopy("Evidence"));
  text(
    document.querySelector(".insight-evidence b"),
    uiFormat("{0}/{1} actions · {2} Glow", [system.progress_sources.completed_actions, system.progress_sources.total_actions, system.progress_sources.glow_points]),
  );
  text(document.querySelector(".insight-evidence span"), v197SystemProgressFormula());
  text(document.querySelector(".insight-revision span"), v197SystemPrediction(system, "followed"));

  const cards = [...document.querySelectorAll<HTMLElement>(".universe-state-strip > article")];
  setLaneCard(cards[0], uiCopy("System progress"), uiFormat("{0}%", [system.progress_percent]), uiCopy("calculated from owner evidence"));
  setLaneCard(
    cards[1],
    uiCopy("Actions"),
    uiFormat("{0}/{1}", [system.progress_sources.completed_actions, system.progress_sources.total_actions]),
    uiCopy("completed / persisted"),
  );
  setLaneCard(cards[2], uiCopy("Active goals"), String(system.active_goal_count), uiFormat("{0}% goal progress", [system.progress_sources.goal_progress_percent]));
  setLaneCard(cards[3], uiCopy("Glow"), String(system.progress_sources.glow_points), uiCopy("source-linked in this System"));
  setLaneCard(cards[4], uiCopy("Next move"), v197SystemNextMove(system), uiCopy("capacity-matched owner action"));
  if (system.next_move.kind !== "CHECKLIST_SUGGESTION") {
    markVerbatimUserContent(cards[4]?.querySelector(":scope > b") ?? null);
  }
  setLaneCard(
    cards[5],
    uiCopy("Future path"),
    v197SystemPrediction(system, "followed"),
    tokenCopy(system.prediction.provenance_label, uiSource("Owner ledger calculation")),
  );
  cards.forEach(card => card.querySelectorAll<HTMLElement>(".sparkline").forEach(line => { line.hidden = true; }));

  // A selected System also owns the signal lane: its Glow scoreboard replaces
  // the Live Universe highlights (the universe lens restores them on focus).
  const laneCards = [...document.querySelectorAll<HTMLElement>(".universe-system-lane article")];
  const scoreboard = snapshot.scoreboard?.rows ?? [];
  laneCards.forEach((card, index) => {
    const score = scoreboard[index];
    setLaneCard(
      card,
      score ? uiFormat("System rank {0}", [score.rank]) : uiCopy("System Glow"),
      score ? v197SystemTitle(score.system_slug, score.system_title) : v197SystemTitle(system.slug, system.title),
      uiFormat("{0} persisted Glow", [score?.score ?? system.progress_sources.glow_points]),
    );
  });
}

function setLaneCard(card: Element | undefined, eyebrow: string, title: string, detail: string): void {
  if (!card) return;
  text(card.querySelector(":scope > small"), eyebrow);
  text(card.querySelector(":scope > b"), title);
  const detailSlot = card.querySelector(":scope > em")
    ?? card.querySelector(":scope > span:not(.state-mark):not(.nur-exact-mini-host)");
  text(detailSlot, detail);
}

function primaryInsight(snapshot: V197BridgeSnapshot): Record<string, unknown> | undefined {
  const summary = snapshot.insights;
  const typed = summary?.dedicated_insights?.[0];
  if (typed) return typed;
  const compatible = summary?.claims.find(row =>
    row.record_kind === "DEDICATED_INSIGHT"
    || (typeof row.insight_type === "string" && Array.isArray(row.evidence)),
  );
  return compatible ?? summary?.omega_claims?.[0] ?? summary?.claims[0];
}

function ensureInsightControls(document: Document, claim: Record<string, unknown> | undefined): void {
  const panel = document.querySelector<HTMLElement>(".universe-insight-panel");
  if (!panel) return;
  let controls = document.querySelector<HTMLElement>("#nur-v197-insight-controls");
  if (!controls) {
    controls = document.createElement("section");
    controls.id = "nur-v197-insight-controls";
    controls.className = "nur-v197-insight-controls";
    controls.setAttribute("aria-label", uiCopy("Insight owner review controls"));
    const correction = document.createElement("input");
    correction.id = "nur-v197-insight-correction";
    correction.placeholder = uiCopy("Correct what NUR got wrong");
    correction.autocomplete = "off";
    const actions = document.createElement("div");
    actions.className = "nur-v197-insight-actions";
    ([
      ["insight-accept", uiSource("Accept")],
      ["insight-reject", uiSource("Reject")],
      ["insight-correct", uiSource("Correct")],
      ["insight-plan", uiSource("Make a Plan")],
      ["insight-timeline", uiSource("Add to Timeline")],
    ] as const).forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "soft-button";
      button.dataset.action = action;
      button.textContent = uiCopy(label);
      actions.append(button);
    });
    const status = document.createElement("small");
    status.className = "nur-v197-insight-review-state";
    controls.append(correction, actions, status);
    panel.append(controls);
  }
  const insightId = typeof claim?.id === "string" ? claim.id : "";
  const dedicated = Boolean(
    insightId
    && (claim?.record_kind === "DEDICATED_INSIGHT"
      || (typeof claim?.insight_type === "string" && Array.isArray(claim?.evidence))),
  );
  const ownerConfirmed = claim?.lifecycle_status === "OWNER_CONFIRMED"
    || claim?.truth_status === "ACCEPTED";
  controls.dataset.insightId = dedicated ? insightId : "";
  controls.hidden = false;
  controls.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
    const requiresConfirmation = button.dataset.action === "insight-plan";
    const disabled = !dedicated || (requiresConfirmation && !ownerConfirmed);
    button.disabled = disabled;
    button.setAttribute("aria-disabled", String(disabled));
    button.title = !dedicated
      ? uiCopy("Generate a dedicated evidence-linked Insight before reviewing it here.")
      : requiresConfirmation && !ownerConfirmed
        ? uiCopy("Accept this Insight before converting it into a Plan.")
        : uiCopy("Persist this owner review action.");
  });
  const correction = controls.querySelector<HTMLInputElement>("#nur-v197-insight-correction");
  if (correction) correction.disabled = !dedicated;
  text(
    controls.querySelector(".nur-v197-insight-review-state"),
    dedicated
      ? uiFormat("{0} · owner-governed Insight", [formatV197ControlledToken(
          claim?.lifecycle_status ?? claim?.truth_status ?? "CANDIDATE",
          uiSource("Candidate"),
        )])
      : uiCopy("Omega claim shown read-only · generate a dedicated Insight to act on it"),
  );
}

export function renderInsightInspection(
  document: Document,
  detail: V197InsightDetail | null,
  evidence: V197InsightEvidenceResponse | null,
  history: V197InsightWhyChanged | null,
  failure: string | null = null,
): void {
  const panel = document.querySelector<HTMLElement>(".universe-insight-panel");
  if (!panel) return;
  let host = panel.querySelector<HTMLElement>("#nur-v197-insight-inspection");
  if (!host) {
    host = document.createElement("section");
    host.id = "nur-v197-insight-inspection";
    host.className = "nur-v197-insight-inspection";
    host.setAttribute("aria-label", uiCopy("Insight evidence and change history"));
    panel.append(host);
  }
  host.hidden = false;
  empty(host);
  if (failure || !detail || !evidence || !history) {
    const state = document.createElement("small");
    state.textContent = failure ?? uiCopy("No dedicated Insight is available for evidence inspection.");
    host.append(state);
    return;
  }
  ensureInsightControls(document, {
    ...detail,
    record_kind: "DEDICATED_INSIGHT",
    claim_text: detail.claim,
  });

  const heading = document.createElement("strong");
  heading.textContent = uiFormat("{0} · {1} · version {2}", [
    tokenCopy(detail.epistemic_state, uiSource("Unclear")),
    tokenCopy(detail.time_scale, uiSource("Unclear")),
    detail.insight_version,
  ]);
  const sourceState = document.createElement("p");
  const support = evidence.relations.filter(row => row.relation === "SUPPORTS");
  const counter = evidence.relations.filter(row => row.relation === "CONTRADICTS");
  sourceState.textContent = uiFormat("{0} supporting · {1} counter · {2} source domains", [support.length, counter.length, detail.source_diversity]);
  const uncertainty = document.createElement("p");
  uncertainty.textContent = uiFormat("What NUR may be wrong about: {0}", [detail.what_nur_may_be_wrong_about]);
  host.append(heading, sourceState, uncertainty);

  const evidenceList = document.createElement("ul");
  evidenceList.setAttribute("aria-label", uiCopy("Canonical Insight evidence"));
  evidence.relations.slice(0, 8).forEach(row => {
    const item = document.createElement("li");
    item.textContent = uiFormat("{0} · {1} · {2} · {3}{4}", [
      tokenCopy(row.relation, uiSource("Evidence")),
      tokenCopy(row.source_domain, uiSource("Owner ledger")),
      tokenCopy(row.provenance_label, uiSource("Owner ledger")),
      row.source_exists ? uiCopy("source present") : uiCopy("source invalidated"),
      row.evidence_summary ? uiFormat(" · {0}", [row.evidence_summary]) : "",
    ]);
    evidenceList.append(item);
  });
  host.append(evidenceList);

  if (detail.alternative_explanations.length) {
    const alternatives = document.createElement("p");
    alternatives.textContent = uiFormat("Alternatives: {0}", [detail.alternative_explanations.join(" · ")]);
    host.append(alternatives);
  }
  const changes = document.createElement("p");
  changes.textContent = history.changes.length
    ? uiFormat("Why changed: {0}", [history.changes.slice(-4).map(row => uiFormat("{0}: {1}", [
        tokenCopy(row.change_class, uiSource("Change")),
        tokenCopy(row.trigger, uiSource("Owner ledger event")),
      ])).join(" · ")])
    : uiCopy("Why changed: no state transition has been recorded yet.");
  host.append(changes);

  const routes = document.createElement("nav");
  routes.setAttribute("aria-label", uiCopy("Canonical Insight links"));
  Object.entries(detail.canonical_links).forEach(([label, route]) => {
    if (!route) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "soft-button";
    button.dataset.ownerRoute = route;
    button.textContent = uiCopy(CANONICAL_LINK_COPY[label] ?? uiSource("Open record"));
    routes.append(button);
  });
  host.append(routes);
}

function renderVisibleLens(
  document: Document,
  snapshot: V197BridgeSnapshot,
  focus: string,
): void {
  if (!["map", "orbits", "timeline", "insights", "community", "research", "web"].includes(focus)) return;
  const panel = document.querySelector<HTMLElement>(".universe-insight-panel");
  if (!panel) return;
  panel.dataset.nurLens = focus;
  ownText(
    panel.querySelector(".system-badge"),
    uiFormat("{0} lens", [uiCopy(WORLD_FOCUS_COPY[focus] ?? uiSource("Universe"))]),
  );
  text(panel.querySelector(".live-label"), uiCopy("OWNER LEDGER"));

  let title = uiCopy("No persisted data yet");
  let copy = uiCopy("This lens will not invent content before owner-scoped records exist.");
  let uncertainty = uiCopy("Only persisted owner records are shown.");
  let count = 0;
  const signals: string[] = [];

  if (focus === "map") {
    const graphNodes = snapshot.mapGraph?.nodes ?? [];
    const nodes = graphNodes.length
      ? graphNodes.filter(node => node.kind !== "MASTER_STAR")
      : snapshot.map?.nodes.filter(node => node.kind !== "PERSONAL_BRIDGE") ?? [];
    count = nodes.length;
    title = uiFormat("{0} persisted Map nodes", [count]);
    copy = snapshot.mapGraph
      ? uiFormat("{0} Systems · {1} goals · {2} people · {3} social Orbits · {4} open predictions.", [
          snapshot.mapGraph.counts.systems,
          snapshot.mapGraph.counts.goals,
          snapshot.mapGraph.counts.people ?? 0,
          snapshot.mapGraph.counts.social_orbits ?? 0,
          snapshot.mapGraph.counts.open_predictions,
        ])
      : (snapshot.map?.counts ?? []).map(row => uiFormat(
          "{0} {1}",
          [row.count, row.key === "orbits" ? uiCopy("owner-owned orbits") : uiCopy("map records")],
        )).join(" · ") || uiCopy("No owner map counts yet.");
    uncertainty = uiCopy("Map geometry is canonical V197; graph labels, edges, and paths come from the owner ledger.");
    signals.push(...nodes.slice(0, 3).map(node => "label" in node ? node.label : node.title));
  }

  if (focus === "orbits") {
    const socialKinds = new Set(["PERSON", "GROUP", "COUNCIL", "COMMUNITY"]);
    const orbits = (snapshot.orbits?.orbits ?? []).filter(
      row => row.kind !== "PERSONAL_BRIDGE" && !socialKinds.has(row.kind),
    );
    const projects = snapshot.projects?.projects ?? [];
    const people = snapshot.live?.people_orbits ?? [];
    const groups = snapshot.live?.group_orbits ?? [];
    const social = [...people, ...groups];
    count = orbits.length + projects.length + social.length;
    title = social.length
      ? uiFormat("{0} · {1}", [recordTitle(social[0], uiCopy("Social Orbit")), tokenCopy(social[0].kind, uiSource("Orbit"))])
      : projects.length
        ? uiFormat("{0} · AM Project", [projects[0].title])
        : orbits.length
          ? uiFormat("{0} + {1} Systems", [orbits[0].title, Math.max(0, orbits.length - 1)])
          : uiCopy("No persisted Orbits yet");
    copy = social.length
      ? uiFormat("{0} Person Orbits · {1} Group/Council Orbits · {2} unresolved threads · group memory remains separate.", [
          people.length,
          groups.length,
          social.reduce((sum, row) => sum + Number(row.unresolved_count ?? 0), 0),
        ])
      : projects.length
        ? uiFormat("{0} owner AM {1} · {2} persisted tasks · {3} verified evidence.", [
            projects.length,
            projects.length === 1 ? uiCopy("Project") : uiCopy("Projects"),
            projects.reduce((sum, row) => sum + Object.values(row.task_counts).reduce((inner, value) => inner + value, 0), 0),
            projects.reduce((sum, row) => sum + row.verified_evidence, 0),
          ])
      : orbits.length
        ? uiFormat("{0} owner-owned Orbits · {1} held objects.", [
            orbits.length,
            orbits.reduce((sum, row) => sum + Object.values(row.counts).reduce((inner, value) => inner + value, 0), 0),
          ])
        : uiCopy("Create one System to open this lens.");
    uncertainty = social.length
      ? uiCopy("No private Talk, Journal, Timeline, or Omega record is copied into a social Orbit.")
      : projects.length
        ? uiFormat("Runs remain proposal/approval records; NUR performs no external action from this lens · {0} blocked tasks.", [snapshot.projects?.counts.blocked_tasks ?? 0])
        : uiCopy("Only the signed-in owner's Orbits are queried.");
    signals.push(...social.slice(0, 3).map(row => uiFormat("{0} · {1} unresolved", [recordTitle(row, uiCopy("Orbit")), Number(row.unresolved_count ?? 0)])));
    signals.push(...projects.slice(0, 3).map(row => uiFormat("{0} · {1}", [row.title, tokenCopy(row.status, uiSource("Project status"))])));
    if (signals.length < 3) signals.push(...orbits.slice(0, 3 - signals.length).map(row => row.title));
  }

  if (focus === "timeline") {
    const items = snapshot.timeline?.items ?? [];
    const past = items.filter(row => !row.lane || row.lane === "past");
    const present = items.filter(row => row.lane === "present");
    const future = items.filter(row => row.lane === "future" || row.lane === "prediction");
    const latest = present[0] ?? future[0] ?? past[0];
    const latestOutcome = items.find(row => ["OUTCOME_REPORTED", "OUTCOME_RETURNED"].includes(row.kind));
    count = items.length;
    title = latest?.title ?? uiCopy("No persisted Timeline event yet");
    copy = latest
      ? uiFormat("{0} past · {1} present · {2} future/prediction. {3}{4}", [
          past.length,
          present.length,
          future.length,
          latest.body,
          latestOutcome && latestOutcome.id !== latest.id
            ? uiFormat(" Latest returned outcome: {0}", [latestOutcome.body])
            : "",
        ])
      : uiCopy("Create or schedule one real action to open the future lane.");
    uncertainty = latest
      ? uiFormat("{0} · {1}", [formatV197ControlledToken(latest.provenance_label, uiSource("Owner ledger")), tokenCopy(latest.kind, uiSource("Event"))])
      : uiCopy("No event provenance exists yet.");
    if (latestOutcome) signals.push(uiFormat("Returned: {0}", [shorten(latestOutcome.body, 72)]));
    signals.push(...items.filter(item => item.id !== latestOutcome?.id).slice(0, 3 - signals.length).map(item => item.title));
  }

  if (focus === "community") {
    const rooms = (snapshot.communityRooms ?? []).filter(room => room.status === "ACTIVE");
    const councils = rooms.filter(room => room.room_kind === "COUNCIL");
    count = rooms.length;
    title = rooms.length
      ? uiFormat("{0} · {1} room", [rooms[0].title, tokenCopy(rooms[0].room_kind, uiSource("Room"))])
      : uiCopy("No bounded rooms yet");
    copy = rooms.length
      ? uiFormat("{0} persisted {1} · {2} {3} · members see room content only.", [
          rooms.length,
          rooms.length === 1 ? uiCopy("room") : uiCopy("rooms"),
          councils.length,
          councils.length === 1 ? uiCopy("Council") : uiCopy("Councils"),
        ])
      : uiCopy("Create one bounded room to open Group NUR; no public feed is faked.");
    uncertainty = uiCopy("Private Talk, Journal, Timeline, and Omega never enter a room automatically.");
    signals.push(...rooms.slice(0, 3).map(room => uiFormat("{0} · {1}{2}", [
      room.title,
      tokenCopy(room.current_user_role, uiSource("Member")),
      room.is_demo ? uiCopy(" · DEMO") : "",
    ])));
  }

  if (focus === "research") {
    const briefs = snapshot.researchBriefs;
    const latest = briefs[0];
    count = briefs.length;
    title = latest?.question ?? uiCopy("No persisted research question yet");
    copy = latest
      ? uiFormat("{0} owner-staged {1} · latest status {2}.", [
          briefs.length,
          briefs.length === 1 ? uiCopy("brief") : uiCopy("briefs"),
          tokenCopy(latest.status, uiSource("Research status")),
        ])
      : uiCopy("Stage one question; NUR will hold it without inventing a source.");
    uncertainty = latest
      ? uiFormat("Provider status: {0} · summaries remain empty until evidence is returned.", [tokenCopy(latest.provider_status, uiSource("Provider state"))])
      : uiCopy("No external research provider has returned evidence.");
    signals.push(...briefs.slice(0, 3).map(row => uiFormat("{0} · {1}", [row.question, tokenCopy(row.provider_status, uiSource("Provider state"))])));
  }

  if (focus === "insights") {
    const insight = snapshot.insights;
    const claim = primaryInsight(snapshot);
    const claimText = typeof claim?.claim_text === "string" ? claim.claim_text : null;
    const claimTitle = typeof claim?.title === "string" ? claim.title : claimText;
    count = insight?.counts.claims ?? 0;
    title = claimTitle ?? uiCopy(NO_RELIABLE_INSIGHT);
    copy = claimText
      ? uiFormat("{0} · {1} attached evidence records.", [claimText, Array.isArray(claim?.evidence) ? claim.evidence.length : 0])
      : uiCopy("More owner evidence across time or domains is required before NUR surfaces one.");
    uncertainty = typeof claim?.what_nur_may_be_wrong_about === "string"
      ? claim.what_nur_may_be_wrong_about
      : uiFormat("{0} open contradictions · {1} awaiting review.", [insight?.counts.open_contradictions ?? 0, insight?.counts.review_queue ?? 0]);
    signals.push(
      uiFormat("{0} candidate claims", [insight?.counts.claims ?? 0]),
      uiFormat("{0} predictions", [insight?.counts.predictions ?? 0]),
      uiFormat("{0} contradictions", [insight?.counts.open_contradictions ?? 0]),
      uiFormat("{0} feasibility checks", [insight?.counts.feasibility_assessments ?? 0]),
    );
  }

  text(panel.querySelector(".universe-insight-title small"), uiCopy("Persisted view"));
  text(panel.querySelector(".universe-insight-title h2"), title);
  text(panel.querySelector(".universe-insight-copy"), copy);
  text(panel.querySelector(".insight-uncertainty p"), uncertainty);
  const signalSlots = [...panel.querySelectorAll<HTMLElement>(".signal-list span")];
  signalSlots.forEach((slot, index) => {
    slot.textContent = signals[index] ?? uiCopy("No additional persisted signal");
  });
  text(panel.querySelector(".insight-strength span"), uiCopy("Persisted records"));
  text(panel.querySelector(".insight-strength b"), String(count));
  text(panel.querySelector(".insight-evidence small"), uiCopy("Provenance"));
  text(
    panel.querySelector(".insight-evidence b"),
    formatV197ControlledToken(
      snapshot.timeline?.provenance_label ?? snapshot.map?.provenance_label,
      uiSource("Owner ledger"),
    ),
  );
  text(panel.querySelector(".insight-evidence span"), uiCopy("No fake live metrics"));
  text(panel.querySelector(".insight-revision span"), uiCopy("Updated from the latest persisted snapshot."));
  const controls = document.querySelector<HTMLElement>("#nur-v197-insight-controls");
  const inspection = document.querySelector<HTMLElement>("#nur-v197-insight-inspection");
  if (focus === "insights") ensureInsightControls(document, primaryInsight(snapshot));
  else {
    if (controls) controls.hidden = true;
    if (inspection) inspection.hidden = true;
  }
}

export function renderWorldLens(
  document: Document,
  snapshot: V197BridgeSnapshot,
  focus: string,
): void {
  const mapPanel = document.querySelector<HTMLElement>("#page-systems .universe-map-panel");
  if (mapPanel) {
    mapPanel.scrollLeft = 0;
    mapPanel.scrollTop = 0;
  }
  if (focus === "universe") {
    renderLiveUniverse(document, snapshot);
    return;
  }
  renderVisibleLens(document, snapshot, focus);
  const lane = document.querySelector<HTMLElement>(".universe-system-lane");
  if (!lane) return;
  const cards = [...lane.querySelectorAll<HTMLElement>("article")];

  if (focus === "timeline") {
    const items = snapshot.timeline?.items ?? [];
    const latestOutcome = items.find(row => ["OUTCOME_REPORTED", "OUTCOME_RETURNED"].includes(row.kind));
    const rows = latestOutcome
      ? [latestOutcome, ...items.filter(row => row.id !== latestOutcome.id)].slice(0, 3)
      : items.slice(0, 3);
    cards.forEach((card, index) => {
      const row = rows[index];
      setLaneCard(
        card,
        row ? formatV197ControlledToken(row.kind, uiSource("Owner timeline")) : uiCopy("owner timeline"),
        row?.title ?? uiCopy("No event"),
        row ? shorten(row.body, 80) : uiCopy("No persisted event in this slot."),
      );
    });
    lane.setAttribute("aria-label", uiCopy("Owner timeline summary"));
    return;
  }

  if (focus === "orbits") {
    const social = [
      ...(snapshot.live?.people_orbits ?? []),
      ...(snapshot.live?.group_orbits ?? []),
    ].slice(0, 3);
    const projects = snapshot.projects?.projects.slice(0, 3) ?? [];
    const occupied = social.length + projects.length;
    const rows = (snapshot.orbits?.orbits ?? []).filter(
      row => row.kind !== "PERSONAL_BRIDGE" && !["PERSON", "GROUP", "COUNCIL", "COMMUNITY"].includes(row.kind),
    ).slice(0, Math.max(0, 3 - occupied));
    cards.forEach((card, index) => {
      const socialOrbit = social[index];
      if (socialOrbit) {
        setLaneCard(
          card,
          uiFormat("{0} · owner social ledger", [formatV197ControlledToken(
            socialOrbit.kind ?? "ORBIT",
            uiSource("Orbit"),
          )]),
          recordTitle(socialOrbit, uiCopy("Social Orbit")),
          uiFormat("{0} unresolved · {1} shared goals", [Number(socialOrbit.unresolved_count ?? 0), Number(socialOrbit.shared_goal_count ?? 0)]),
        );
        return;
      }
      const project = projects[index - social.length];
      if (project) {
        const taskCount = Object.values(project.task_counts).reduce((sum, value) => sum + value, 0);
        setLaneCard(card, uiFormat("AM Project · {0}", [formatV197ControlledToken(
          project.status,
          uiSource("Project status"),
        )]), project.title, uiFormat("{0} tasks · {1} verified evidence", [taskCount, project.verified_evidence]));
        return;
      }
      const row = rows[index - occupied];
      const held = row ? Object.values(row.counts).reduce((sum, value) => sum + value, 0) : 0;
      setLaneCard(
        card,
        row ? formatV197ControlledToken(row.kind, uiSource("Project orbit")) : uiCopy("project orbit"),
        row?.title ?? uiCopy("No Orbit"),
        row ? uiFormat("{0} held objects · {1}", [held, formatV197ControlledToken(
          row.status,
          uiSource("Orbit status"),
        )]) : uiCopy("No persisted Orbit in this slot."),
      );
    });
    lane.setAttribute("aria-label", uiCopy("Owner Orbits summary"));
    return;
  }

  if (focus === "insights") {
    const insight = snapshot.insights;
    setLaneCard(cards[0], uiCopy("candidate claims"), number(insight?.counts.claims), uiCopy("owner-only Omega ledger"));
    setLaneCard(cards[1], uiCopy("open contradictions"), number(insight?.counts.open_contradictions), uiCopy("needs review"));
    setLaneCard(cards[2], uiCopy("review queue"), number(insight?.counts.review_queue), uiCopy("no automatic promotion"));
    lane.setAttribute("aria-label", uiCopy("Owner insight summary"));
    return;
  }

  if (focus === "community") {
    const rooms = (snapshot.communityRooms ?? []).filter(room => room.status === "ACTIVE");
    cards.forEach((card, index) => {
      const room = rooms[index];
      setLaneCard(
        card,
        room ? uiFormat("{0} room", [formatV197ControlledToken(room.room_kind, uiSource("Room"))]) : uiCopy("bounded rooms"),
        room ? uiFormat("{0}{1}", [room.title, room.is_demo ? (" " + uiCopy("· DEMO") + "") : ""]) : uiCopy("No room"),
        room ? uiFormat("your role {0} · member content only", [formatV197ControlledToken(
          room.current_user_role,
          uiSource("Member"),
        )]) : uiCopy("No persisted room in this slot."),
      );
    });
    lane.setAttribute("aria-label", uiCopy("Persisted community rooms"));
    return;
  }

  if (focus === "research" || focus === "web") {
    const briefs = snapshot.researchBriefs.slice(0, 3);
    cards.forEach((card, index) => {
      const row = briefs[index];
      setLaneCard(
        card,
        row
          ? formatV197ControlledToken(
              focus === "research" ? row.status : row.provider_status,
              focus === "research" ? uiSource("Research status") : uiSource("Provider state"),
            )
          : focus === "research" ? uiCopy("owner research") : uiCopy("web provider"),
        row?.question ?? (focus === "research" ? uiCopy("No staged question") : uiCopy("No fetched signal")),
        row
          ? (row.summary || (focus === "research" ? uiCopy("Held without invented sources.") : uiCopy("No external result is presented as fetched.")))
          : uiCopy("No persisted record in this slot."),
      );
    });
    lane.setAttribute(
      "aria-label",
      focus === "research" ? uiCopy("Owner research summary") : uiCopy("Owner web-signal staging summary"),
    );
    return;
  }

  const counts = snapshot.map?.counts ?? [];
  const scoreboard = snapshot.scoreboard?.rows.slice(0, 3) ?? [];
  cards.forEach((card, index) => {
    const score = scoreboard[index];
    const row = counts[index];
    setLaneCard(
      card,
      score ? uiFormat("System rank {0}", [score.rank]) : row?.label ?? uiCopy("owner ledger"),
      score ? coreSystemCopy(score.system_title) : number(row?.count),
      score ? uiFormat("{0} persisted Glow", [score.score]) : row ? uiCopy("persisted private data") : uiCopy("No persisted count in this slot."),
    );
  });
  lane.setAttribute("aria-label", uiCopy("Owner map summary"));
}

function renderInsight(document: Document, snapshot: V197BridgeSnapshot): void {
  const insights = snapshot.insights;
  const claim = primaryInsight(snapshot);
  const contradiction = insights?.contradictions[0];
  const claimText = typeof claim?.claim_text === "string" ? claim.claim_text : null;
  const confidence = typeof claim?.confidence === "number"
    ? uiFormat("{0}% confidence", [Math.round(claim.confidence * 100)])
    : uiCopy("awaiting owner evidence");
  const claimCount = typeof insights?.counts.claims === "number" ? insights.counts.claims : insights?.claims.length ?? 0;
  const contradictionCount = typeof insights?.counts.open_contradictions === "number"
    ? insights.counts.open_contradictions
    : insights?.contradictions.length ?? 0;
  const predictionCount = typeof insights?.counts.predictions === "number"
    ? insights.counts.predictions
    : insights?.predictions.length ?? 0;
  const reviewCount = typeof insights?.counts.review_queue === "number"
    ? insights.counts.review_queue
    : insights?.review_queue.length ?? 0;
  const openStep = snapshot.plans.flatMap(plan => plan.steps).find(step => !step.done);
  const latestEvent = snapshot.timeline?.items[0];

  ownText(document.querySelector(".system-badge"), uiCopy("Candidate insight"));
  text(document.querySelector(".universe-insight-title small"), claimText ? uiCopy("Candidate claim") : uiCopy("Evidence state"));
  text(document.querySelector(".universe-insight-title h2"), claimText ?? uiCopy(NO_RELIABLE_INSIGHT));
  text(
    document.querySelector(".universe-insight-copy"),
    claimText
      ? uiFormat("Inferred from the owner ledger · {0}.", [confidence])
      : uiCopy("More owner evidence across time or domains is required before NUR surfaces one."),
  );
  const contradictionText = typeof contradiction?.description === "string"
    ? contradiction.description
    : uiCopy("No open contradiction is persisted.");
  text(document.querySelector(".insight-uncertainty span"), uiCopy("Open contradiction"));
  text(document.querySelector(".insight-uncertainty p"), contradictionText);
  const signals = [
    uiFormat("{0} candidate {1}", [claimCount, claimCount === 1 ? uiCopy("claim") : uiCopy("claims")]),
    uiFormat("{0} open {1}", [contradictionCount, contradictionCount === 1 ? uiCopy("contradiction") : uiCopy("contradictions")]),
    uiFormat("{0} unresolved {1}", [predictionCount, predictionCount === 1 ? uiCopy("prediction") : uiCopy("predictions")]),
  ];
  document.querySelectorAll<HTMLElement>(".signal-list span").forEach((slot, index) => {
    slot.textContent = signals[index] ?? uiCopy("No additional persisted signal");
  });
  text(document.querySelector(".insight-opportunity small"), uiCopy("Next persisted move"));
  text(document.querySelector(".insight-opportunity b"), openStep?.title ?? uiCopy("No persisted next move yet."));
  text(document.querySelector(".insight-strength span"), uiCopy("Persisted claims"));
  text(document.querySelector(".insight-strength b"), String(claimCount));
  const decorativeStrengthBar = document.querySelector<HTMLElement>(".insight-strength i");
  if (decorativeStrengthBar) {
    decorativeStrengthBar.hidden = true;
    decorativeStrengthBar.style.display = "none";
  }
  text(document.querySelector(".insight-evidence small"), uiCopy("Owner evidence"));
  text(document.querySelector(".insight-evidence b"), uiFormat("{0} persisted events", [snapshot.timeline?.items.length ?? 0]));
  text(
    document.querySelector(".insight-evidence span"),
    formatV197ControlledToken(insights?.provenance_label, uiSource("Owner ledger")),
  );
  text(
    document.querySelector(".insight-revision span"),
    latestEvent ? uiFormat("Latest persisted change: {0}.", [latestEvent.title]) : uiFormat("No persisted revision yet · {0} awaiting review.", [reviewCount]),
  );
  text(document.querySelector(".live-label"), uiCopy("OWNER LEDGER"));
  ensureUniversePortal(document, ".candidate-insight", uiCopy("Review candidates"), "insights");
}

function makeHonestResult(document: Document, mark: string, title: string, detail: string): HTMLElement {
  const article = document.createElement("article");
  const icon = document.createElement("i");
  icon.textContent = mark;
  const copy = document.createElement("div");
  const heading = document.createElement("b");
  heading.textContent = title;
  const body = document.createElement("span");
  body.textContent = detail;
  const status = document.createElement("small");
  status.textContent = uiCopy("Local owner ledger · no invented external data");
  copy.append(heading, body, status);
  article.append(icon, copy);
  return article;
}

function ensureResearchStaging(document: Document, host: HTMLElement, results: HTMLElement | null): void {
  if (host.querySelector("#research-staging")) return;
  const staging = document.createElement("section");
  staging.id = "research-staging";
  staging.setAttribute("aria-labelledby", "research-staging-title");
  const title = document.createElement("h3");
  title.id = "research-staging-title";
  title.textContent = uiCopy("Stage a local question");
  const note = document.createElement("p");
  note.textContent = uiCopy("Saved to your owner ledger. No external source or citation is invented.");
  const input = document.createElement("textarea");
  input.id = "research-query";
  input.rows = 2;
  input.maxLength = 4000;
  input.placeholder = uiCopy("What should NUR hold for later evidence?");
  input.setAttribute("aria-label", uiCopy("Research question"));
  const submit = document.createElement("button");
  submit.type = "button";
  submit.dataset.researchSubmit = "true";
  submit.textContent = uiCopy("Save local question");
  staging.append(title, note, input, submit);
  if (results) results.before(staging);
  else host.append(staging);
}

function renderResearch(document: Document, snapshot: V197BridgeSnapshot): void {
  let host = document.querySelector<HTMLElement>("#universe-research");
  if (!host) {
    const systems = document.querySelector<HTMLElement>("#page-systems");
    const insertionPoint = systems?.querySelector<HTMLElement>(".universe-lower-grid") ?? systems;
    if (insertionPoint) {
      host = document.createElement("section");
      host.id = "universe-research";
      host.className = "universe-card";
      const head = document.createElement("div");
      head.className = "universe-card-head";
      const heading = document.createElement("h2");
      const results = document.createElement("div");
      results.className = "research-results";
      head.append(heading);
      host.append(head, results);
      insertionPoint.append(host);
    }
  }
  if (!host) return;
  text(host.querySelector(".universe-card-head h2"), uiCopy("Research evidence, held honestly."));
  const results = host.querySelector<HTMLElement>(".research-results");
  ensureResearchStaging(document, host, results);
  if (results) {
    empty(results);
    if (snapshot.researchBriefs.length === 0) {
      results.append(makeHonestResult(
        document,
        "⌕",
        uiCopy("No persisted research question yet."),
        uiCopy("Stage a local question below; no external source is invented."),
      ));
    } else {
      snapshot.researchBriefs.slice(0, 2).forEach(row => {
        results.append(makeHonestResult(
          document,
          uiCopy("R"),
          row.question,
          row.summary || uiFormat("Status: {0} · provider {1}", [
            formatV197ControlledToken(row.status, uiSource("Research status")),
            formatV197ControlledToken(row.provider_status, uiSource("Provider state")),
          ]),
        ));
      });
    }
  }
  ensureUniversePortal(document, "#universe-research", uiCopy("Open Research"), "research");
}

function ensureUniversePortal(
  document: Document,
  hostSelector: string,
  label: string,
  focus: string,
): void {
  const host = document.querySelector<HTMLElement>(hostSelector);
  if (!host) return;
  const head = host.querySelector<HTMLElement>(".universe-card-head") ?? host;
  let control = host.querySelector<HTMLButtonElement>("[data-nur-universe-portal]")
    ?? head.querySelector<HTMLButtonElement>(":scope > .tiny-link");
  if (!control) {
    control = document.createElement("button");
    control.type = "button";
    control.className = "tiny-link";
    head.append(control);
  }
  control.dataset.nurUniversePortal = "true";
  control.textContent = uiFormat("{0} →", [label]);
  control.disabled = false;
  control.removeAttribute("aria-disabled");
  control.removeAttribute("data-action");
  control.removeAttribute("data-research-submit");
  control.dataset.worldFocus = focus;
}

function renderCommunity(document: Document, snapshot: V197BridgeSnapshot): void {
  const rooms = (snapshot.communityRooms ?? []).filter(room => room.status === "ACTIVE");
  let host = document.querySelector<HTMLElement>("#universe-community");
  if (!host) {
    const systems = document.querySelector<HTMLElement>("#page-systems");
    const insertionPoint = systems?.querySelector<HTMLElement>(".universe-lower-grid") ?? systems;
    if (insertionPoint) {
      host = document.createElement("section");
      host.id = "universe-community";
      host.className = "universe-card";
      const head = document.createElement("div");
      head.className = "universe-card-head";
      const heading = document.createElement("h2");
      head.append(heading);
      const items = document.createElement("div");
      items.className = "community-items";
      host.append(head, items);
      insertionPoint.append(host);
    }
  }
  if (!host) return;
  text(
    host.querySelector(".universe-card-head h2"),
    rooms.length
      ? uiFormat("{0} bounded {1} · persisted Group NUR.", [rooms.length, rooms.length === 1 ? uiCopy("room") : uiCopy("rooms")])
      : uiCopy("No rooms yet. Create one bounded room to open Group NUR."),
  );
  const community = host.querySelector<HTMLElement>(".community-items");
  if (community) {
    empty(community);
    if (rooms.length === 0) {
      community.append(makeHonestResult(
        document,
        "◎",
        uiCopy("No fake people, replies, or rooms."),
        uiCopy("Rooms hold only explicitly shared content; private Talk, Journal, Timeline, and Omega stay sealed."),
      ));
    }
    rooms.slice(0, 2).forEach(room => {
      community.append(makeHonestResult(
        document,
        room.room_kind === "COUNCIL" ? "⚖" : "◉",
        uiFormat("{0}{1}", [room.title, room.is_demo ? (" " + uiCopy("· DEMO") + "") : ""]),
        uiFormat("{0} room · your role {1} · member content only", [
          formatV197ControlledToken(room.room_kind, uiSource("Room")),
          formatV197ControlledToken(room.current_user_role, uiSource("Member")),
        ]),
      ));
    });
  }
  document.getElementById("nur-v197-community-controls")?.remove();
  ensureUniversePortal(document, "#universe-community", uiCopy("Open Community"), "community");
  document.querySelectorAll<HTMLElement>("[data-community-tab]").forEach(control => {
    control.setAttribute("aria-disabled", "true");
    if (control.tagName === "BUTTON") (control as HTMLButtonElement).disabled = true;
    control.setAttribute("title", uiCopy("Public community feeds stay disconnected; only your persisted rooms are shown."));
  });

  const council = (snapshot.communityRooms ?? []).find(room => room.room_kind === "COUNCIL" && room.status === "ACTIVE");
  text(
    document.querySelector("#universe-consult .universe-card-head h2"),
    council ? uiFormat("Council: {0}", [council.title]) : uiCopy("No Consultation is open yet."),
  );
  text(
    document.querySelector("#universe-consult .consultation-question p"),
    council
      ? uiCopy("This bounded Council can hold real positions, evidence and an owner-recorded return.")
      : uiCopy("Open the Consultation chamber to gather real context, evidence and one owned return."),
  );
  ensureUniversePortal(document, "#universe-consult", uiCopy("Open Consultation"), "consult");
}

function renderHonestDisabledSurfaces(document: Document): void {
  document.querySelectorAll<HTMLElement>("[data-stage], .consultation-question button").forEach(control => {
    control.setAttribute("aria-disabled", "true");
    if (control.tagName === "BUTTON") (control as HTMLButtonElement).disabled = true;
  });
  const editDirection = document.querySelector<HTMLButtonElement>("#page-plan .panel-top .tiny-link:not([data-page])");
  editDirection?.remove();
}

export function hydrateTrackAV197(document: Document, snapshot: V197BridgeSnapshot): void {
  const locale = snapshot.preferences?.locale ?? snapshot.session.profile.locale ?? "en";
  const writingPreference = snapshot.preferences?.writing_preference ?? snapshot.session.profile.writing_preference ?? "default";
  applyV197Locale(document, locale, writingPreference);
  hydrateReadOnlyV197(document, snapshot);
  renderTalk(document, snapshot.talkThread);
  renderToday(document, snapshot);
  renderJournal(document, snapshot);
  renderPlans(document, snapshot.plans);
  renderSystems(document, snapshot);
  renderInsight(document, snapshot);
  // The Live Universe aggregate paints the state strip first; an explicitly
  // selected System then owns it, so System evidence is never hidden behind
  // the aggregate view (the universe lens re-renders it on focus).
  renderLiveUniverse(document, snapshot);
  renderSelectedSystem(document, snapshot);
  renderResearch(document, snapshot);
  renderCommunity(document, snapshot);
  renderHonestDisabledSurfaces(document);
  renderPersistedGlow(document, snapshot.glow);
  text(document.querySelector('[data-thread-action="glow"]'), uiCopy("Glow this persisted Talk"));
  const latestUserTalk = [...snapshot.talkThread].reverse().find(row => row.who === "user" && row.text);
  const miniThread = document.querySelector("#page-today .mini-thread");
  text(miniThread, latestUserTalk?.text ? uiFormat("“{0}”", [shorten(latestUserTalk.text, 170)]) : uiCopy("No persisted Talk signal yet."));
  if (latestUserTalk?.text) markVerbatimUserContent(miniThread);
}
