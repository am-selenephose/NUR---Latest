import { uiCopy, uiFormat, uiSource } from "../lib/i18n";

const REWARDS_COPY = {
  persisted: uiSource("persisted"),
  today: uiSource("today"),
  yesterday: uiSource("yesterday"),
  orbitSeed: uiSource("Orbit Seed"),
  noPersistedGlowCompleteAction: uiSource("No persisted Glow yet. Complete one real action."),
  noPersistedGlow: uiSource("No persisted Glow yet."),
  principle: uiSource("Glow Points move only after the server confirms a real action."),
} as const;

const GLOW_EVENT_REASON_COPY: Record<string, ReturnType<typeof uiSource>> = {
  daily_checkin: uiSource("A persisted private daily check-in."),
  talk_meaningful: uiSource("A persisted meaningful Talk turn."),
  journal_saved: uiSource("A persisted Journal entry."),
  plan_created: uiSource("A persisted Plan."),
  plan_step_completed: uiSource("A completed owned Plan step."),
  task_made_smaller: uiSource("A Plan step reduced to a more workable move."),
  outcome_returned: uiSource("A persisted real-world outcome."),
  "goal.created": uiSource("A persisted owner Goal."),
  "objective.created": uiSource("A persisted Goal objective."),
  "schedule.created": uiSource("A persisted scheduled action."),
  "system.checklist_answered": uiSource("A persisted Star System diagnostic."),
  "system.action_marked": uiSource("A completed persisted Star System action."),
  missed_step_returned: uiSource("A missed action returned to movement."),
  "feasibility.created": uiSource("A persisted feasibility assessment."),
  "project.created": uiSource("A persisted AM Project with an explicit objective."),
  "project.task_completed": uiSource("A persisted AM Project task passed its completion gate."),
  "project.evidence_verified": uiSource("Persisted AM Project evidence passed verification."),
  "community.message_posted": uiSource("A persisted meaningful Group NUR message."),
  "community.post_created": uiSource("A persisted Community post."),
  "community.comment_created": uiSource("A persisted Community comment or reply."),
  "council.position_added": uiSource("A persisted Council position with its evidence."),
  "council.decision_recorded": uiSource("A persisted Council decision by the room owner."),
  consultation_return: uiSource("Return a real bounded Consultation with a persisted outcome."),
  "quest.daily_claimed": uiSource("A completed persisted daily quest claimed by its owner."),
  "quest.weekly_claimed": uiSource("A completed persisted weekly mission claimed by its owner."),
};

export function formatV197GlowEventReason(eventType: string): string {
  return uiCopy(
    GLOW_EVENT_REASON_COPY[eventType.trim().toLowerCase()]
      ?? uiSource("Recorded Glow event"),
  );
}

export type V197GlowTransaction = {
  id: string;
  event_type: string;
  source_kind: string;
  source_id: string;
  system_slug?: string | null;
  final_points: number;
  reason: string;
  created_at: string;
};

export type V197GlowStreak = {
  streak_key: string;
  current_count: number;
  best_count: number;
  last_event_date: string | null;
  repairs_remaining: number;
};

export type V197GlowSummary = {
  balance: number;
  lifetime_points: number;
  today_points?: number;
  weekly_points?: number;
  level?: number;
  rank?: string;
  next_unlock?: { level: number; rank: string; threshold: number; points_remaining: number } | null;
  recent_transactions: V197GlowTransaction[];
  streaks: V197GlowStreak[];
  achievements?: Array<{
    achievement_key: string;
    achievement_metadata: Record<string, unknown>;
    unlocked_at: string;
  }>;
  daily_quest?: Record<string, unknown>;
  weekly_mission?: Record<string, unknown>;
};

export type V197GlowAward = {
  awarded_points: number;
  balance: number;
  lifetime_points: number;
  idempotent_replay: boolean;
  streak: V197GlowStreak | null;
  achievements_unlocked?: string[];
};

function timeLabel(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return uiCopy(REWARDS_COPY.persisted);
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return uiCopy(REWARDS_COPY.today);
  if (days === 1) return uiCopy(REWARDS_COPY.yesterday);
  return uiFormat("{0} days", [days]);
}

function empty(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function makeTodayRow(document: Document, transaction: V197GlowTransaction): HTMLElement {
  const row = document.createElement("div");
  row.className = "glow-item";
  row.dataset.glowTransactionId = transaction.id;

  const icon = document.createElement("span");
  icon.className = "glow-icon nur-v136-v89-mini-host";
  const description = document.createElement("span");
  description.textContent = uiFormat("{0} · +{1}", [formatV197GlowEventReason(transaction.event_type), transaction.final_points]);
  const time = document.createElement("time");
  time.textContent = timeLabel(transaction.created_at);
  row.append(icon, description, time);
  return row;
}

function makeRailRow(document: Document, transaction: V197GlowTransaction): HTMLButtonElement {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "v172-glow-row";
  row.dataset.glowTransactionId = transaction.id;
  row.disabled = true;

  const icon = document.createElement("span");
  icon.textContent = "✦";
  const copy = document.createElement("div");
  const title = document.createElement("b");
  title.textContent = uiFormat("{0} · +{1}", [formatV197GlowEventReason(transaction.event_type), transaction.final_points]);
  const detail = document.createElement("small");
  detail.textContent = uiFormat("Persisted · {0}", [timeLabel(transaction.created_at)]);
  copy.append(title, detail);
  row.append(icon, copy);
  return row;
}

/** Renders only values returned by the persisted Glow ledger. */
export function renderPersistedGlow(
  document: Document,
  summary: V197GlowSummary,
  afterRender?: () => void,
): void {
  // Hydration must never impersonate a fresh reward animation.
  void afterRender;
  const primaryStreak = summary.streaks[0];
  const todayPanel = document.querySelector<HTMLElement>("#page-today .glow-row");
  const todayHeading = document.querySelector<HTMLElement>("#page-today .today-grid > aside .panel-title");
  const todaySub = document.querySelector<HTMLElement>("#page-today .today-grid > aside .panel-sub");

  if (todayHeading) todayHeading.textContent = uiFormat("{0} Glow Points · Level {1}", [summary.balance, summary.level ?? 1]);
  if (todaySub) {
    todaySub.textContent = primaryStreak
      ? uiFormat("{0} today · {1} this week · {2} day streak", [summary.today_points ?? 0, summary.weekly_points ?? 0, primaryStreak.current_count])
      : uiFormat("{0} today · {1} this week · {2}", [summary.today_points ?? 0, summary.weekly_points ?? 0, summary.rank ?? uiCopy(REWARDS_COPY.orbitSeed)]);
  }
  if (todayPanel) {
    empty(todayPanel);
    if (summary.recent_transactions.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "glow-item";
      emptyState.textContent = uiCopy(REWARDS_COPY.noPersistedGlowCompleteAction);
      todayPanel.append(emptyState);
    } else {
      summary.recent_transactions.slice(0, 3).forEach(transaction => {
        todayPanel.append(makeTodayRow(document, transaction));
      });
    }
  }

  const railCard = document.querySelector<HTMLElement>(".v172-glow-list, .clean-glows-card");
  const railHeading = railCard?.querySelector<HTMLElement>(".clean-card-heading > span");
  if (railHeading) {
    railHeading.textContent = primaryStreak
      ? uiFormat("Recent Glows · {0} · {1} · {2} day streak", [summary.balance, summary.rank ?? uiCopy(REWARDS_COPY.orbitSeed), primaryStreak.current_count])
      : uiFormat("Recent Glows · {0} · {1}", [summary.balance, summary.rank ?? uiCopy(REWARDS_COPY.orbitSeed)]);
  }
  if (railCard) {
    railCard.querySelectorAll(".v172-glow-row, .clean-glow-list > *").forEach(node => node.remove());
    const railContainer = railCard.querySelector<HTMLElement>(".clean-glow-list") ?? railCard;
    summary.recent_transactions.slice(0, 3).forEach(transaction => {
      railContainer.append(makeRailRow(document, transaction));
    });
    if (summary.recent_transactions.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "context-title";
      emptyState.textContent = uiCopy(REWARDS_COPY.noPersistedGlow);
      railContainer.append(emptyState);
    }
  }

  const principle = document.querySelector<HTMLElement>(".v172-glow-principle .context-title");
  if (principle) principle.textContent = uiCopy(REWARDS_COPY.principle);
}

export function announcePersistedGlow(document: Document, award: V197GlowAward): void {
  if (award.idempotent_replay) return;
  const universeWindow = document.defaultView as (Window & { nurToast?: (message: string) => void }) | null;
  universeWindow?.nurToast?.(uiFormat("+{0} Glow · {1} total", [award.awarded_points, award.balance]));
  const star = document.querySelector<HTMLElement>("#iSpark");
  star?.click();
}
