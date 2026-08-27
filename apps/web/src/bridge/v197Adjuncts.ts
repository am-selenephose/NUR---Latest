import {
  V197ApiClient,
  V197ApiError,
  type V197BillingPlan,
  type V197BillingState,
  type V197BridgeSnapshot,
  type V197CapsuleAnswer,
  type V197CapsuleView,
  type V197CommunityPost,
  type V197ConsultationDetail,
  type V197Memory,
  type V197MemoryCandidate,
  type V197MemorySensitivity,
  type V197MemoryType,
  type V197OwnedCapsule,
  type V197Session,
  type V197TeachNURContribution,
  type V197TeachNURContributionKind,
} from "./v197ApiClient";
import { applyV197Locale, directionForPreference, V197_LOCALE_META, type WritingPreference } from "./v197I18n";
import V197_ADJUNCT_FORENSIC_CSS from "../styles/v197-adjunct-forensic.css?raw";
import { markV197HolographicWordmark } from "./v197Brand";
import { createV197StarSeal } from "./v197StarSeal";
import {
  DRAWER_SECTIONS,
  buildApprovalCard,
  describeRisk,
  groupWorkflows,
  resolveApprovalEditor,
  type AgenticRiskClass,
  type V197AgenticPolicy,
  type V197AgenticWorkflow,
} from "./v197Agentic";
import {
  activeUiLocale,
  setVerbatimUserText,
  structuralValue,
  type UiCopyKey,
  uiCopy,
  uiFormat,
  uiSource,
} from "../lib/i18n";
import { visibleV197Failure } from "./v197FailureCopy";
import { formatV197GlowEventReason } from "./v197Rewards";

const ROOT_ID = "nur-v197-adjunct-root";
const STYLE_ID = "nur-v197-adjunct-style";
const AGENTIC_DETAIL_POLL_MS = 1_500;
const agenticDetailPollStops = new WeakMap<Document, () => void>();
const MEMORY_TYPES: readonly V197MemoryType[] = [
  "EPISODIC",
  "SEMANTIC",
  "PROCEDURAL",
  "SOCIAL",
  "EVIDENCE",
  "SELF",
  "GOAL",
  "META_COGNITIVE",
  "ADAPTIVE_INTERFACE",
];
const MEMORY_SENSITIVITIES: readonly V197MemorySensitivity[] = ["LOW", "PRIVATE", "SENSITIVE"];
const TEACH_NUR_KINDS: readonly V197TeachNURContributionKind[] = [
  "FACT",
  "LIVED_EXPERIENCE",
  "CORRECTION",
  "COUNTEREXAMPLE",
  "LANGUAGE",
  "RESEARCH",
  "EXPERTISE",
  "MISUNDERSTANDING",
  "OUTCOME_EVIDENCE",
];
type AdjunctBackgroundState = {
  previousFocus: HTMLElement | null;
  siblings: Map<HTMLElement, { inert: boolean; ariaHidden: string | null }>;
};
const adjunctBackgrounds = new WeakMap<Document, AdjunctBackgroundState>();
const ADJUNCT_COPY = {
  notRecorded: uiSource("Not recorded"),
  noExpiry: uiSource("No expiry"),
  free: uiSource("Free"),
  liveUniverse: uiSource("Live Universe"),
  candidates: uiSource("Candidates"),
  consultation: uiSource("Consultation"),
  community: uiSource("Community"),
  episodic: uiSource("Episodic"),
  semantic: uiSource("Semantic"),
  procedural: uiSource("Procedural"),
  social: uiSource("Social"),
  evidence: uiSource("Evidence"),
  self: uiSource("Self"),
  goal: uiSource("Goal"),
  metaCognitive: uiSource("Meta-cognitive"),
  adaptiveInterface: uiSource("Adaptive interface"),
  low: uiSource("Low"),
  private: uiSource("Private"),
  sensitive: uiSource("Sensitive"),
  fact: uiSource("Fact"),
  livedExperience: uiSource("Lived experience"),
  correction: uiSource("Correction"),
  counterexample: uiSource("Counterexample"),
  language: uiSource("Language"),
  research: uiSource("Research"),
  expertise: uiSource("Expertise"),
  misunderstanding: uiSource("Misunderstanding"),
  outcomeEvidence: uiSource("Outcome evidence"),
  privateOwnerRetrieval: uiSource("Private owner retrieval only"),
  deidentifiedResearchReview: uiSource("Deidentified research review"),
  practicalMove: uiSource("Practical move"),
  constraint: uiSource("Constraint"),
  disagreement: uiSource("Disagreement"),
  witness: uiSource("Witness"),
  triedThis: uiSource("Tried this"),
  outcome: uiSource("Outcome"),
  expertVoice: uiSource("Expert voice"),
  quietAmbition: uiSource("Quiet Ambition"),
  rebuild: uiSource("Rebuild"),
  study: uiSource("Study"),
  money: uiSource("Money"),
  body: uiSource("Body"),
  connection: uiSource("Connection"),
  creation: uiSource("Creation"),
  quiet: uiSource("Quiet"),
  balanced: uiSource("Balanced"),
  active: uiSource("Active"),
  languageDefault: uiSource("Language default"),
  romanWriting: uiSource("Roman writing"),
  nativeScript: uiSource("Native script"),
  terms: uiSource("Terms"),
  privacy: uiSource("Privacy"),
  refundPolicy: uiSource("Refund policy"),
  readApprovedSourcesOnly: uiSource("Read approved sources only"),
  askScopedQuestions: uiSource("Ask scoped questions"),
  withheldByOwner: uiSource("Withheld by the owner"),
  unresolved: uiSource("UNRESOLVED"),
  ownerReviewFinalAuthority: uiSource("Owner review remains the final authority."),
  boundedGroupRoom: uiSource("A bounded Group NUR room."),
  unassignedSystem: uiSource("unassigned system"),
  acceptanceCriteriaNotSet: uiSource("Acceptance criteria not set"),
  noNote: uiSource("No note"),
  file: uiSource("file"),
  quarantinedDownloadBlocked: uiSource("Quarantined; download blocked."),
  nextConstellation: uiSource("next constellation"),
  inAppOnly: uiSource("IN_APP_ONLY"),
  noDetailRecorded: uiSource("No detail recorded"),
  structuredOwnerEvidence: uiSource("Structured owner evidence"),
  overview: uiSource("Overview"),
  tasks: uiSource("Tasks"),
  agentProposals: uiSource("Agent proposals"),
  runs: uiSource("Runs"),
  deliverables: uiSource("Deliverables"),
} as const;
const MEMORY_TYPE_LABELS: Readonly<Record<V197MemoryType, UiCopyKey>> = {
  EPISODIC: ADJUNCT_COPY.episodic,
  SEMANTIC: ADJUNCT_COPY.semantic,
  PROCEDURAL: ADJUNCT_COPY.procedural,
  SOCIAL: ADJUNCT_COPY.social,
  EVIDENCE: ADJUNCT_COPY.evidence,
  SELF: ADJUNCT_COPY.self,
  GOAL: ADJUNCT_COPY.goal,
  META_COGNITIVE: ADJUNCT_COPY.metaCognitive,
  ADAPTIVE_INTERFACE: ADJUNCT_COPY.adaptiveInterface,
};
const MEMORY_SENSITIVITY_LABELS: Readonly<Record<V197MemorySensitivity, UiCopyKey>> = {
  LOW: ADJUNCT_COPY.low,
  PRIVATE: ADJUNCT_COPY.private,
  SENSITIVE: ADJUNCT_COPY.sensitive,
};
const TEACH_NUR_KIND_LABELS: Readonly<Record<V197TeachNURContributionKind, UiCopyKey>> = {
  FACT: ADJUNCT_COPY.fact,
  LIVED_EXPERIENCE: ADJUNCT_COPY.livedExperience,
  CORRECTION: ADJUNCT_COPY.correction,
  COUNTEREXAMPLE: ADJUNCT_COPY.counterexample,
  LANGUAGE: ADJUNCT_COPY.language,
  RESEARCH: ADJUNCT_COPY.research,
  EXPERTISE: ADJUNCT_COPY.expertise,
  MISUNDERSTANDING: ADJUNCT_COPY.misunderstanding,
  OUTCOME_EVIDENCE: ADJUNCT_COPY.outcomeEvidence,
};
const CONSULTATION_CONTRIBUTION_OPTIONS = [
  ["LIVED_EXPERIENCE", ADJUNCT_COPY.livedExperience],
  ["PRACTICAL_MOVE", ADJUNCT_COPY.practicalMove],
  ["CONSTRAINT", ADJUNCT_COPY.constraint],
  ["COUNTEREXAMPLE", ADJUNCT_COPY.counterexample],
  ["DISAGREEMENT", ADJUNCT_COPY.disagreement],
  ["WITNESS", ADJUNCT_COPY.witness],
  ["TRIED_THIS", ADJUNCT_COPY.triedThis],
  ["OUTCOME", ADJUNCT_COPY.outcome],
  ["EXPERT_VOICE", ADJUNCT_COPY.expertVoice],
  ["RESEARCH_EVIDENCE", ADJUNCT_COPY.research],
] as const;
const PROJECT_SYSTEM_OPTIONS = [
  ["quiet-ambition", ADJUNCT_COPY.quietAmbition],
  ["rebuild", ADJUNCT_COPY.rebuild],
  ["study", ADJUNCT_COPY.study],
  ["money", ADJUNCT_COPY.money],
  ["body", ADJUNCT_COPY.body],
  ["connection", ADJUNCT_COPY.connection],
  ["creation", ADJUNCT_COPY.creation],
] as const;
const WRITING_OPTIONS = [
  ["default", ADJUNCT_COPY.languageDefault],
  ["roman", ADJUNCT_COPY.romanWriting],
  ["script", ADJUNCT_COPY.nativeScript],
] as const;
const TEACH_SCOPE_OPTIONS = [
  ["PRIVATE_OWNER", ADJUNCT_COPY.privateOwnerRetrieval],
  ["DEIDENTIFIED_RESEARCH", ADJUNCT_COPY.deidentifiedResearchReview],
] as const;
const NOTIFICATION_FREQUENCY_OPTIONS = [
  ["QUIET", ADJUNCT_COPY.quiet],
  ["BALANCED", ADJUNCT_COPY.balanced],
  ["ACTIVE", ADJUNCT_COPY.active],
] as const;
const CAPSULE_CAPABILITY_OPTIONS = [
  ["READ_ONLY", ADJUNCT_COPY.readApprovedSourcesOnly],
  ["ASK_SCOPED_QUESTIONS", ADJUNCT_COPY.askScopedQuestions],
] as const;
const PROJECT_TAB_OPTIONS = [
  ["overview", ADJUNCT_COPY.overview],
  ["tasks", ADJUNCT_COPY.tasks],
  ["evidence", ADJUNCT_COPY.evidence],
  ["agents", ADJUNCT_COPY.agentProposals],
  ["runs", ADJUNCT_COPY.runs],
  ["deliverables", ADJUNCT_COPY.deliverables],
] as const;
const BILLING_PLAN_COPY: Readonly<Record<string, { name: UiCopyKey; description: UiCopyKey }>> = {
  orbit_scan_free: {
    name: uiSource("Orbit Scan Free"),
    description: uiSource("Private orientation and a grounded first next step."),
  },
  founding_orbit: {
    name: uiSource("Founding Orbit"),
    description: uiSource("Annual founder cohort access. Limited to the first 50 real paid seats."),
  },
  nur_plus_monthly: {
    name: uiSource("NUR Plus"),
    description: uiSource("Monthly personal continuity, full galaxy, planning, and reflections."),
  },
  nur_plus_annual: {
    name: uiSource("Annual Plus"),
    description: uiSource("Annual personal continuity, full galaxy, planning, and reflections."),
  },
};
const BILLING_FEATURE_COPY: Readonly<Record<string, UiCopyKey>> = {
  "ai.daily_requests": uiSource("Daily intelligence requests"),
  orbit_scan: uiSource("Orbit Scan"),
  paid_continuity: uiSource("Paid continuity"),
  "memory.persistent": uiSource("Persistent memory"),
  "galaxy.full": uiSource("Full galaxy"),
  "planning.advanced": uiSource("Advanced planning"),
  "weekly.reflection": uiSource("Weekly reflection"),
};
const GLOW_RANK_COPY: Readonly<Record<string, UiCopyKey>> = {
  "Orbit Seed": uiSource("Orbit Seed"),
  Ember: uiSource("Ember"),
  "Star Builder": uiSource("Star Builder"),
  "Orbit Keeper": uiSource("Orbit Keeper"),
  Constellation: uiSource("Constellation"),
  System: uiSource("System"),
  "Living Intelligence": uiSource("Living Intelligence"),
};
const GLOW_STREAK_COPY: Readonly<Record<string, UiCopyKey>> = {
  daily_orbit: uiSource("Daily Orbit"),
  talk: uiSource("Talk"),
  journal: uiSource("Journal"),
  plan_movement: uiSource("Plan Movement"),
  outcome_return: uiSource("Outcome Return"),
  consultation: uiSource("Consultation"),
};
const GLOW_QUEST_COPY: Readonly<Record<string, UiCopyKey>> = {
  private_continuity: uiSource("Return to one private thread"),
  meaningful_movement: uiSource("Move one real thing"),
  three_returns: uiSource("Return with evidence"),
  return_one_real_move: uiSource("Complete one persisted move"),
};
const GLOW_EVENT_COPY: Readonly<Record<string, UiCopyKey>> = {
  daily_checkin: uiSource("Daily check-in"),
  talk_meaningful: uiSource("Meaningful Talk"),
  journal_saved: uiSource("Journal saved"),
  plan_created: uiSource("Plan created"),
  plan_step_completed: uiSource("Plan step completed"),
  task_made_smaller: uiSource("Task made smaller"),
  outcome_returned: uiSource("Outcome returned"),
  missed_step_returned: uiSource("Missed step returned"),
  consultation_return: uiSource("Consultation returned"),
  "goal.created": uiSource("Goal created"),
  "objective.created": uiSource("Objective created"),
  "schedule.created": uiSource("Schedule created"),
  "system.checklist_answered": uiSource("System check-in answered"),
  "system.action_marked": uiSource("System action completed"),
  "feasibility.created": uiSource("Feasibility assessment created"),
  "community.message_posted": uiSource("Community message posted"),
  "community.post_created": uiSource("Community post created"),
  "community.comment_created": uiSource("Community reply posted"),
  "council.position_added": uiSource("Council position added"),
  "council.decision_recorded": uiSource("Council decision recorded"),
  "project.created": uiSource("Project created"),
  "project.task_completed": uiSource("Project task completed"),
  "project.evidence_verified": uiSource("Project evidence verified"),
  "quest.daily_claimed": uiSource("Daily quest claimed"),
  "quest.weekly_claimed": uiSource("Weekly mission claimed"),
};
const GLOW_ACHIEVEMENT_COPY: Readonly<Record<string, UiCopyKey>> = {
  "First verified Glow": uiSource("First verified Glow"),
  "Fifty source-linked Glow": uiSource("Fifty source-linked Glow"),
  "One hundred fifty source-linked Glow": uiSource("One hundred fifty source-linked Glow"),
  "Three hundred fifty source-linked Glow": uiSource("Three hundred fifty source-linked Glow"),
  "Seven hundred source-linked Glow": uiSource("Seven hundred source-linked Glow"),
  "Twelve hundred source-linked Glow": uiSource("Twelve hundred source-linked Glow"),
  "Two thousand source-linked Glow": uiSource("Two thousand source-linked Glow"),
};
const AGENTIC_TOOL_COPY: Readonly<Record<string, { name: UiCopyKey; summary: UiCopyKey }>> = {
  get_today_state: { name: uiSource("Read Today state"), summary: uiSource("Read the owner's current day state and next move.") },
  get_system_snapshot: { name: uiSource("Read System snapshot"), summary: uiSource("Read one Star System's current standing.") },
  get_plan: { name: uiSource("Read Plan"), summary: uiSource("Read a Plan and its steps.") },
  get_timeline: { name: uiSource("Read Timeline"), summary: uiSource("Read Timeline events in a bounded window.") },
  get_map_neighbourhood: { name: uiSource("Read Map neighbourhood"), summary: uiSource("Read the graph around one Map node.") },
  get_orbit: { name: uiSource("Read Orbit"), summary: uiSource("Read an Orbit's context, members and open threads.") },
  get_project: { name: uiSource("Read Project"), summary: uiSource("Read an AM Project and its task counts.") },
  get_project_evidence: { name: uiSource("Read Project evidence"), summary: uiSource("Read verified evidence attached to a Project.") },
  get_insight: { name: uiSource("Read Insight"), summary: uiSource("Read one candidate or accepted Insight with its evidence.") },
  search_approved_memory: { name: uiSource("Search approved memory"), summary: uiSource("Search only owner-approved personal memory.") },
  get_omega_workspace_frame: { name: uiSource("Read Omega workspace"), summary: uiSource("Read the current Omega consolidation frame.") },
  create_draft_plan: { name: uiSource("Draft Plan"), summary: uiSource("Draft a Plan for the owner to review.") },
  create_research_brief: { name: uiSource("Draft research brief"), summary: uiSource("Draft a research brief.") },
  create_memory_candidate: { name: uiSource("Propose memory candidate"), summary: uiSource("Propose a memory candidate for owner review.") },
  create_project_task_draft: { name: uiSource("Draft Project task"), summary: uiSource("Draft a Project task.") },
  create_timeline_draft: { name: uiSource("Draft Timeline event"), summary: uiSource("Draft a Timeline event without scheduling it.") },
  create_insight_candidate: { name: uiSource("Propose Insight"), summary: uiSource("Propose a candidate Insight with evidence.") },
  save_private_artifact: { name: uiSource("Store private artifact"), summary: uiSource("Store a private artifact for the owner.") },
  activate_plan: { name: uiSource("Activate Plan"), summary: uiSource("Activate a drafted Plan.") },
  schedule_timeline_event: { name: uiSource("Schedule Timeline event"), summary: uiSource("Schedule a Timeline event.") },
  complete_task: { name: uiSource("Complete task"), summary: uiSource("Mark a task complete.") },
  accept_or_correct_insight: { name: uiSource("Review Insight"), summary: uiSource("Record the owner's decision on an Insight.") },
  create_capsule: { name: uiSource("Create Context Capsule"), summary: uiSource("Create a Context Capsule from explicitly chosen sources.") },
  queue_project_run: { name: uiSource("Queue Project run"), summary: uiSource("Queue an approved Project run.") },
};
const UNIVERSE_CHAMBERS = [
  { route: "/universe", label: ADJUNCT_COPY.liveUniverse, glyph: "✦" },
  { route: "/universe/insights/candidates", label: ADJUNCT_COPY.candidates, glyph: "✧" },
  { route: "/universe/consultation", label: ADJUNCT_COPY.consultation, glyph: "◌" },
  { route: "/universe/community", label: ADJUNCT_COPY.community, glyph: "◎" },
] as const;

const CONTROLLED_LABELS: Readonly<Record<string, UiCopyKey>> = {
  ACTIVE: uiSource("Active"),
  INACTIVE: uiSource("Inactive"),
  DRAFT: uiSource("Draft"),
  OPEN: uiSource("Open"),
  DONE: uiSource("Done"),
  BLOCKED: uiSource("Blocked"),
  PROPOSED: uiSource("Proposed"),
  APPROVED: uiSource("Approved"),
  QUEUED: uiSource("Queued"),
  RUNNING: uiSource("Running"),
  SUCCEEDED: uiSource("Succeeded"),
  FAILED: uiSource("Failed"),
  CANCELLED: uiSource("Cancelled"),
  PASSED: uiSource("Passed"),
  REJECTED: uiSource("Rejected"),
  PENDING: uiSource("Pending"),
  OWNER: uiSource("Owner"),
  MEMBER: uiSource("Member"),
  MODERATOR: uiSource("Moderator"),
  GROUP: uiSource("Group"),
  COUNCIL: uiSource("Council"),
  AWARDED: uiSource("Awarded"),
  DEMO: uiSource("Demo"),
  IN_APP_ONLY: uiSource("In-app only"),
  TEST_OUTPUT: uiSource("Test output"),
  SYSTEM: uiSource("System"),
  TALK: uiSource("Talk"),
  JOURNAL: uiSource("Journal"),
  PLAN: uiSource("Plan"),
  GLOW: uiSource("Glow"),
  REMINDER: uiSource("Reminder"),
  COMMUNITY: uiSource("Community"),
  BILLING: uiSource("Billing"),
  SECURITY: uiSource("Security"),
  PROJECT: uiSource("Project"),
  INSIGHT: uiSource("Insight"),
  FREE: uiSource("Free"),
  DISABLED: uiSource("Disabled"),
  INLINE: uiSource("Inline"),
  OWNER_LEDGER: uiSource("Owner ledger"),
  OWNER_LEDGER_AGGREGATE: uiSource("Owner ledger aggregate"),
  CANDIDATE: uiSource("Candidate"),
  SURFACED: uiSource("Surfaced"),
  PROVISIONAL: uiSource("Provisional"),
  ORIENT: uiSource("Orient"),
  GATHER: uiSource("Gather"),
  MAP: uiSource("Map"),
  MOVE: uiSource("Move"),
  RETURN: uiSource("Return"),
  LIVED_EXPERIENCE: uiSource("Lived experience"),
  PRACTICAL_MOVE: uiSource("Practical move"),
  CONSTRAINT: uiSource("Constraint"),
  COUNTEREXAMPLE: uiSource("Counterexample"),
  DISAGREEMENT: uiSource("Disagreement"),
  WITNESS: uiSource("Witness"),
  USEFUL: uiSource("Useful"),
  TRIED_THIS: uiSource("Tried this"),
  OUTCOME: uiSource("Outcome"),
  EXPERT_VOICE: uiSource("Expert voice"),
  RESEARCH_EVIDENCE: uiSource("Research evidence"),
  ARCHITECT: uiSource("Architect"),
  IMPLEMENTER: uiSource("Implementer"),
  RESEARCHER: uiSource("Researcher"),
  VISUAL_REVIEWER: uiSource("Visual reviewer"),
  QA: uiSource("Quality assurance"),
  SECURITY_REVIEWER: uiSource("Security reviewer"),
  WRITER: uiSource("Writer"),
  TRANSLATOR: uiSource("Translator"),
  MEMBER_WRITTEN: uiSource("Member written"),
  EPISODIC: uiSource("Episodic"),
  SEMANTIC: uiSource("Semantic"),
  PROCEDURAL: uiSource("Procedural"),
  SOCIAL: uiSource("Social"),
  EVIDENCE: uiSource("Evidence"),
  SELF: uiSource("Self"),
  GOAL: uiSource("Goal"),
  META_COGNITIVE: uiSource("Meta-cognitive"),
  ADAPTIVE_INTERFACE: uiSource("Adaptive interface"),
  LOW: uiSource("Low"),
  PRIVATE: uiSource("Private"),
  SENSITIVE: uiSource("Sensitive"),
  FACT: uiSource("Fact"),
  CORRECTION: uiSource("Correction"),
  LANGUAGE: uiSource("Language"),
  RESEARCH: uiSource("Research"),
  EXPERTISE: uiSource("Expertise"),
  MISUNDERSTANDING: uiSource("Misunderstanding"),
  OUTCOME_EVIDENCE: uiSource("Outcome evidence"),
  PRIVATE_OWNER: uiSource("Private owner retrieval only"),
  DEIDENTIFIED_RESEARCH: uiSource("Deidentified research review"),
  OWNER_WRITTEN: uiSource("Owner written"),
  OWNER_REVIEW: uiSource("Owner review"),
  OWNER_SUPPLIED_SOURCE: uiSource("Owner supplied source"),
  OWNER_LEDGER_CALCULATION: uiSource("Owner ledger calculation"),
  DETERMINISTIC_INFERENCE: uiSource("Deterministic inference"),
  DETERMINISTIC_QUALITY_GATE: uiSource("Deterministic quality gate"),
  INFERRED_CROSS_DOMAIN_OWNER_LEDGER: uiSource("Inferred from the cross-domain owner ledger"),
  PENDING_REVIEW: uiSource("Pending review"),
  ACCEPTED: uiSource("Accepted"),
  EDITED: uiSource("Edited"),
  RETIRED: uiSource("Retired"),
  WITHDRAWN: uiSource("Withdrawn"),
  ROLLED_BACK: uiSource("Rolled back"),
  COMPLETED: uiSource("Completed"),
  ARCHIVED: uiSource("Archived"),
  SUPERSEDED: uiSource("Superseded"),
  RETRACTED: uiSource("Retracted"),
  NOT_RUN: uiSource("Not run"),
  NEVER: uiSource("Never"),
  YES: uiSource("Yes"),
  NO: uiSource("No"),
  FULL: uiSource("Full"),
  METADATA_ONLY: uiSource("Metadata only"),
  OWNER_APPROVED_SUMMARY: uiSource("Owner-approved summary"),
  EXECUTION_PATTERN: uiSource("Execution pattern"),
  NUR_BLIND_SPOT: uiSource("NUR blind spot"),
  NONE: uiSource("No renewal interval"),
  MONTH: uiSource("Monthly"),
  YEAR: uiSource("Annual"),
  CREATED: uiSource("Created"),
  EXPIRED: uiSource("Expired"),
  REVOKED: uiSource("Revoked"),
  CLOSED: uiSource("Closed"),
  GLOW_GATED: uiSource("Glow gated"),
  GLOW_UNAVAILABLE: uiSource("Glow unavailable"),
  NOT_CONNECTED: uiSource("Not connected"),
  BOUNDED_ROOM_ONLY: uiSource("Bounded room only"),
  BOUNDED_CONSULTATION_ONLY: uiSource("Bounded Consultation only"),
  STORED: uiSource("Stored"),
  QUARANTINED: uiSource("Quarantined"),
  CLEAN: uiSource("Clean"),
  MALICIOUS: uiSource("Malicious"),
  NOT_SCANNED: uiSource("Not scanned"),
  OWNER_UPLOAD: uiSource("Owner upload"),
  RUN_OUTPUT: uiSource("Run output"),
  APPROVE: uiSource("Approved"),
  CORRECT: uiSource("Corrected"),
  PLANNING: uiSource("Planning"),
  PLAN_READY: uiSource("Plan ready"),
  POLICY_REVIEW: uiSource("Policy review"),
  WAITING_APPROVAL: uiSource("Waiting for approval"),
  PAUSED: uiSource("Paused"),
  VERIFYING: uiSource("Verifying"),
  NEEDS_REVISION: uiSource("Needs revision"),
  CANCEL_REQUESTED: uiSource("Cancellation requested"),
  R0_READ_ONLY: uiSource("Read only"),
  R1_PRIVATE_DRAFT: uiSource("Private draft"),
  R2_DURABLE_PRIVATE: uiSource("Durable private change"),
  R3_EXTERNAL: uiSource("External action"),
  R4_IRREVERSIBLE: uiSource("Irreversible action"),
  OFF: uiSource("Off"),
  SUGGEST: uiSource("Suggest"),
  PREPARE: uiSource("Prepare"),
  INTERNAL: uiSource("Internal"),
  CONNECTED: uiSource("Connected"),
  DELEGATED: uiSource("Delegated"),
  ACCOUNT: uiSource("Account"),
  UNBOUND: uiSource("Unbound"),
  OPERATOR: uiSource("Operator"),
  VERIFIER: uiSource("Verifier"),
  CRITIC: uiSource("Critic"),
  EXTERNAL_CHANNELS_FAIL_CLOSED: uiSource("External channels fail closed"),
};

type RefreshSnapshot = () => Promise<V197BridgeSnapshot>;

function isDocumentHTMLElement(document: Document, node: Element | null): node is HTMLElement {
  const HTMLElementConstructor = document.defaultView?.HTMLElement;
  return Boolean(HTMLElementConstructor && node instanceof HTMLElementConstructor);
}

function text(value: unknown, fallback = uiCopy(ADJUNCT_COPY.notRecorded)): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function controlledLabel(value: unknown, fallback: UiCopyKey = uiSource("Unclear")): string {
  const normalized = typeof value === "string"
    ? value.trim().replaceAll("-", "_").replaceAll(" ", "_").toUpperCase()
    : "";
  return normalized && CONTROLLED_LABELS[normalized]
    ? uiCopy(CONTROLLED_LABELS[normalized])
    : uiCopy(fallback);
}

export function formatV197GlowRank(value: unknown): string {
  const key = text(value, "");
  return GLOW_RANK_COPY[key] ? uiCopy(GLOW_RANK_COPY[key]) : uiCopy("Unclassified constellation");
}

export function formatV197GlowStreak(value: unknown): string {
  const key = text(value, "");
  return GLOW_STREAK_COPY[key] ? uiCopy(GLOW_STREAK_COPY[key]) : uiCopy("Verified continuity");
}

export function formatV197GlowQuest(value: Record<string, unknown>): string {
  const key = text(value.key, "");
  return GLOW_QUEST_COPY[key] ? uiCopy(GLOW_QUEST_COPY[key]) : uiCopy("Verified quest");
}

export function formatV197GlowEvent(value: unknown): string {
  const key = text(value, "");
  return GLOW_EVENT_COPY[key] ? uiCopy(GLOW_EVENT_COPY[key]) : uiCopy("Verified Glow event");
}

function formatGlowAchievement(value: string): string {
  return GLOW_ACHIEVEMENT_COPY[value] ? uiCopy(GLOW_ACHIEVEMENT_COPY[value]) : uiCopy("Verified milestone");
}

function isOwnerWrittenNotification(notification: Record<string, unknown>): boolean {
  return text(notification.provenance_label, "") === "OWNER_WRITTEN"
    || text(notification.source_type, "") === "OWNER_REMINDER";
}

function systemNotificationTitle(notification: Record<string, unknown>): string {
  if (text(notification.source_type, "") === "GLOW_MILESTONE") return uiCopy("Your constellation changed");
  return uiCopy("A verified NUR event is ready");
}

function systemNotificationBody(notification: Record<string, unknown>): string {
  const sourceType = text(notification.source_type, "");
  const body = text(notification.body, "");
  if (sourceType === "GLOW_MILESTONE") {
    const milestone = /^Milestone confirmed: (.+)\.$/u.exec(body);
    if (milestone) return uiFormat("Milestone confirmed: {0}.", [formatGlowAchievement(milestone[1])]);
    const level = /^Level (\d+) is now confirmed from verified Glow\.$/u.exec(body);
    if (level) return uiFormat("Level {0} is now confirmed from verified Glow.", [level[1]]);
    return uiCopy("A verified Glow milestone changed your constellation.");
  }
  return uiCopy("Open NUR to review the verified event.");
}

function projectSystemLabel(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  const option = PROJECT_SYSTEM_OPTIONS.find(([slug]) => slug === normalized);
  return option ? uiCopy(option[1]) : uiCopy(ADJUNCT_COPY.unassignedSystem);
}

function billingPlanName(plan: Pick<V197BillingPlan, "code" | "name"> | string | null | undefined): string {
  const code = typeof plan === "string" ? plan : plan?.code;
  const known = code ? BILLING_PLAN_COPY[code] : undefined;
  if (known) return uiCopy(known.name);
  if (typeof plan === "object" && plan?.name) return plan.name;
  return uiCopy("Orbit Scan Free");
}

function billingPlanDescription(plan: V197BillingPlan): string {
  return BILLING_PLAN_COPY[plan.code]
    ? uiCopy(BILLING_PLAN_COPY[plan.code].description)
    : uiCopy("Provider-declared plan.");
}

function billingFeatureLabel(value: string): string {
  return BILLING_FEATURE_COPY[value] ? uiCopy(BILLING_FEATURE_COPY[value]) : uiCopy("Server-declared feature");
}

function agenticToolName(value: unknown): string {
  const key = text(value, "");
  return AGENTIC_TOOL_COPY[key] ? uiCopy(AGENTIC_TOOL_COPY[key].name) : uiCopy("Bound tool");
}

function agenticToolSummary(value: unknown): string {
  const key = text(value, "");
  return AGENTIC_TOOL_COPY[key] ? uiCopy(AGENTIC_TOOL_COPY[key].summary) : uiCopy("Owner-scoped governed capability.");
}

function localizedFailure(error: unknown, fallback: UiCopyKey): string {
  console.error("NUR owner-scoped operation failed.", error);
  return visibleV197Failure(error, fallback);
}

export function formatV197OwnerSessionState(value: unknown): string {
  return controlledLabel(value, uiSource("Session state unavailable"));
}

export function formatV197AccountDeletionResult(value: unknown): string {
  const state = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (state === "not_applicable") {
    return uiCopy("Account deleted. No external provider deletion was applicable.");
  }
  if (state === "not_performed") {
    return uiCopy("Account deleted. External provider deletion was not performed.");
  }
  return uiCopy("Account deleted. Review the retained audit for external-provider scope.");
}

export function formatV197AdjunctDate(value: unknown): string {
  if (typeof value !== "string" || !value) return uiCopy(ADJUNCT_COPY.noExpiry);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(activeUiLocale());
}

const date = formatV197AdjunctDate;

function activeOrbitId(snapshot: V197BridgeSnapshot): string | null {
  return snapshot.preferences?.active_orbit_id
    ?? snapshot.map?.nodes.find(node => node.kind !== "PERSONAL_BRIDGE")?.id
    ?? snapshot.session.orbit.id
    ?? null;
}

function requestKey(scope: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `v197-${scope}:${suffix}`;
}

function safeExternalUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function openExternalUrl(value: string | null | undefined): boolean {
  const url = safeExternalUrl(value);
  if (!url) return false;
  const popup = window.open("about:blank", "_blank");
  if (!popup) return false;
  popup.opener = null;
  popup.location.replace(url.toString());
  return true;
}

function selectOptions<T extends string>(
  document: Document,
  select: HTMLSelectElement,
  values: readonly T[],
  labels: Readonly<Record<T, UiCopyKey>>,
): void {
  for (const value of values) {
    const option = element(document, "option", undefined, uiCopy(labels[value])) as HTMLOptionElement;
    option.value = value;
    select.append(option);
  }
}

function element<K extends keyof HTMLElementTagNameMap>(
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

function userElement<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string | undefined,
  content: string,
): HTMLElementTagNameMap[K] {
  const node = element(document, tag, className);
  setVerbatimUserText(node, content);
  return node;
}

function button(document: Document, label: string, action: string, primary = false): HTMLButtonElement {
  const node = element(document, "button", primary ? "nur-adjunct-button is-primary" : "nur-adjunct-button", label);
  node.type = "button";
  node.dataset.adjunctAction = action;
  return node;
}

function fact(document: Document, label: string, value: string): HTMLElement {
  const node = element(document, "div", "nur-adjunct-fact");
  node.append(element(document, "span", "nur-adjunct-label", label));
  node.append(element(document, "strong", undefined, value));
  return node;
}

function userFact(document: Document, label: string, value: string): HTMLElement {
  const node = fact(document, label, value);
  setVerbatimUserText(node.querySelector<HTMLElement>("strong"), value);
  return node;
}

function panel(document: Document, eyebrow: string, title: string): HTMLElement {
  const node = element(document, "section", "nur-adjunct-panel");
  node.append(element(document, "p", "nur-adjunct-eyebrow", eyebrow));
  node.append(element(document, "h2", undefined, title));
  return node;
}

function userPanel(document: Document, eyebrow: string, title: string): HTMLElement {
  const node = panel(document, eyebrow, title);
  setVerbatimUserText(node.querySelector<HTMLElement>("h2"), title);
  return node;
}

function empty(document: Document, title: string, body: string): HTMLElement {
  const node = element(document, "div", "nur-adjunct-empty");
  const seal = createV197StarSeal(document, 20, false);
  seal.classList.add("nur-adjunct-empty-seal");
  node.append(seal, element(document, "strong", undefined, title));
  node.append(element(document, "p", undefined, body));
  return node;
}

function status(document: Document, message: string, tone: "quiet" | "good" | "warn" = "quiet"): HTMLElement {
  const node = element(document, "p", `nur-adjunct-status is-${tone}`, message);
  node.setAttribute("role", "status");
  return node;
}

function setStatus(node: HTMLElement, message: string, tone: "quiet" | "good" | "warn" = "quiet"): void {
  node.textContent = message;
  node.className = `nur-adjunct-status is-${tone}`;
}

function labeledControl(document: Document, label: string, control: HTMLElement): HTMLElement {
  const field = element(document, "label", "nur-adjunct-field");
  field.append(element(document, "span", undefined, label), control);
  return field;
}

function recordId(row: Record<string, unknown>): string {
  return text(row.id, "");
}

function ensureStyle(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = element(document, "style");
  style.id = STYLE_ID;
  style.textContent = V197_ADJUNCT_FORENSIC_CSS;
  document.head.append(style);
}

function isolateAdjunctBackground(document: Document, root: HTMLElement): void {
  let state = adjunctBackgrounds.get(document);
  if (!state) {
    state = {
      previousFocus: isDocumentHTMLElement(document, document.activeElement) ? document.activeElement : null,
      siblings: new Map(),
    };
    adjunctBackgrounds.set(document, state);
  }
  for (const child of Array.from(document.body.children)) {
    if (!isDocumentHTMLElement(document, child) || child === root) continue;
    if (!state.siblings.has(child)) {
      state.siblings.set(child, { inert: child.inert, ariaHidden: child.getAttribute("aria-hidden") });
    }
    child.inert = true;
    child.setAttribute("aria-hidden", "true");
  }
}

function restoreAdjunctBackground(document: Document): void {
  const state = adjunctBackgrounds.get(document);
  if (!state) return;
  for (const [sibling, previous] of state.siblings) {
    sibling.inert = previous.inert;
    if (previous.ariaHidden === null) sibling.removeAttribute("aria-hidden");
    else sibling.setAttribute("aria-hidden", previous.ariaHidden);
  }
  adjunctBackgrounds.delete(document);
  if (state.previousFocus?.isConnected) state.previousFocus.focus({ preventScroll: true });
}

function universeChamberNav(document: Document): HTMLElement {
  const current = window.location.pathname;
  const nav = element(document, "nav", "nur-adjunct-universe-nav");
  nav.setAttribute("aria-label", uiCopy("Universe chambers"));
  for (const chamber of UNIVERSE_CHAMBERS) {
    const control = button(document, uiFormat("{0} {1}", [chamber.glyph, uiCopy(chamber.label)]), `universe-chamber-${chamber.label.toLowerCase()}`);
    const selected = chamber.route === "/universe"
      ? current === chamber.route
      : current === chamber.route || current.startsWith(`${chamber.route}/`);
    if (selected) control.setAttribute("aria-current", "page");
    control.addEventListener("click", () => navigate(chamber.route));
    nav.append(control);
  }
  return nav;
}

function mount(document: Document, title: string, subtitle: string, backRoute = "/systems"): HTMLElement {
  document.getElementById(ROOT_ID)?.remove();
  ensureStyle(document);
  const root = element(document, "div");
  root.id = ROOT_ID;
  root.dataset.v197NativeAdjunct = "true";
  const shell = element(document, "main", "nur-adjunct-shell");
  const topbar = element(document, "header", "nur-adjunct-topbar");
  const back = element(
    document,
    "button",
    "nur-adjunct-back",
    backRoute.startsWith("/universe") ? uiCopy("← Live Universe") : uiCopy("← Return to NUR"),
  );
  back.type = "button";
  back.dataset.adjunctRoute = backRoute;
  const brand = element(document, "div", "nur-adjunct-brand", uiCopy("NUR"));
  markV197HolographicWordmark(brand);
  const brandSeal = createV197StarSeal(document, 24, true);
  brandSeal.classList.add("nur-adjunct-brand-seal");
  brand.prepend(brandSeal);
  topbar.append(back, brand, element(document, "span", "nur-adjunct-privacy", uiCopy("Private by default. Shared only by choice.")));
  const hero = element(document, "section", "nur-adjunct-hero");
  hero.append(element(document, "p", "nur-adjunct-eyebrow", uiCopy("Neural Upgrade Rewiring")));
  hero.append(element(document, "h1", undefined, title));
  hero.append(element(document, "p", "nur-adjunct-subtitle", subtitle));
  shell.append(topbar);
  if (window.location.pathname.startsWith("/universe/")) shell.append(universeChamberNav(document));
  shell.append(hero);
  root.append(shell);
  document.body.append(root);
  isolateAdjunctBackground(document, root);
  back.focus({ preventScroll: true });
  back.addEventListener("click", () => {
    window.history.pushState({}, "", backRoute);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  return shell;
}

function protectMountedOwnerCopy(shell: HTMLElement, title: string, subtitle: string): void {
  setVerbatimUserText(shell.querySelector<HTMLElement>(".nur-adjunct-hero h1"), title);
  setVerbatimUserText(shell.querySelector<HTMLElement>(".nur-adjunct-hero .nur-adjunct-subtitle"), subtitle);
}

async function renderSettings(
  document: Document,
  api: V197ApiClient,
  snapshot: V197BridgeSnapshot,
  refreshSnapshot: RefreshSnapshot,
): Promise<void> {
  const shell = mount(document, uiCopy("Your NUR, held on your terms."), uiCopy("Language, model access, motion and learning preferences stay in your owner-scoped ledger."));
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const provider = panel(document, uiCopy("Provider boundary"), uiCopy("Intelligence connection"));
  const providerState = snapshot.health?.ai_provider === "openai" ? "OPENAI_CONFIGURED" : "DISABLED";
  const providerStateLabel = providerState === "OPENAI_CONFIGURED"
    ? uiCopy("OpenAI connected")
    : uiCopy("Disabled");
  provider.append(element(document, "div", "nur-adjunct-facts"));
  provider.querySelector(".nur-adjunct-facts")?.append(
    fact(document, uiCopy("Provider"), providerStateLabel),
    fact(document, uiCopy("Execution"), uiCopy("Server-side only")),
    fact(document, uiCopy("Prompt logging"), uiCopy("Off by default")),
  );
  provider.append(status(document, providerState === "OPENAI_CONFIGURED"
    ? uiCopy("The backend can answer Talk requests. No key is exposed to this document.")
    : uiCopy("AI is not connected. Run the local configuration script, then start NUR in OpenAI mode."), providerState === "OPENAI_CONFIGURED" ? "good" : "warn"));

  const language = panel(document, uiCopy("Language and voice"), uiCopy("How NUR speaks with you"));
  const localeLabel = element(document, "label", "nur-adjunct-field");
  localeLabel.append(element(document, "span", undefined, uiCopy("Interface language")));
  const locale = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  locale.dataset.adjunctControl = "locale";
  for (const row of V197_LOCALE_META) {
    const option = element(document, "option", undefined, uiFormat("{0} · {1}", [row.label, row.status === "polished_beta" ? uiCopy("polished beta") : uiCopy("draft")])) as HTMLOptionElement;
    option.value = row.locale;
    option.selected = row.locale === (snapshot.preferences?.locale ?? snapshot.session.profile.locale ?? "en");
    locale.append(option);
  }
  localeLabel.append(locale);
  const writingLabel = element(document, "label", "nur-adjunct-field");
  writingLabel.append(element(document, "span", undefined, uiCopy("Writing preference")));
  const writing = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  writing.dataset.adjunctControl = "writing-preference";
  for (const [value, label] of WRITING_OPTIONS) {
    const option = element(document, "option", undefined, uiCopy(label)) as HTMLOptionElement;
    option.value = value;
    option.selected = value === (snapshot.preferences?.writing_preference ?? "default");
    writing.append(option);
  }
  writingLabel.append(writing);
  language.append(localeLabel, writingLabel);
  language.append(status(document, uiCopy("Roman Urdu is stored as locale=ur with writing_preference=roman. Draft locales are labelled honestly.")));

  const experience = panel(document, uiCopy("Presence"), uiCopy("Motion, sound and Omega"));
  const toggle = (label: string, key: string, checked: boolean) => {
    const row = element(document, "label", "nur-adjunct-toggle");
    row.append(element(document, "span", undefined, label));
    const input = element(document, "input") as HTMLInputElement;
    input.type = "checkbox";
    input.checked = checked;
    input.dataset.adjunctControl = key;
    row.append(input);
    return row;
  };
  experience.append(
    toggle(uiCopy("Quiet interface sound"), "sound", snapshot.preferences?.sound_enabled ?? true),
    toggle(uiCopy("Reduce visual motion"), "reduced-effects", snapshot.preferences?.reduced_effects ?? false),
    toggle(uiCopy("Omega research memory"), "omega", snapshot.preferences?.omega_enabled ?? true),
  );

  const ownership = panel(document, uiCopy("Owner data"), uiCopy("Export the complete owner-scoped ledger"));
  ownership.append(element(document, "p", "nur-adjunct-boundary", uiCopy("The download includes deterministic JSON, a SHA-256 manifest checksum, and explicit status for any unavailable stored object. Secret hashes are excluded.")));
  const ownershipActions = element(document, "div", "nur-adjunct-actions");
  const exportButton = button(document, uiCopy("Export my NUR"), "settings-export");
  const exportState = status(document, uiCopy("Nothing is marked exported until the API returns the real owner manifest."));
  ownershipActions.append(exportButton);
  ownership.append(ownershipActions, exportState);
  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    exportState.textContent = uiCopy("Preparing the owner-scoped export…");
    try {
      const exported = await api.downloadOwnerExport();
      const href = URL.createObjectURL(exported.blob);
      const anchor = element(document, "a") as HTMLAnchorElement;
      anchor.href = href;
      anchor.download = exported.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 0);
      exportState.textContent = uiFormat("Export downloaded. SHA-256 {0}.", [exported.checksum]);
      exportState.className = "nur-adjunct-status is-good";
    } catch (error) {
      exportState.textContent = localizedFailure(error, uiSource("Owner export could not be prepared."));
      exportState.className = "nur-adjunct-status is-warn";
    } finally {
      exportButton.disabled = false;
    }
  });

  const security = panel(document, uiCopy("Password"), uiCopy("Change it and revoke every active session"));
  const passwordField = (label: string, control: string) => {
    const field = element(document, "label", "nur-adjunct-field");
    field.append(element(document, "span", undefined, label));
    const input = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
    input.type = "password";
    input.autocomplete = control === "current-password" || control === "delete-password"
      ? "current-password"
      : "new-password";
    input.minLength = 8;
    input.maxLength = 256;
    input.dataset.adjunctControl = control;
    field.append(input);
    return field;
  };
  security.append(
    passwordField(uiCopy("Current password"), "current-password"),
    passwordField(uiCopy("New password"), "new-password"),
    passwordField(uiCopy("Confirm new password"), "confirm-password"),
  );
  const securityActions = element(document, "div", "nur-adjunct-actions");
  const changePassword = button(document, uiCopy("Change password"), "settings-change-password", true);
  const securityState = status(document, uiCopy("A successful change signs every device out, including this one."));
  securityActions.append(changePassword);
  security.append(securityActions, securityState);
  changePassword.addEventListener("click", async () => {
    const current = (security.querySelector('[data-adjunct-control="current-password"]') as HTMLInputElement).value;
    const next = (security.querySelector('[data-adjunct-control="new-password"]') as HTMLInputElement).value;
    const confirmation = (security.querySelector('[data-adjunct-control="confirm-password"]') as HTMLInputElement).value;
    if (current.length < 1 || next.length < 8) {
      securityState.textContent = uiCopy("Enter the current password and a new password of at least 8 characters.");
      securityState.className = "nur-adjunct-status is-warn";
      return;
    }
    if (next !== confirmation) {
      securityState.textContent = uiCopy("The two new passwords do not match.");
      securityState.className = "nur-adjunct-status is-warn";
      return;
    }
    changePassword.disabled = true;
    securityState.textContent = uiCopy("Changing password and revoking sessions…");
    try {
      await api.changePassword(current, next);
      securityState.textContent = uiCopy("Password changed. Returning to Sign in…");
      securityState.className = "nur-adjunct-status is-good";
      window.setTimeout(() => window.location.replace("/auth"), 400);
    } catch (error) {
      securityState.textContent = localizedFailure(error, uiSource("Password could not be changed."));
      securityState.className = "nur-adjunct-status is-warn";
      changePassword.disabled = false;
    }
  });

  const sessionsPanel = panel(document, uiCopy("Sessions"), uiCopy("Devices with access to this Orbit"));
  const sessionList = element(document, "div", "nur-adjunct-list");
  const sessionActions = element(document, "div", "nur-adjunct-actions");
  const revokeOthers = button(document, uiCopy("Sign out other devices"), "settings-revoke-other-sessions");
  const sessionState = status(document, uiCopy("Loading the real session ledger…"));
  sessionActions.append(revokeOthers);
  sessionsPanel.append(sessionList, sessionActions, sessionState);
  const loadSessions = async () => {
    sessionList.replaceChildren();
    try {
      const sessions = await api.ownerSessions();
      for (const ownerSession of sessions) {
        const row = element(document, "div", "nur-adjunct-row");
        const heading = element(document, "div", "nur-adjunct-row-head");
        heading.append(
          element(document, "strong", undefined, ownerSession.current ? uiCopy("This device") : uiCopy("Signed-in device")),
          element(document, "span", "nur-adjunct-chip", formatV197OwnerSessionState(ownerSession.state)),
        );
        row.append(heading, element(document, "p", undefined, uiFormat("Started {0} · Expires {1}", [date(ownerSession.created_at), date(ownerSession.expires_at)])));
        if (!ownerSession.current && ownerSession.state === "active") {
          const revoke = button(document, uiCopy("Revoke session"), `settings-revoke-session-${ownerSession.id}`);
          revoke.addEventListener("click", async () => {
            revoke.disabled = true;
            try {
              await api.revokeSession(ownerSession.id);
              await loadSessions();
              sessionState.textContent = uiCopy("Session revoked.");
              sessionState.className = "nur-adjunct-status is-good";
            } catch (error) {
              sessionState.textContent = localizedFailure(error, uiSource("Session could not be revoked."));
              sessionState.className = "nur-adjunct-status is-warn";
              revoke.disabled = false;
            }
          });
          row.append(element(document, "div", "nur-adjunct-actions"));
          row.querySelector(".nur-adjunct-actions")?.append(revoke);
        }
        sessionList.append(row);
      }
      if (!sessions.length) sessionList.append(empty(document, uiCopy("No session row returned"), uiCopy("The API did not report an active browser session.")));
      sessionState.textContent = sessions.length === 1
        ? uiFormat("{0} owner-scoped session.", [sessions.length])
        : uiFormat("{0} owner-scoped sessions.", [sessions.length]);
    } catch (error) {
      sessionList.append(empty(document, uiCopy("Session ledger unavailable"), uiCopy("No device is shown without an API response.")));
      sessionState.textContent = localizedFailure(error, uiSource("Sessions could not be loaded."));
      sessionState.className = "nur-adjunct-status is-warn";
    }
  };
  revokeOthers.addEventListener("click", async () => {
    revokeOthers.disabled = true;
    try {
      const result = await api.revokeOtherSessions();
      await loadSessions();
      sessionState.textContent = result.revoked_session_count === 1
        ? uiFormat("{0} other session revoked.", [result.revoked_session_count])
        : uiFormat("{0} other sessions revoked.", [result.revoked_session_count]);
      sessionState.className = "nur-adjunct-status is-good";
    } catch (error) {
      sessionState.textContent = localizedFailure(error, uiSource("Other sessions could not be revoked."));
      sessionState.className = "nur-adjunct-status is-warn";
    } finally {
      revokeOthers.disabled = false;
    }
  });
  await loadSessions();

  const deletion = panel(document, uiCopy("Danger zone"), uiCopy("Permanently delete this NUR account"));
  deletion.classList.add("is-danger");
  const deletionPassword = passwordField(uiCopy("Current password"), "delete-password");
  const deletionConfirmationField = element(document, "label", "nur-adjunct-field");
  deletionConfirmationField.append(element(document, "span", undefined, uiCopy("Type DELETE MY NUR ACCOUNT")));
  const deletionConfirmation = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  deletionConfirmation.autocomplete = "off";
  deletionConfirmation.dataset.adjunctControl = "delete-confirmation";
  deletionConfirmation.maxLength = 64;
  deletionConfirmationField.append(deletionConfirmation);
  const deletionActions = element(document, "div", "nur-adjunct-actions");
  const deleteButton = button(document, uiCopy("Delete account permanently"), "settings-delete");
  const deletionState = status(document, uiCopy("Local files must be removed before the database account can be deleted. External provider erasure is never claimed unless a provider adapter performs it."));
  deletionActions.append(deleteButton);
  deletion.append(deletionPassword, deletionConfirmationField, deletionActions, deletionState);
  deleteButton.addEventListener("click", async () => {
    const password = (deletion.querySelector('[data-adjunct-control="delete-password"]') as HTMLInputElement).value;
    if (!password || deletionConfirmation.value !== "DELETE MY NUR ACCOUNT") {
      deletionState.textContent = uiCopy("Enter the current password and type \"DELETE MY NUR ACCOUNT\" exactly.");
      deletionState.className = "nur-adjunct-status is-warn";
      return;
    }
    if (!window.confirm(uiCopy("Permanently delete this NUR account and all owner-scoped data? This cannot be undone."))) return;
    deleteButton.disabled = true;
    deletionState.textContent = uiCopy("Deleting owner data and revoking sessions…");
    try {
      const result = await api.deleteAccount(password, deletionConfirmation.value);
      deletionState.textContent = formatV197AccountDeletionResult(result.external_provider_deletion.status);
      deletionState.className = "nur-adjunct-status is-good";
      window.setTimeout(() => window.location.replace("/auth"), 900);
    } catch (error) {
      deletionState.textContent = localizedFailure(error, uiSource("Account deletion did not complete."));
      deletionState.className = "nur-adjunct-status is-warn";
      deleteButton.disabled = false;
    }
  });

  const savePanel = panel(document, uiCopy("Persisted owner preference"), uiCopy("Return with the same language"));
  savePanel.classList.add("is-wide");
  const actions = element(document, "div", "nur-adjunct-actions");
  const save = button(document, uiCopy("Save preferences"), "settings-save", true);
  actions.append(save);
  const saveState = status(document, uiCopy("Changes are stored only in your owner-scoped preference row."));
  savePanel.append(actions, saveState);
  save.addEventListener("click", async () => {
    save.disabled = true;
    saveState.textContent = uiCopy("Saving…");
    try {
      const selectedLocale = locale.value;
      const selectedWriting = writing.value as WritingPreference;
      await api.patchPreferences({
        locale: selectedLocale,
        writing_preference: selectedWriting,
        sound_enabled: (experience.querySelector('[data-adjunct-control="sound"]') as HTMLInputElement).checked,
        reduced_effects: (experience.querySelector('[data-adjunct-control="reduced-effects"]') as HTMLInputElement).checked,
        omega_enabled: (experience.querySelector('[data-adjunct-control="omega"]') as HTMLInputElement).checked,
      });
      const next = await refreshSnapshot();
      applyV197Locale(document, selectedLocale, selectedWriting);
      document.documentElement.dir = directionForPreference(selectedLocale, selectedWriting);
      saveState.textContent = uiCopy("Saved. NUR will return in this language and writing style.");
      saveState.className = "nur-adjunct-status is-good";
      if (next.preferences) snapshot.preferences = next.preferences;
    } catch (error) {
      saveState.textContent = localizedFailure(error, uiSource("Preferences could not be saved."));
      saveState.className = "nur-adjunct-status is-warn";
    } finally {
      save.disabled = false;
    }
  });

  grid.append(provider, language, experience, security, sessionsPanel, ownership, deletion, savePanel);
}

async function renderMemory(document: Document, api: V197ApiClient, snapshot: V197BridgeSnapshot): Promise<void> {
  const shell = mount(
    document,
    uiCopy("Memory stays proposed until you choose it."),
    uiCopy("Candidate inferences, accepted memories and owner-written context remain separate, editable and deletable inside your private ledger."),
  );
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const orbitId = activeOrbitId(snapshot);

  const create = panel(document, uiCopy("Owner-written memory"), uiCopy("Hold one thing deliberately"));
  create.classList.add("is-wide");
  const createText = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  createText.dataset.adjunctControl = "memory-create-text";
  createText.placeholder = uiCopy("Write only what you want NUR to remember...");
  const createType = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  createType.dataset.adjunctControl = "memory-create-type";
  selectOptions(document, createType, MEMORY_TYPES, MEMORY_TYPE_LABELS);
  createType.value = "SEMANTIC";
  const createSensitivity = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  createSensitivity.dataset.adjunctControl = "memory-create-sensitivity";
  selectOptions(document, createSensitivity, MEMORY_SENSITIVITIES, MEMORY_SENSITIVITY_LABELS);
  createSensitivity.value = "PRIVATE";
  const createAction = button(document, uiCopy("Remember by my choice"), "memory-create", true);
  createAction.disabled = !orbitId;
  const createState = status(
    document,
    orbitId ? uiCopy("Nothing is stored until you press this control.") : uiCopy("Choose an active Orbit before creating a memory."),
    orbitId ? "quiet" : "warn",
  );
  const createActions = element(document, "div", "nur-adjunct-actions");
  createActions.append(createAction);
  create.append(
    element(document, "p", "nur-adjunct-boundary", uiCopy("Private means owner-scoped. Sensitive memory remains excluded from sharing unless you later select it through a separate boundary.")),
    labeledControl(document, uiCopy("Memory"), createText),
    labeledControl(document, uiCopy("Type"), createType),
    labeledControl(document, uiCopy("Sensitivity"), createSensitivity),
    createActions,
    createState,
  );

  const candidates = panel(document, uiCopy("Review queue"), uiCopy("Memory candidates"));
  const candidateState = status(document, uiCopy("Candidates are not memories until you approve them."));
  const candidateList = element(document, "div", "nur-adjunct-list");
  candidates.append(candidateState, candidateList);

  const accepted = panel(document, uiCopy("Owner ledger"), uiCopy("Accepted memories"));
  const memoryState = status(document, uiCopy("Edits create a persisted version; deletion removes the owner memory."));
  const memoryList = element(document, "div", "nur-adjunct-list");
  accepted.append(memoryState, memoryList);

  const renderCandidates = (rows: V197MemoryCandidate[]) => {
    candidateList.replaceChildren();
    if (!rows.length) {
      candidateList.append(empty(document, uiCopy("No memory candidate is waiting"), uiCopy("NUR has not proposed an owner memory, or every proposal has already been reviewed.")));
      return;
    }
    for (const candidate of rows) {
      const row = element(document, "article", "nur-adjunct-row");
      const head = element(document, "div", "nur-adjunct-row-head");
      head.append(
        userElement(document, "strong", undefined, candidate.candidate_text),
        element(document, "span", "nur-adjunct-chip", controlledLabel(candidate.status)),
      );
      row.append(head, element(document, "p", undefined, uiFormat("{0} · {1} · {2}", [
        controlledLabel(candidate.memory_type),
        controlledLabel(candidate.sensitivity),
        controlledLabel(candidate.provenance_label, uiSource("Owner ledger")),
      ])));
      if (["PENDING", "PENDING_REVIEW", "CANDIDATE", "EDITED"].includes(candidate.status)) {
        const correctedText = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
        correctedText.value = candidate.candidate_text;
        correctedText.dataset.adjunctControl = `memory-candidate-text-${candidate.id}`;
        const reason = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
        reason.placeholder = uiCopy("Why this correction is needed");
        reason.dataset.adjunctControl = `memory-candidate-reason-${candidate.id}`;
        const actions = element(document, "div", "nur-adjunct-actions");
        const approve = button(document, uiCopy("Approve as memory"), `memory-candidate-approve-${candidate.id}`, true);
        const correct = button(document, uiCopy("Correct proposal"), `memory-candidate-correct-${candidate.id}`);
        const reject = button(document, uiCopy("Reject proposal"), `memory-candidate-reject-${candidate.id}`);
        actions.append(approve, correct, reject);
        const controls = [approve, correct, reject];
        const act = async (action: "approve" | "correct" | "reject") => {
          controls.forEach(control => { control.disabled = true; });
          setStatus(candidateState, uiFormat("{0} owner candidate...", [action === "approve" ? uiCopy("Approving") : action === "correct" ? uiCopy("Correcting") : uiCopy("Rejecting")]));
          try {
            if (action === "approve") await api.approveMemoryCandidate(candidate.id);
            else if (action === "reject") await api.rejectMemoryCandidate(candidate.id);
            else {
              const canonicalText = correctedText.value.trim();
              const correctionReason = reason.value.trim();
              if (!canonicalText || !correctionReason) throw new Error(uiCopy("A corrected memory and a reason are both required."));
              await api.correctMemoryCandidate(candidate.id, {
                canonical_text: canonicalText,
                correction_reason: correctionReason,
              });
            }
            setStatus(candidateState, uiCopy("Owner candidate review persisted."), "good");
            await refreshLists();
          } catch (error) {
            setStatus(candidateState, localizedFailure(error, uiSource("The candidate action failed.")), "warn");
            controls.forEach(control => { control.disabled = false; });
          }
        };
        approve.addEventListener("click", () => void act("approve"));
        correct.addEventListener("click", () => void act("correct"));
        reject.addEventListener("click", () => void act("reject"));
        row.append(
          labeledControl(document, uiCopy("Corrected wording"), correctedText),
          labeledControl(document, uiCopy("Correction reason"), reason),
          actions,
        );
      }
      candidateList.append(row);
    }
  };

  const renderMemories = (rows: V197Memory[]) => {
    memoryList.replaceChildren();
    if (!rows.length) {
      memoryList.append(empty(document, uiCopy("No accepted memory"), uiCopy("Create one deliberately or approve a candidate. NUR does not backfill an invented memory.")));
      return;
    }
    for (const memory of rows) {
      const row = element(document, "article", "nur-adjunct-row");
      const head = element(document, "div", "nur-adjunct-row-head");
      head.append(
        userElement(document, "strong", undefined, memory.canonical_text),
        element(document, "span", "nur-adjunct-chip", uiFormat("{0} · v{1}", [controlledLabel(memory.status), memory.version])),
      );
      const canonicalText = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
      canonicalText.value = memory.canonical_text;
      canonicalText.dataset.adjunctControl = `memory-text-${memory.id}`;
      const memoryType = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
      selectOptions(document, memoryType, MEMORY_TYPES, MEMORY_TYPE_LABELS);
      if (MEMORY_TYPES.includes(memory.memory_type as V197MemoryType)) memoryType.value = memory.memory_type;
      const sensitivity = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
      selectOptions(document, sensitivity, MEMORY_SENSITIVITIES, MEMORY_SENSITIVITY_LABELS);
      if (MEMORY_SENSITIVITIES.includes(memory.sensitivity as V197MemorySensitivity)) sensitivity.value = memory.sensitivity;
      const actions = element(document, "div", "nur-adjunct-actions");
      const save = button(document, uiCopy("Save owner edit"), `memory-save-${memory.id}`, true);
      const remove = button(document, uiCopy("Delete memory"), `memory-delete-${memory.id}`);
      actions.append(save, remove);
      save.addEventListener("click", async () => {
        const value = canonicalText.value.trim();
        if (!value) {
          setStatus(memoryState, uiCopy("A memory cannot be blank."), "warn");
          return;
        }
        save.disabled = true;
        remove.disabled = true;
        try {
          await api.patchMemory(memory.id, {
            canonical_text: value,
            memory_type: memoryType.value as V197MemoryType,
            sensitivity: sensitivity.value as V197MemorySensitivity,
          });
          setStatus(memoryState, uiCopy("Owner edit persisted as the next memory version."), "good");
          await refreshLists();
        } catch (error) {
          setStatus(memoryState, localizedFailure(error, uiSource("The memory edit failed.")), "warn");
          save.disabled = false;
          remove.disabled = false;
        }
      });
      remove.addEventListener("click", async () => {
        if (!window.confirm(uiCopy("Delete this owner memory? This removes it from active NUR use."))) return;
        save.disabled = true;
        remove.disabled = true;
        try {
          await api.deleteMemory(memory.id);
          setStatus(memoryState, uiCopy("Memory deleted from the owner ledger."), "good");
          await refreshLists();
        } catch (error) {
          setStatus(memoryState, localizedFailure(error, uiSource("The memory could not be deleted.")), "warn");
          save.disabled = false;
          remove.disabled = false;
        }
      });
      row.append(
        head,
        element(document, "p", undefined, uiFormat("{0} · {1} · {2}", [
          controlledLabel(memory.memory_type),
          controlledLabel(memory.sensitivity),
          controlledLabel(memory.provenance_label, uiSource("Owner ledger")),
        ])),
        labeledControl(document, uiCopy("Canonical wording"), canonicalText),
        labeledControl(document, uiCopy("Type"), memoryType),
        labeledControl(document, uiCopy("Sensitivity"), sensitivity),
        actions,
      );
      memoryList.append(row);
    }
  };

  const refreshLists = async () => {
    const [candidateRows, memoryRows] = await Promise.all([
      api.memoryCandidates(undefined, 100),
      api.memories({ includeRetired: false, limit: 100 }),
    ]);
    renderCandidates(candidateRows);
    renderMemories(memoryRows);
  };

  createAction.addEventListener("click", async () => {
    const canonicalText = createText.value.trim();
    if (!canonicalText || !orbitId) {
      setStatus(createState, orbitId ? uiCopy("Write the memory you want NUR to hold.") : uiCopy("Choose an active Orbit first."), "warn");
      return;
    }
    createAction.disabled = true;
    setStatus(createState, uiCopy("Writing only this owner-approved memory..."));
    try {
      await api.createMemory({
        canonical_text: canonicalText,
        structured_value: {},
        orbit_id: orbitId,
        memory_type: createType.value as V197MemoryType,
        sensitivity: createSensitivity.value as V197MemorySensitivity,
        confidence: 1,
      });
      createText.value = "";
      setStatus(createState, uiCopy("Memory persisted by your explicit choice."), "good");
      await refreshLists();
    } catch (error) {
      setStatus(createState, localizedFailure(error, uiSource("The memory could not be created.")), "warn");
    } finally {
      createAction.disabled = false;
    }
  });

  grid.append(create, candidates, accepted);
  await refreshLists();
}

async function renderTeachNUR(document: Document, api: V197ApiClient, snapshot: V197BridgeSnapshot): Promise<void> {
  const shell = mount(
    document,
    uiCopy("Teach NUR without surrendering authority."),
    uiCopy("Your contribution enters an owner-scoped review ledger. Consent is explicit, reversible and never authorizes model training by implication."),
  );
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const orbitId = activeOrbitId(snapshot);

  const contribute = panel(document, uiCopy("Explicit contribution"), uiCopy("Offer one bounded correction or insight"));
  contribute.classList.add("is-wide");
  const kind = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  kind.dataset.adjunctControl = "teach-kind";
  selectOptions(document, kind, TEACH_NUR_KINDS, TEACH_NUR_KIND_LABELS);
  kind.value = "CORRECTION";
  const content = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  content.dataset.adjunctControl = "teach-content";
  content.placeholder = uiCopy("What should NUR learn, question or correct?");
  const scope = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  scope.dataset.adjunctControl = "teach-consent-scope";
  for (const [value, label] of TEACH_SCOPE_OPTIONS) {
    const option = element(document, "option", undefined, uiCopy(label)) as HTMLOptionElement;
    option.value = value;
    scope.append(option);
  }
  const sensitivity = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  sensitivity.dataset.adjunctControl = "teach-sensitivity";
  selectOptions(document, sensitivity, MEMORY_SENSITIVITIES, MEMORY_SENSITIVITY_LABELS);
  sensitivity.value = "PRIVATE";
  const consentRow = element(document, "label", "nur-adjunct-toggle");
  const consent = element(document, "input") as HTMLInputElement;
  consent.type = "checkbox";
  consent.dataset.adjunctControl = "teach-consent";
  consentRow.append(
    element(document, "span", undefined, uiCopy("I explicitly consent to this selected contribution scope.")),
    consent,
  );
  const scopeState = status(document, uiCopy("Private owner scope keeps the contribution inside your own retrieval ledger."));
  const createAction = button(document, uiCopy("Submit to review ledger"), "teach-create", true);
  createAction.disabled = true;
  const createState = status(document, uiCopy("No contribution is submitted without the checked consent control."));
  const actions = element(document, "div", "nur-adjunct-actions");
  actions.append(createAction);
  contribute.append(
    element(document, "p", "nur-adjunct-boundary", uiCopy("Deidentified research consent permits governed review only. It does not authorize foundation-model training, institutional promotion or public attribution.")),
    labeledControl(document, uiCopy("Contribution kind"), kind),
    labeledControl(document, uiCopy("Contribution"), content),
    labeledControl(document, uiCopy("Consent scope"), scope),
    labeledControl(document, uiCopy("Sensitivity"), sensitivity),
    scopeState,
    consentRow,
    actions,
    createState,
  );

  const ledger = panel(document, uiCopy("Owner review ledger"), uiCopy("Your contributions"));
  ledger.classList.add("is-wide");
  const ledgerState = status(document, uiCopy("Withdrawal closes future use while preserving the required consent audit."));
  const list = element(document, "div", "nur-adjunct-list");
  ledger.append(ledgerState, list);

  const renderRows = (rows: V197TeachNURContribution[]) => {
    list.replaceChildren();
    if (!rows.length) {
      list.append(empty(document, uiCopy("No contribution submitted"), uiCopy("NUR does not invent a teaching history. Your first explicit contribution will appear here.")));
      return;
    }
    for (const contribution of rows) {
      const row = element(document, "article", "nur-adjunct-row");
      const head = element(document, "div", "nur-adjunct-row-head");
      head.append(
        userElement(document, "strong", undefined, contribution.content),
        element(document, "span", "nur-adjunct-chip", controlledLabel(contribution.status)),
      );
      row.append(
        head,
        element(document, "p", undefined, uiFormat("{0} · {1} · {2}", [
          controlledLabel(contribution.contribution_kind),
          controlledLabel(contribution.consent_scope),
          controlledLabel(contribution.sensitivity),
        ])),
        element(document, "p", undefined, uiFormat("Model training: {0} · Promotion: {1}", [
          controlledLabel(contribution.model_training_status, uiSource("Not authorized")),
          controlledLabel(contribution.institutional_promotion_status, uiSource("Not authorized")),
        ])),
      );
      if (contribution.consent_granted && !["WITHDRAWN", "REJECTED", "ROLLED_BACK"].includes(contribution.status)) {
        const withdraw = button(document, uiCopy("Withdraw consent"), `teach-withdraw-${contribution.id}`);
        const rowActions = element(document, "div", "nur-adjunct-actions");
        rowActions.append(withdraw);
        withdraw.addEventListener("click", async () => {
          withdraw.disabled = true;
          try {
            await api.reviewTeachNURContribution(
              contribution.id,
              { action: "WITHDRAW_CONSENT", review_note: "Withdrawn by owner from the V197 contribution ledger." },
              requestKey(`teach-withdraw-${contribution.id}`),
            );
            setStatus(ledgerState, uiCopy("Consent withdrawn. The audit remains, but future use is closed."), "good");
            await refreshLedger();
          } catch (error) {
            setStatus(ledgerState, localizedFailure(error, uiSource("Consent could not be withdrawn.")), "warn");
            withdraw.disabled = false;
          }
        });
        row.append(rowActions);
      }
      list.append(row);
    }
  };

  const refreshLedger = async () => renderRows(await api.teachNURContributions(undefined, 100));

  const syncConsent = () => {
    createAction.disabled = !consent.checked;
    setStatus(
      createState,
      consent.checked
        ? uiCopy("Consent is explicit for this submission and can later be withdrawn.")
        : uiCopy("No contribution is submitted without the checked consent control."),
      consent.checked ? "good" : "quiet",
    );
  };
  consent.addEventListener("change", syncConsent);
  scope.addEventListener("change", () => {
    setStatus(
      scopeState,
      scope.value === "DEIDENTIFIED_RESEARCH"
        ? uiCopy("This permits governed deidentified research review, not model training or public promotion.")
        : uiCopy("Private owner scope keeps the contribution inside your own retrieval ledger."),
    );
    consent.checked = false;
    syncConsent();
  });

  createAction.addEventListener("click", async () => {
    const contribution = content.value.trim();
    if (!consent.checked || !contribution) {
      setStatus(createState, consent.checked ? uiCopy("Write the contribution you want reviewed.") : uiCopy("Explicit consent is required."), "warn");
      return;
    }
    createAction.disabled = true;
    setStatus(createState, uiCopy("Submitting only this bounded contribution..."));
    try {
      await api.createTeachNURContribution({
        contribution_kind: kind.value as V197TeachNURContributionKind,
        content: contribution,
        orbit_id: orbitId,
        language_tag: snapshot.preferences?.locale ?? snapshot.session.profile.locale ?? "und",
        consent_scope: scope.value as "PRIVATE_OWNER" | "DEIDENTIFIED_RESEARCH",
        consent_granted: true,
        consent_policy_version: "teach-nur-v1",
        sensitivity: sensitivity.value as V197MemorySensitivity,
        confidence: 1,
        source_refs: [],
      }, requestKey("teach-create"));
      content.value = "";
      consent.checked = false;
      setStatus(createState, uiCopy("Contribution entered your owner review ledger."), "good");
      await refreshLedger();
    } catch (error) {
      setStatus(createState, localizedFailure(error, uiSource("The contribution could not be submitted.")), "warn");
    } finally {
      createAction.disabled = !consent.checked;
    }
  });

  grid.append(contribute, ledger);
  await refreshLedger();
}

function billingPrice(plan: V197BillingPlan): string {
  if (plan.is_free) return uiCopy(ADJUNCT_COPY.free);
  const amount = plan.price_minor / 100;
  try {
    return new Intl.NumberFormat(activeUiLocale(), {
      style: "currency",
      currency: plan.currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const formattedAmount = new Intl.NumberFormat(activeUiLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return uiFormat("{0} {1}", [plan.currency, formattedAmount]);
  }
}

function billingLegalLinks(document: Document, state: V197BillingState): HTMLElement {
  const links = element(document, "div", "nur-adjunct-actions");
  for (const [label, value] of [
    [ADJUNCT_COPY.terms, state.terms_url],
    [ADJUNCT_COPY.privacy, state.privacy_url],
    [ADJUNCT_COPY.refundPolicy, state.refund_policy_url],
  ] as const) {
    const url = safeExternalUrl(value);
    if (!url) continue;
    const anchor = element(document, "a", "nur-adjunct-button", uiCopy(label)) as HTMLAnchorElement;
    anchor.href = url.toString();
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    links.append(anchor);
  }
  if (!links.childElementCount) {
    links.append(status(document, uiCopy("Provider legal links are not configured. Paid checkout remains unavailable until they are present."), "warn"));
  }
  return links;
}

function externalFallback(document: Document, container: HTMLElement, value: string, label: string): boolean {
  const url = safeExternalUrl(value);
  if (!url) return false;
  container.querySelector("[data-adjunct-external-fallback]")?.remove();
  const anchor = element(document, "a", "nur-adjunct-button", label) as HTMLAnchorElement;
  anchor.href = url.toString();
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.dataset.adjunctExternalFallback = "true";
  container.append(anchor);
  return true;
}

async function renderBilling(document: Document, api: V197ApiClient): Promise<void> {
  const [plans, billing] = await Promise.all([api.billingPlans(), api.billingSubscription()]);
  const shell = mount(
    document,
    uiCopy("Billing without hidden authority."),
    uiCopy("Plans, entitlements, renewal state and provider handoff come from the billing ledger. NUR never fabricates a purchase or silently changes your subscription."),
  );
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const current = panel(document, uiCopy("Owner subscription"), billingPlanName(billing.subscription?.plan_code));
  const currentFacts = element(document, "div", "nur-adjunct-facts");
  currentFacts.append(
    fact(document, uiCopy("Provider"), billing.subscription ? uiCopy("Billing provider") : (billing.provider_configured ? uiCopy("Configured, no subscription") : uiCopy("Disabled"))),
    fact(document, uiCopy("Status"), controlledLabel(billing.subscription?.status ?? "FREE")),
    fact(document, uiCopy("Renews"), billing.subscription ? (billing.subscription.cancel_at_period_end ? uiCopy("No · cancellation scheduled") : uiCopy("Provider managed")) : uiCopy("No paid renewal")),
    fact(document, uiCopy("Paid through"), date(billing.subscription?.current_period_end)),
  );
  const portal = button(document, uiCopy("Manage subscription"), "billing-portal");
  portal.disabled = !billing.portal_available;
  const portalState = status(
    document,
    billing.subscription?.cancel_at_period_end
      ? uiCopy("Cancellation is scheduled; access remains until the paid period ends.")
      : billing.subscription
        ? uiCopy("Manage renewal, invoices, or cancellation in the provider portal.")
        : uiCopy("No paid subscription. Orbit Scan Free remains available."),
    billing.provider_configured ? "quiet" : "warn",
  );
  const currentActions = element(document, "div", "nur-adjunct-actions");
  currentActions.append(portal);
  current.append(currentFacts, currentActions, portalState, billingLegalLinks(document, billing));
  portal.addEventListener("click", async () => {
    portal.disabled = true;
    setStatus(portalState, uiCopy("Requesting a short-lived provider portal..."));
    try {
      const response = await api.billingPortal();
      const url = safeExternalUrl(response.url);
      if (!url) {
        setStatus(portalState, uiCopy("The API did not return a valid HTTPS portal URL. Nothing was opened."), "warn");
      } else if (!openExternalUrl(url.toString())) {
        externalFallback(document, currentActions, url.toString(), uiCopy("Open secure billing portal"));
        setStatus(portalState, uiCopy("Your browser blocked the new tab. Use the secure provider link shown beside this control."), "warn");
      } else {
        setStatus(portalState, uiFormat("Provider portal opened in a new tab. Link expires {0}.", [date(response.expires_at)]), "good");
      }
    } catch (error) {
      setStatus(portalState, localizedFailure(error, uiSource("The provider portal is unavailable.")), "warn");
    } finally {
      portal.disabled = !billing.portal_available;
    }
  });

  const entitlements = panel(document, uiCopy("Server projection"), uiCopy("Current entitlements"));
  const entitlementList = element(document, "div", "nur-adjunct-list");
  if (!billing.entitlements.length) {
    entitlementList.append(empty(document, uiCopy("No paid entitlement projection"), uiCopy("Free access remains governed by the server. No paid feature is implied.")));
  }
  for (const entitlement of billing.entitlements) {
    const row = element(document, "div", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(
      element(document, "strong", undefined, billingFeatureLabel(entitlement.feature_key)),
      element(document, "span", "nur-adjunct-chip", entitlement.allowed ? uiCopy("ALLOWED") : uiCopy("NOT INCLUDED")),
    );
    const usage = entitlement.usage_limit === null
      ? uiFormat("{0} used · no fixed limit returned", [entitlement.usage_consumed])
      : uiFormat("{0} / {1} used", [entitlement.usage_consumed, entitlement.usage_limit]);
    row.append(head, element(document, "p", undefined, usage));
    entitlementList.append(row);
  }
  entitlements.append(entitlementList);

  const available = panel(document, uiCopy("Available plans"), uiCopy("Choose only through the real provider"));
  available.classList.add("is-wide");
  const checkoutState = status(
    document,
    billing.provider_configured
      ? uiCopy("Checkout opens only after the API returns a valid HTTPS provider URL.")
      : uiCopy("Billing provider is disabled. Plan information is visible, but purchase controls are unavailable."),
    billing.provider_configured ? "quiet" : "warn",
  );
  const planList = element(document, "div", "nur-adjunct-list");
  if (!plans.length) {
    planList.append(empty(document, uiCopy("No active plan returned"), uiCopy("NUR will not invent price, entitlement or availability data.")));
  }
  for (const plan of plans) {
    const planName = billingPlanName(plan);
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(
      element(document, "strong", undefined, uiFormat("{0} · {1}", [planName, billingPrice(plan)])),
      element(document, "span", "nur-adjunct-chip", controlledLabel(plan.billing_interval)),
    );
    row.append(
      head,
      element(document, "p", undefined, billingPlanDescription(plan)),
      element(document, "p", "nur-adjunct-boundary", uiFormat("{0} server-declared features · legal copy {1}", [plan.features.filter(feature => feature.allowed).length, plan.legal_copy_version])),
    );
    const planActions = element(document, "div", "nur-adjunct-actions");
    const checkout = button(document, plan.is_free ? uiCopy("Included free") : uiFormat("Choose {0}", [planName]), `billing-checkout-${plan.code}`, !plan.is_free);
    checkout.disabled = plan.is_free || !plan.active || !billing.provider_configured;
    planActions.append(checkout);
    checkout.addEventListener("click", async () => {
      checkout.disabled = true;
      setStatus(checkoutState, uiFormat("Creating an idempotent {0} provider handoff...", [planName]));
      try {
        const response = await api.billingCheckout(plan.code, requestKey("billing-checkout"));
        const url = safeExternalUrl(response.checkout_url);
        if (!url) {
          setStatus(checkoutState, uiCopy("The API did not return a valid HTTPS checkout URL. Nothing was opened and no purchase is claimed."), "warn");
        } else if (!openExternalUrl(url.toString())) {
          externalFallback(document, planActions, url.toString(), uiFormat("Continue to {0}", [planName]));
          setStatus(checkoutState, uiCopy("Your browser blocked the new tab. Use the secure provider link on this plan. No subscription is claimed yet."), "warn");
        } else {
          setStatus(checkoutState, uiFormat("{0} checkout opened. No subscription is claimed until the webhook ledger confirms it.", [planName]), "good");
        }
      } catch (error) {
        setStatus(checkoutState, localizedFailure(error, uiSource("Checkout is unavailable.")), "warn");
      } finally {
        checkout.disabled = plan.is_free || !plan.active || !billing.provider_configured;
      }
    });
    row.append(planActions);
    planList.append(row);
  }
  available.append(checkoutState, planList);
  grid.append(current, entitlements, available);
}

async function renderOwnerCapsules(document: Document, api: V197ApiClient, snapshot: V197BridgeSnapshot): Promise<void> {
  const orbitId = activeOrbitId(snapshot);
  const [sources, initialCapsules] = await Promise.all([
    orbitId ? api.orbitSources(orbitId) : Promise.resolve([]),
    api.ownedCapsules(),
  ]);
  let capsules = initialCapsules;
  const shell = mount(
    document,
    uiCopy("Share a room, never your whole mind."),
    uiCopy("A Context Capsule copies only explicitly allowlisted Orbit sources. Recipient grants, expiry, audit and revocation remain separate owner-controlled boundaries."),
    "/universe/orbits",
  );
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const create = panel(document, uiCopy("Source allowlist"), uiCopy("Create a bounded Context Capsule"));
  create.classList.add("is-wide");
  const title = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  title.dataset.adjunctControl = "capsules-title";
  title.placeholder = uiCopy("Capsule title");
  const purpose = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  purpose.dataset.adjunctControl = "capsules-purpose";
  purpose.placeholder = uiCopy("What should this bounded room help the recipient do?");
  const capability = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  capability.dataset.adjunctControl = "capsules-capability";
  for (const [value, label] of CAPSULE_CAPABILITY_OPTIONS) {
    const option = element(document, "option", undefined, uiCopy(label)) as HTMLOptionElement;
    option.value = value;
    capability.append(option);
  }
  const instructions = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  instructions.dataset.adjunctControl = "capsules-instructions";
  instructions.placeholder = uiCopy("Optional instructions shown inside the recipient room");
  const expires = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  expires.type = "datetime-local";
  expires.dataset.adjunctControl = "capsules-expires";
  const sourceList = element(document, "div", "nur-adjunct-list");
  if (!sources.length) {
    sourceList.append(empty(
      document,
      orbitId ? uiCopy("No approved Orbit source") : uiCopy("No active Orbit"),
      orbitId
        ? uiCopy("Attach an owned decision, reference or other supported source to this Orbit before creating a Capsule.")
        : uiCopy("Choose an active Orbit before creating a Context Capsule."),
    ));
  }
  for (const source of sources) {
    const row = element(document, "label", "nur-adjunct-toggle");
    const copy = element(document, "span", undefined, uiFormat("{0} · {1} · {2}", [
      controlledLabel(source.source_kind, uiSource("Orbit source")),
      source.source_id,
      controlledLabel(source.inclusion_mode),
    ]));
    const check = element(document, "input") as HTMLInputElement;
    check.type = "checkbox";
    check.dataset.capsuleSourceId = source.id;
    check.dataset.adjunctControl = `capsules-source-${source.id}`;
    row.append(copy, check);
    sourceList.append(row);
  }
  const createAction = button(document, uiCopy("Create bounded capsule"), "capsules-create", true);
  createAction.disabled = !orbitId || !sources.length;
  const createState = status(
    document,
    sources.length
      ? uiCopy("Select at least one source. Nothing else in Memory, Talk, Journal, Timeline or Omega is traversable.")
      : uiCopy("Creation is disabled until an active Orbit has an explicit approved source."),
    sources.length ? "quiet" : "warn",
  );
  const createActions = element(document, "div", "nur-adjunct-actions");
  createActions.append(createAction);
  create.append(
    element(document, "p", "nur-adjunct-boundary", uiCopy("Creating a Capsule does not share it. A recipient grant is a second explicit write, and revocation closes access immediately.")),
    labeledControl(document, uiCopy("Title"), title),
    labeledControl(document, uiCopy("Purpose"), purpose),
    labeledControl(document, uiCopy("Recipient capability"), capability),
    labeledControl(document, uiCopy("Recipient instructions"), instructions),
    labeledControl(document, uiCopy("Capsule expiry (optional)"), expires),
    element(document, "h3", undefined, uiCopy("Approved sources")),
    sourceList,
    createActions,
    createState,
  );

  const owned = panel(document, uiCopy("Owner lifecycle"), uiCopy("Your Context Capsules"));
  owned.classList.add("is-wide");
  const ownedState = status(document, uiCopy("Email grants are hash-addressed by the server; this page never claims delivery or recipient acceptance."));
  const ownedList = element(document, "div", "nur-adjunct-list");
  owned.append(ownedState, ownedList);

  const renderOwned = () => {
    ownedList.replaceChildren();
    if (!capsules.length) {
      ownedList.append(empty(document, uiCopy("No owner Capsule"), uiCopy("Create a source-bounded room above. It remains unshared until you add a recipient grant.")));
      return;
    }
    for (const capsule of capsules) {
      const row = element(document, "article", "nur-adjunct-row");
      const capsuleState = capsule.revoked_at ? "REVOKED" : "ACTIVE";
      const capsuleStateLabel = capsule.revoked_at ? uiCopy("REVOKED") : uiCopy("ACTIVE");
      const head = element(document, "div", "nur-adjunct-row-head");
      head.append(
        userElement(document, "strong", undefined, capsule.title),
        element(document, "span", "nur-adjunct-chip", capsuleStateLabel),
      );
      row.append(
        head,
        userElement(document, "p", undefined, capsule.purpose),
        element(document, "p", "nur-adjunct-boundary", uiFormat("{0} · expires {1}", [controlledLabel(capsule.capability), date(capsule.expires_at)])),
      );
      const controls = element(document, "div", "nur-adjunct-actions");
      const open = button(document, uiCopy("Open owner controls"), `capsules-open-${capsule.id}`);
      open.addEventListener("click", () => navigate(`/capsule/${encodeURIComponent(capsule.id)}`));
      controls.append(open);
      row.append(controls);
      if (capsuleState === "ACTIVE") {
        const email = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
        email.type = "email";
        email.autocomplete = "email";
        email.placeholder = uiCopy("Exact recipient account email");
        email.dataset.adjunctControl = `capsules-grant-email-${capsule.id}`;
        const grantCapability = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
        grantCapability.dataset.adjunctControl = `capsules-grant-capability-${capsule.id}`;
        for (const [value, label] of CAPSULE_CAPABILITY_OPTIONS) {
          const option = element(document, "option", undefined, uiCopy(label)) as HTMLOptionElement;
          option.value = value;
          grantCapability.append(option);
        }
        grantCapability.value = capsule.capability === "READ_ONLY" ? "READ_ONLY" : "ASK_SCOPED_QUESTIONS";
        const grant = button(document, uiCopy("Grant this recipient"), `capsules-grant-${capsule.id}`, true);
        const grantState = status(document, uiCopy("Granting access does not send an email or prove the recipient opened the room."));
        const grantActions = element(document, "div", "nur-adjunct-actions");
        grantActions.append(grant);
        grant.addEventListener("click", async () => {
          const recipientEmail = email.value.trim();
          if (!recipientEmail || !email.checkValidity()) {
            setStatus(grantState, uiCopy("Enter the exact valid email for the intended recipient."), "warn");
            return;
          }
          grant.disabled = true;
          setStatus(grantState, uiCopy("Writing the recipient grant..."));
          try {
            await api.grantCapsule(capsule.id, {
              recipient_email: recipientEmail,
              capability: grantCapability.value,
              expires_at: capsule.expires_at,
            });
            email.value = "";
            setStatus(grantState, uiCopy("Recipient grant persisted. Delivery and opening remain unclaimed."), "good");
          } catch (error) {
            setStatus(grantState, localizedFailure(error, uiSource("The recipient grant failed.")), "warn");
          } finally {
            grant.disabled = false;
          }
        });
        row.append(
          labeledControl(document, uiCopy("Recipient email"), email),
          labeledControl(document, uiCopy("Granted capability"), grantCapability),
          grantActions,
          grantState,
        );
      }
      ownedList.append(row);
    }
  };

  createAction.addEventListener("click", async () => {
    const selectedSourceIds = Array.from(sourceList.querySelectorAll<HTMLInputElement>("[data-capsule-source-id]:checked"))
      .map(control => control.dataset.capsuleSourceId)
      .filter((value): value is string => Boolean(value));
    const capsuleTitle = title.value.trim();
    const capsulePurpose = purpose.value.trim();
    if (!capsuleTitle || !capsulePurpose) {
      setStatus(createState, uiCopy("A Capsule title and bounded purpose are required."), "warn");
      return;
    }
    if (!orbitId || !selectedSourceIds.length) {
      setStatus(createState, orbitId ? uiCopy("Select at least one approved Orbit source.") : uiCopy("Choose an active Orbit first."), "warn");
      return;
    }
    let expiresAt: string | null = null;
    if (expires.value) {
      const parsed = new Date(expires.value);
      if (Number.isNaN(parsed.getTime())) {
        setStatus(createState, uiCopy("Choose a valid Capsule expiry."), "warn");
        return;
      }
      expiresAt = parsed.toISOString();
    }
    createAction.disabled = true;
    setStatus(createState, uiCopy("Copying only the selected source allowlist..."));
    try {
      const capsule = await api.createCapsule(orbitId, {
        title: capsuleTitle,
        purpose: capsulePurpose,
        capability: capability.value,
        recipient_instructions: instructions.value.trim() || null,
        expires_at: expiresAt,
        orbit_source_ids: selectedSourceIds,
        representations: {},
      });
      capsules = [capsule, ...capsules];
      title.value = "";
      purpose.value = "";
      instructions.value = "";
      expires.value = "";
      sourceList.querySelectorAll<HTMLInputElement>("[data-capsule-source-id]").forEach(control => { control.checked = false; });
      renderOwned();
      setStatus(createState, uiCopy("Capsule created from the selected allowlist. No recipient has access yet."), "good");
    } catch (error) {
      setStatus(createState, localizedFailure(error, uiSource("The Capsule could not be created.")), "warn");
    } finally {
      createAction.disabled = !sources.length;
    }
  });

  renderOwned();
  grid.append(create, owned);
}

function capsuleStatePanel(document: Document, view: V197CapsuleView): HTMLElement {
  const overview = panel(document, uiCopy("Approved Context Capsule"), uiCopy("Shared context"));
  overview.classList.add("is-wide");
  overview.append(userElement(document, "h3", "nur-adjunct-owner-copy", view.title));
  const facts = element(document, "div", "nur-adjunct-facts");
  facts.append(
    fact(document, uiCopy("State"), controlledLabel(view.state)),
    fact(document, uiCopy("Purpose"), view.purpose),
    fact(document, uiCopy("Access"), controlledLabel(view.capability)),
    fact(document, uiCopy("Expires"), date(view.expires_at)),
  );
  setVerbatimUserText(facts.querySelector<HTMLElement>(".nur-adjunct-fact:nth-of-type(2) strong"), view.purpose);
  overview.append(facts, element(document, "p", "nur-adjunct-boundary", uiCopy("Only the sources approved for this room can be reached.")));
  return overview;
}

async function renderRecipientCapsule(document: Document, api: V197ApiClient, capsuleId: string, view: V197CapsuleView): Promise<void> {
  const shell = mount(document, uiFormat("{0}'s shared context", [view.owner_display]), view.state === "ACTIVE"
    ? uiCopy("Held open deliberately. Only the sources approved for this room can be reached.")
    : uiFormat("This bounded room is {0}. Nothing outside it becomes visible.", [controlledLabel(view.state)]), "/today");
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  grid.append(capsuleStatePanel(document, view));

  if (view.state !== "ACTIVE") {
    const terminal = panel(document, controlledLabel(view.state), uiCopy("The owner's boundary now closes this room."));
    terminal.classList.add("is-wide");
    terminal.append(empty(document, uiCopy("Access is closed"), uiCopy("No cached answer is shown and no new question can be asked after revocation or expiry.")));
    grid.append(terminal);
    return;
  }

  const included = panel(document, uiCopy("Approved source ledger"), uiCopy("What is included"));
  const includedList = element(document, "div", "nur-adjunct-list");
  if (!view.included.length) includedList.append(empty(document, uiCopy("No source was included"), uiCopy("This room carries no answerable context.")));
  for (const source of view.included) {
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(
      userElement(document, "strong", undefined, source.title),
      element(document, "span", "nur-adjunct-chip", uiFormat("{0} · {1}", [
        controlledLabel(source.source_kind, uiSource("Approved source")),
        controlledLabel(source.representation),
      ])),
    );
    row.append(head, userElement(document, "p", undefined, source.body));
    includedList.append(row);
  }
  included.append(includedList);

  const excluded = panel(document, uiCopy("Boundary proof"), uiCopy("What is excluded"));
  const excludedList = element(document, "div", "nur-adjunct-list");
  if (!view.excluded_summary.length) excludedList.append(empty(document, uiCopy("No withheld category is enumerated"), uiCopy("The recipient still cannot traverse the owner's general memory, Talk, Journal, Timeline, Settings or Omega.")));
  for (const item of view.excluded_summary) {
    const row = element(document, "div", "nur-adjunct-row");
    row.append(element(document, "strong", undefined, uiFormat("{0} · {1} withheld", [controlledLabel(item.source_kind), text(item.count, "0")])));
    row.append(element(document, "p", undefined, uiCopy(ADJUNCT_COPY.withheldByOwner)));
    excludedList.append(row);
  }
  excluded.append(excludedList);

  const ask = panel(document, uiCopy("Scoped question"), uiCopy("Ask within this approved boundary"));
  ask.classList.add("is-wide");
  const canAsk = view.capability === "ASK_SCOPED_QUESTIONS";
  const field = element(document, "label", "nur-adjunct-field");
  field.append(element(document, "span", undefined, uiCopy("Question")));
  const input = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  input.placeholder = canAsk ? uiCopy("Ask only about the approved sources…") : uiCopy("This room is read-only.");
  input.disabled = !canAsk;
  input.dataset.adjunctControl = "capsule-question";
  field.append(input);
  const actions = element(document, "div", "nur-adjunct-actions");
  const askButton = button(document, uiCopy("Ask from approved context"), "capsule-ask", true);
  askButton.disabled = !canAsk;
  const copyButton = button(document, uiCopy("Copy room address"), "capsule-copy");
  actions.append(askButton, copyButton);
  const askState = status(document, canAsk ? uiCopy("Answers cite only included source IDs.") : uiCopy("The owner granted read-only access."));
  const answerHost = element(document, "div");
  ask.append(field, actions, askState, answerHost);

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(window.location.href);
    askState.textContent = uiCopy("Room address copied.");
    askState.className = "nur-adjunct-status is-good";
  });
  askButton.addEventListener("click", async () => {
    const question = input.value.trim();
    if (!question) {
      askState.textContent = uiCopy("Write one scoped question first.");
      askState.className = "nur-adjunct-status is-warn";
      return;
    }
    askButton.disabled = true;
    askState.textContent = uiCopy("Reading only the approved sources…");
    try {
      const answer: V197CapsuleAnswer = await api.askCapsule(capsuleId, question);
      answerHost.replaceChildren();
      const answerNode = element(document, "article", "nur-adjunct-answer");
      answerNode.append(element(document, "p", "nur-adjunct-eyebrow", uiFormat("{0} · source-bound", [controlledLabel(answer.answer_mode, uiSource("Scoped answer"))])));
      answerNode.append(userElement(document, "blockquote", undefined, answer.answer_text));
      answerNode.append(element(document, "p", undefined, answer.source_refs.length ? uiFormat("Sources: {0}", [answer.source_refs.join(", ")]) : uiCopy("No approved source supported a direct answer.")));
      if (answer.policy_explanation) answerNode.append(element(document, "p", "nur-adjunct-boundary", uiCopy("The answer remained inside the approved source boundary.")));
      answerHost.append(answerNode);
      askState.textContent = uiCopy("Answer persisted inside the capsule ledger.");
      askState.className = "nur-adjunct-status is-good";
    } catch (error) {
      askState.textContent = localizedFailure(error, uiSource("The bounded answer could not be created."));
      askState.className = "nur-adjunct-status is-warn";
    } finally {
      askButton.disabled = !canAsk;
    }
  });

  grid.append(included, excluded, ask);
}

async function renderOwnerCapsule(document: Document, api: V197ApiClient, capsule: V197OwnedCapsule): Promise<void> {
  const shell = mount(document, uiCopy("A bounded room you control."), uiCopy("Owner preview exposes lifecycle and audit controls, never the recipient's private question composer."), "/universe/orbits");
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const lifecycle = panel(document, uiCopy("Owner capsule"), uiCopy("Bounded owner context"));
  lifecycle.classList.add("is-wide");
  lifecycle.append(userElement(document, "h3", "nur-adjunct-owner-copy", capsule.title));
  const state = capsule.revoked_at ? "REVOKED" : "ACTIVE";
  const stateLabel = capsule.revoked_at ? uiCopy("REVOKED") : uiCopy("ACTIVE");
  const facts = element(document, "div", "nur-adjunct-facts");
  facts.append(
    fact(document, uiCopy("State"), stateLabel),
    fact(document, uiCopy("Purpose"), capsule.purpose),
    fact(document, uiCopy("Capability"), controlledLabel(capsule.capability)),
    fact(document, uiCopy("Expires"), date(capsule.expires_at)),
  );
  setVerbatimUserText(facts.querySelector<HTMLElement>(".nur-adjunct-fact:nth-of-type(2) strong"), capsule.purpose);
  lifecycle.append(facts);
  const actions = element(document, "div", "nur-adjunct-actions");
  const auditButton = button(document, uiCopy("Open access audit"), "capsule-audit");
  const revokeButton = button(document, uiCopy("Revoke now"), "capsule-revoke", true);
  revokeButton.disabled = state === "REVOKED";
  actions.append(auditButton, revokeButton);
  const lifecycleState = status(document, state === "ACTIVE" ? uiCopy("Revocation takes effect immediately.") : uiCopy("This capsule is already revoked."), state === "ACTIVE" ? "quiet" : "warn");
  const auditHost = element(document, "div", "nur-adjunct-list");
  lifecycle.append(actions, lifecycleState, auditHost);
  auditButton.addEventListener("click", async () => {
    auditButton.disabled = true;
    try {
      const rows = await api.capsuleAudit(capsule.id);
      auditHost.replaceChildren();
      if (!rows.length) auditHost.append(empty(document, uiCopy("No access event yet"), uiCopy("The room has not been opened by a recipient.")));
      for (const row of rows) {
        const item = element(document, "div", "nur-adjunct-row");
        item.append(element(document, "strong", undefined, controlledLabel(row.event_kind, uiSource("Audit event"))), element(document, "p", undefined, date(row.created_at)));
        auditHost.append(item);
      }
      lifecycleState.textContent = rows.length === 1
        ? uiFormat("{0} owner-scoped audit event.", [rows.length])
        : uiFormat("{0} owner-scoped audit events.", [rows.length]);
    } catch (error) {
      lifecycleState.textContent = localizedFailure(error, uiSource("Audit could not be read."));
      lifecycleState.className = "nur-adjunct-status is-warn";
    } finally {
      auditButton.disabled = false;
    }
  });
  revokeButton.addEventListener("click", async () => {
    revokeButton.disabled = true;
    lifecycleState.textContent = uiCopy("Closing the room…");
    try {
      await api.revokeCapsule(capsule.id);
      lifecycleState.textContent = uiCopy("Revoked. Recipient reads and asks are blocked immediately.");
      lifecycleState.className = "nur-adjunct-status is-good";
    } catch (error) {
      lifecycleState.textContent = localizedFailure(error, uiSource("Revocation failed."));
      lifecycleState.className = "nur-adjunct-status is-warn";
      revokeButton.disabled = false;
    }
  });
  grid.append(lifecycle);
}

async function renderCapsule(document: Document, api: V197ApiClient, capsuleId: string): Promise<void> {
  try {
    const view = await api.capsuleView(capsuleId);
    await renderRecipientCapsule(document, api, capsuleId, view);
    return;
  } catch (error) {
    if (!(error instanceof V197ApiError) || error.status !== 404) throw error;
  }
  const owned = (await api.ownedCapsules()).find(row => row.id === capsuleId);
  if (owned) {
    await renderOwnerCapsule(document, api, owned);
    return;
  }
  const shell = mount(document, uiCopy("This room is not available."), uiCopy("No Context Capsule is shared with this session at this address."), "/today");
  const unavailable = panel(document, uiCopy("Boundary held"), uiCopy("Nothing leaks through a missing grant"));
  unavailable.classList.add("is-wide");
  unavailable.append(empty(document, uiCopy("No active grant"), uiCopy("Sign in as the intended recipient or ask the owner for a current capsule address.")));
  const grid = element(document, "div", "nur-adjunct-grid");
  grid.append(unavailable);
  shell.append(grid);
}

function omegaList(
  document: Document,
  rows: Array<Record<string, unknown>>,
  titleKey: string,
  bodyKey: string,
  chipKey: string,
  actions?: (row: Record<string, unknown>) => HTMLElement,
): HTMLElement {
  const list = element(document, "div", "nur-adjunct-list");
  if (!rows.length) return empty(document, uiCopy("No persisted evidence yet"), uiCopy("Omega does not invent a result before the owner's evidence exists."));
  for (const row of rows) {
    const item = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(
      userElement(document, "strong", undefined, text(row[titleKey])),
      element(document, "span", "nur-adjunct-chip", controlledLabel(row[chipKey], ADJUNCT_COPY.unresolved)),
    );
    item.append(head);
    const body = text(row[bodyKey], "");
    if (body) item.append(userElement(document, "p", undefined, body));
    if (actions) item.append(actions(row));
    list.append(item);
  }
  return list;
}

function navigate(route: string): void {
  window.history.pushState({}, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function renderOmegaDashboard(document: Document, api: V197ApiClient): Promise<void> {
  const [dashboard, scheduler] = await Promise.all([api.omegaDashboard(), api.omegaScheduler()]);
  const shell = mount(document, uiCopy("Evidence changes the model, deliberately."), uiCopy("Omega is an owner-only cognition ledger: claims, contradictions, predictions and governed learning proposals. It is not sentience and exposes no chain-of-thought."));
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const runtime = panel(document, uiCopy("Omega substrate"), uiCopy("Consolidation status"));
  runtime.classList.add("is-wide");
  const facts = element(document, "div", "nur-adjunct-facts");
  facts.append(
    fact(document, uiCopy("Scheduler"), controlledLabel(scheduler.enabled && scheduler.scheduled_consolidation ? "ACTIVE" : "DISABLED")),
    fact(document, uiCopy("Worker"), controlledLabel(scheduler.worker_mode, uiSource("Worker"))),
    fact(document, uiCopy("Last run"), controlledLabel(scheduler.last_consolidation_status, uiSource("Not run"))),
    fact(document, uiCopy("Interval"), uiFormat("{0} hours", [scheduler.interval_hours])),
  );
  runtime.append(facts);
  const runtimeActions = element(document, "div", "nur-adjunct-actions");
  const consolidate = button(document, uiCopy("Consolidate owner evidence"), "omega-consolidate", true);
  const review = button(document, uiFormat("Open review queue ({0})", [dashboard.review_queue.length]), "omega-review");
  const exportButton = button(document, uiCopy("Export owner Omega"), "omega-export");
  runtimeActions.append(consolidate, review, exportButton);
  const runtimeState = status(document, uiCopy("Consolidation proposes changes; sensitive inferences still require owner review."));
  runtime.append(runtimeActions, runtimeState);
  review.addEventListener("click", () => navigate("/universe/omega/review"));
  consolidate.addEventListener("click", async () => {
    consolidate.disabled = true;
    runtimeState.textContent = uiCopy("Consolidating the owner ledger…");
    try {
      const run = await api.consolidateOmega();
      runtimeState.textContent = uiFormat("Run {0}: {1} claims created, {2} contradictions found.", [controlledLabel(run.status), text(run.created_claims, "0"), text(run.contradictions_found, "0")]);
      runtimeState.className = "nur-adjunct-status is-good";
    } catch (error) {
      runtimeState.textContent = localizedFailure(error, uiSource("Consolidation did not complete."));
      runtimeState.className = "nur-adjunct-status is-warn";
    } finally {
      consolidate.disabled = false;
    }
  });
  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    try {
      const data = await api.omegaExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = element(document, "a") as HTMLAnchorElement;
      anchor.href = url;
      anchor.download = "nur-omega-owner-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      runtimeState.textContent = uiCopy("Owner-scoped Omega export prepared locally.");
      runtimeState.className = "nur-adjunct-status is-good";
    } catch (error) {
      runtimeState.textContent = localizedFailure(error, uiSource("Export failed."));
      runtimeState.className = "nur-adjunct-status is-warn";
    } finally {
      exportButton.disabled = false;
    }
  });

  const claimPanel = panel(document, uiCopy("Candidate understanding"), uiFormat("Claims · {0}", [dashboard.claims.length]));
  claimPanel.append(omegaList(document, dashboard.claims, "claim_text", "", "truth_status", row => {
    const actions = element(document, "div", "nur-adjunct-actions");
    const why = button(document, uiCopy("Why changed?"), "omega-why");
    why.addEventListener("click", () => navigate(`/universe/omega/why-changed/${recordId(row)}`));
    actions.append(why);
    return actions;
  }));

  const contradictionPanel = panel(document, uiCopy("Open tension"), uiFormat("Contradictions · {0}", [dashboard.contradictions.length]));
  contradictionPanel.append(omegaList(document, dashboard.contradictions, "description", "proposed_resolution", "severity"));
  const predictionPanel = panel(document, uiCopy("Unresolved future"), uiFormat("Predictions · {0}", [dashboard.predictions.length]));
  predictionPanel.append(omegaList(document, dashboard.predictions, "prediction_text", "expected_observation", "status"));
  const proposalPanel = panel(document, uiCopy("Governed learning"), uiFormat("Proposals · {0}", [dashboard.learning_proposals.length]));
  proposalPanel.append(omegaList(document, dashboard.learning_proposals, "description", "evidence_summary", "status"));
  grid.append(runtime, claimPanel, contradictionPanel, predictionPanel, proposalPanel);
}

async function renderOmegaReview(document: Document, api: V197ApiClient): Promise<void> {
  const rows = await api.omegaReviewQueue();
  const shell = mount(document, uiCopy("Nothing sensitive becomes truth by accident."), uiCopy("Review model-generated claim candidates before they enter the owner evidence graph."), "/universe/omega");
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const review = panel(document, uiCopy("Owner confirmation gate"), uiFormat("Pending review · {0}", [rows.length]));
  review.classList.add("is-wide");
  const reviewState = status(document, uiCopy("Approval and rejection are persisted and owner-scoped."));
  review.append(omegaList(document, rows, "candidate_claim_text", "reason", "sensitivity", row => {
    const actions = element(document, "div", "nur-adjunct-actions");
    const approve = button(document, uiCopy("Approve as reviewed"), `omega-review-approve-${recordId(row)}`, true);
    const reject = button(document, uiCopy("Reject"), `omega-review-reject-${recordId(row)}`);
    const act = async (action: "approve" | "reject") => {
      approve.disabled = true;
      reject.disabled = true;
      try {
        await api.reviewOmegaItem(recordId(row), action);
        row.status = action === "approve" ? "APPROVED" : "REJECTED";
        reviewState.textContent = uiFormat("Candidate {0}. Refreshing owner queue…", [action === "approve" ? uiCopy("approved") : uiCopy("rejected")]);
        reviewState.className = "nur-adjunct-status is-good";
        await renderOmegaReview(document, api);
      } catch (error) {
        reviewState.textContent = localizedFailure(error, uiSource("Review action failed."));
        reviewState.className = "nur-adjunct-status is-warn";
        approve.disabled = false;
        reject.disabled = false;
      }
    };
    approve.addEventListener("click", () => void act("approve"));
    reject.addEventListener("click", () => void act("reject"));
    actions.append(approve, reject);
    return actions;
  }), reviewState);
  grid.append(review);
}

async function renderOmegaWhyChanged(document: Document, api: V197ApiClient, claimId: string): Promise<void> {
  const [why, evidence] = await Promise.all([api.omegaWhyChanged(claimId), api.omegaEvidence(claimId)]);
  const shell = mount(document, uiCopy("Why NUR changed its mind."), uiCopy("A provenance explanation assembled from the owner evidence graph, not hidden chain-of-thought."), "/universe/omega");
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const claimText = text(why.claim_text);
  const claim = userPanel(document, uiCopy("Current claim"), claimText);
  claim.classList.add("is-wide");
  const facts = element(document, "div", "nur-adjunct-facts");
  facts.append(fact(document, uiCopy("Truth state"), controlledLabel(why.current_truth_status)), fact(document, uiCopy("Confidence"), text(why.current_confidence)));
  claim.append(facts);

  const changed = panel(document, uiCopy("Change ledger"), uiCopy("What moved this claim"));
  const reasons = Array.isArray(why.changed_because) ? why.changed_because : [];
  changed.append(omegaList(document, reasons.map((value, index) => ({ id: String(index), title: text(value), state: "EVIDENCE" })), "title", "", "state"));

  const evidencePanel = panel(document, uiCopy("Evidence graph"), uiFormat("Edges · {0}", [evidence.length]));
  evidencePanel.append(omegaList(document, evidence, "relation", "note", "evidence_kind"));
  const actions = element(document, "div", "nur-adjunct-actions");
  const confirm = button(document, uiCopy("Confirm claim"), "omega-claim-confirm", true);
  const retire = button(document, uiCopy("Retire claim"), "omega-claim-retire");
  actions.append(confirm, retire);
  const actionState = status(document, text(why.unresolved_note, uiCopy(ADJUNCT_COPY.ownerReviewFinalAuthority)));
  if (why.unresolved_note) setVerbatimUserText(actionState, text(why.unresolved_note));
  claim.append(actions, actionState);
  const act = async (action: "confirm" | "retire") => {
    confirm.disabled = true;
    retire.disabled = true;
    try {
      if (action === "confirm") await api.confirmOmegaClaim(claimId);
      else await api.retireOmegaClaim(claimId);
      actionState.textContent = action === "confirm" ? uiCopy("Claim confirmed by owner.") : uiCopy("Claim retired from active use.");
      actionState.className = "nur-adjunct-status is-good";
    } catch (error) {
      actionState.textContent = localizedFailure(error, uiSource("Claim action failed."));
      actionState.className = "nur-adjunct-status is-warn";
      confirm.disabled = false;
      retire.disabled = false;
    }
  };
  confirm.addEventListener("click", () => void act("confirm"));
  retire.addEventListener("click", () => void act("retire"));
  grid.append(claim, changed, evidencePanel);
}

function conciseRecord(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!value || typeof value !== "object") return uiCopy(ADJUNCT_COPY.noDetailRecorded);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
    .slice(0, 4)
    .map(([, item]) => uiFormat("{0}: {1}", [uiCopy("Evidence field"), String(item)]));
  return entries.join(" · ") || uiCopy(ADJUNCT_COPY.structuredOwnerEvidence);
}

async function renderCandidateInsights(
  document: Document,
  api: V197ApiClient,
): Promise<void> {
  const insights = await api.candidateInsights();
  const shell = mount(
    document,
    uiCopy("Candidate insight, never silent truth."),
    uiCopy("Every inference keeps its evidence, counter-evidence, uncertainty, provenance and owner decision. Acceptance is explicit; correction preserves the original audit trail."),
    "/universe",
  );
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const overview = panel(document, uiCopy("Owner review queue"), uiFormat("Candidates · {0}", [insights.length]));
  overview.classList.add("is-wide");
  const counts = insights.reduce<Record<string, number>>((result, insight) => {
    result[insight.status] = (result[insight.status] ?? 0) + 1;
    return result;
  }, {});
  const facts = element(document, "div", "nur-adjunct-facts");
  facts.append(
    fact(document, uiCopy("Candidate"), String(counts.CANDIDATE ?? counts.PENDING ?? 0)),
    fact(document, uiCopy("Accepted"), String(counts.ACCEPTED ?? 0)),
    fact(document, uiCopy("Corrected"), String(counts.CORRECTED ?? 0)),
    fact(document, uiCopy("Rejected"), String(counts.REJECTED ?? 0)),
  );
  const generate = button(document, uiCopy("Generate from owner ledger"), "candidate-generate", true);
  const generateState = status(document, uiCopy("Generation may honestly refuse when the owner ledger has insufficient evidence."));
  overview.append(facts, generate, generateState);
  generate.addEventListener("click", async () => {
    generate.disabled = true;
    try {
      await api.generateCandidateInsight();
      await renderCandidateInsights(document, api);
    } catch (error) {
      generateState.textContent = localizedFailure(error, uiSource("Candidate insight was not generated."));
      generateState.className = "nur-adjunct-status is-warn";
      generate.disabled = false;
    }
  });
  grid.append(overview);

  if (!insights.length) {
    const quiet = panel(document, uiCopy("Honest state"), uiCopy("No candidate insight yet"));
    quiet.classList.add("is-wide");
    quiet.append(empty(document, uiCopy("The review queue is empty"), uiCopy("NUR will not invent a pattern merely to populate this page.")));
    grid.append(quiet);
    return;
  }

  for (const insight of insights) {
    const card = userPanel(
      document,
      uiFormat("{0} · {1}", [controlledLabel(insight.insight_type), controlledLabel(insight.provenance_label, uiSource("Owner ledger"))]),
      insight.title,
    );
    card.classList.add("is-wide", "nur-candidate-card");
    const facts = element(document, "div", "nur-adjunct-facts");
    facts.append(
      fact(document, uiCopy("Status"), controlledLabel(insight.status)),
      fact(document, uiCopy("Confidence"), uiFormat("{0}%", [Math.round(insight.confidence * 100)])),
      fact(document, uiCopy("System"), insight.affected_system_slug ? projectSystemLabel(insight.affected_system_slug) : uiCopy("Not linked")),
      fact(document, uiCopy("Updated"), date(insight.updated_at)),
    );
    const claim = userElement(document, "blockquote", "nur-adjunct-candidate-claim", insight.claim);
    const interpretations = element(document, "div", "nur-adjunct-grid nur-adjunct-evidence-grid");
    const evidence = element(document, "section", "nur-adjunct-evidence-block");
    evidence.append(
      element(document, "p", "nur-adjunct-eyebrow", uiCopy("Evidence")),
      element(document, "h3", undefined, uiFormat("{0} linked", [insight.evidence.length])),
    );
    const evidenceList = element(document, "div", "nur-adjunct-list");
    for (const item of insight.evidence) evidenceList.append(userElement(document, "p", "nur-adjunct-evidence-line", conciseRecord(item)));
    if (!insight.evidence.length) evidenceList.append(status(document, uiCopy("No evidence record was returned."), "warn"));
    evidence.append(evidenceList);
    const counter = element(document, "section", "nur-adjunct-evidence-block");
    counter.append(
      element(document, "p", "nur-adjunct-eyebrow", uiCopy("Counter-evidence")),
      element(document, "h3", undefined, uiFormat("{0} linked", [insight.counter_evidence.length])),
    );
    const counterList = element(document, "div", "nur-adjunct-list");
    for (const item of insight.counter_evidence) counterList.append(userElement(document, "p", "nur-adjunct-evidence-line", conciseRecord(item)));
    if (!insight.counter_evidence.length) counterList.append(status(document, uiCopy("No counter-evidence record was returned.")));
    counter.append(counterList);
    interpretations.append(evidence, counter);

    const uncertainty = element(document, "p", "nur-adjunct-boundary");
    uncertainty.append(document.createTextNode(`${uiCopy("What NUR may be wrong about:")} `));
    uncertainty.append(userElement(document, "span", "nur-adjunct-owner-copy", insight.what_nur_may_be_wrong_about));
    const readingText = [insight.positive_interpretation, insight.hard_interpretation, insight.suggested_action].filter(Boolean).join(" · ");
    const reading = userElement(document, "p", undefined, readingText);
    const correction = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
    correction.placeholder = uiCopy("Correct the candidate without erasing its original record");
    correction.value = insight.correction ?? "";
    const actions = element(document, "div", "nur-adjunct-actions");
    const accept = button(document, uiCopy("Accept"), `candidate-accept-${insight.id}`, true);
    const reject = button(document, uiCopy("Reject"), `candidate-reject-${insight.id}`);
    const correct = button(document, uiCopy("Persist correction"), `candidate-correct-${insight.id}`);
    const plan = button(document, uiCopy("Convert to plan"), `candidate-plan-${insight.id}`);
    const timeline = button(document, uiCopy("Add review to Timeline"), `candidate-timeline-${insight.id}`);
    const memory = button(document, uiCopy("Save as memory candidate"), `candidate-memory-${insight.id}`);
    memory.disabled = insight.status !== "ACCEPTED";
    actions.append(accept, reject, correct, plan, timeline, memory);
    const actionState = status(document, uiCopy("Every action writes through the owner-scoped API."));
    const act = async (control: HTMLButtonElement, task: () => Promise<unknown>) => {
      control.disabled = true;
      try {
        await task();
        await renderCandidateInsights(document, api);
      } catch (error) {
        actionState.textContent = localizedFailure(error, uiSource("Insight action failed."));
        actionState.className = "nur-adjunct-status is-warn";
        control.disabled = false;
      }
    };
    accept.addEventListener("click", () => void act(accept, () => api.acceptInsight(insight.id)));
    reject.addEventListener("click", () => void act(reject, () => api.rejectInsight(insight.id)));
    correct.addEventListener("click", () => {
      if (!correction.value.trim()) {
        actionState.textContent = uiCopy("Write the correction first.");
        actionState.className = "nur-adjunct-status is-warn";
        return;
      }
      void act(correct, () => api.correctInsight(insight.id, correction.value.trim()));
    });
    plan.addEventListener("click", () => void act(plan, () => api.convertInsightToPlan(insight.id)));
    timeline.addEventListener("click", () => void act(timeline, () => api.addInsightToTimeline(insight.id)));
    memory.addEventListener("click", () => void act(memory, () => api.saveInsightToMemory(insight.id)));
    card.append(facts, claim, interpretations, uncertainty, reading, correction, actions, actionState);
    grid.append(card);
  }
}

function consultationStages(document: Document, detail: V197ConsultationDetail): HTMLElement {
  const rail = element(document, "div", "nur-adjunct-actions");
  const completed = new Set(detail.completed_stages.map(row => row.stage));
  for (const stage of detail.stage_order) {
    const chip = element(document, "span", "nur-adjunct-chip", uiFormat("{0}{1}", [completed.has(stage) ? "✓ " : stage === detail.next_stage ? "✦ " : "", controlledLabel(stage)]));
    if (stage === detail.next_stage) chip.dataset.currentStage = "true";
    rail.append(chip);
  }
  return rail;
}

async function renderConsultationIndex(
  document: Document,
  api: V197ApiClient,
  orbitId: string,
): Promise<void> {
  const [rows, communityRooms] = await Promise.all([
    api.consultations(),
    api.communityRooms(),
  ]);
  const shell = mount(document, uiCopy("A question moves when context returns."), uiCopy("Consultation keeps lived experience, constraints, disagreement, evidence and the final outcome inside one bounded ORIENT → RETURN path."), "/universe");
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const listPanel = panel(document, uiCopy("Consultation ledger"), uiFormat("Open and returned · {0}", [rows.length]));
  const list = element(document, "div", "nur-adjunct-list");
  if (!rows.length) list.append(empty(document, uiCopy("No Consultation yet"), uiCopy("Open one bounded question. Nothing is synthesized before contributions exist.")));
  for (const row of rows) {
    const item = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(userElement(document, "strong", undefined, row.title), element(document, "span", "nur-adjunct-chip", uiFormat("{0} · {1}", [controlledLabel(row.current_stage), controlledLabel(row.status)])));
    item.append(head, userElement(document, "p", undefined, row.question));
    const actions = element(document, "div", "nur-adjunct-actions");
    const open = button(document, uiCopy("Enter Consultation"), `consultation-open-${row.id}`);
    open.addEventListener("click", () => navigate(`/universe/consultation/${row.id}`));
    actions.append(open);
    item.append(actions);
    list.append(item);
  }
  listPanel.append(list);

  const create = panel(document, uiCopy("ORIENT"), uiCopy("Open a bounded Consultation"));
  const field = (label: string, control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    const wrapper = element(document, "label", "nur-adjunct-field");
    wrapper.append(element(document, "span", undefined, label), control);
    return wrapper;
  };
  const title = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  title.placeholder = uiCopy("Consultation title");
  const question = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  question.placeholder = uiCopy("What is the actual question?");
  const purpose = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  purpose.placeholder = uiCopy("Why does this need a shared return?");
  const desired = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  desired.placeholder = uiCopy("What useful outcome should exist?");
  const scope = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  scope.placeholder = uiCopy("What is inside and outside this Consultation?");
  const room = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  room.append(element(document, "option", undefined, uiCopy("Private owner Consultation")));
  room.options[0].value = "";
  for (const candidate of communityRooms) {
    const option = element(document, "option", undefined, uiFormat("{0} · {1}", [candidate.title, controlledLabel(candidate.current_user_role)])) as HTMLOptionElement;
    option.value = candidate.id;
    option.dataset.nurUserContent = "true";
    room.append(option);
  }
  create.append(field(uiCopy("Title"), title), field(uiCopy("Question"), question), field(uiCopy("Purpose"), purpose), field(uiCopy("Desired outcome"), desired), field(uiCopy("Scope statement"), scope), field(uiCopy("Bounded room"), room));
  const actions = element(document, "div", "nur-adjunct-actions");
  const createButton = button(document, uiCopy("Open Consultation"), "consultation-create", true);
  actions.append(createButton);
  const createState = status(document, uiCopy("Only explicit Consultation records are shared. Private Talk, Journal and Omega remain outside."));
  create.append(actions, createState);
  createButton.addEventListener("click", async () => {
    const values = [title.value, question.value, purpose.value, desired.value, scope.value].map(value => value.trim());
    if (values.some(value => !value)) {
      createState.textContent = uiCopy("Title, question, purpose, desired outcome and scope are all required.");
      createState.className = "nur-adjunct-status is-warn";
      return;
    }
    createButton.disabled = true;
    try {
      const created = await api.createConsultation({
        title: values[0], question: values[1], purpose: values[2], desired_outcome: values[3],
        scope_statement: values[4], room_id: room.value || null,
        orbit_id: orbitId, system_slug: "quiet-ambition",
      });
      navigate(`/universe/consultation/${created.id}`);
    } catch (error) {
      createState.textContent = localizedFailure(error, uiSource("Consultation could not be opened."));
      createState.className = "nur-adjunct-status is-warn";
      createButton.disabled = false;
    }
  });
  grid.append(listPanel, create);
}

async function renderConsultationDetail(document: Document, api: V197ApiClient, consultationId: string): Promise<void> {
  const detail = await api.consultation(consultationId);
  const row = detail.consultation;
  const shell = mount(document, row.title, row.question, "/universe/consultation");
  protectMountedOwnerCopy(shell, row.title, row.question);
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const orientation = panel(document, uiCopy("Bounded Consultation"), uiFormat("{0} · {1}", [controlledLabel(row.current_stage), controlledLabel(row.status)]));
  orientation.classList.add("is-wide");
  const facts = element(document, "div", "nur-adjunct-facts");
  facts.append(userFact(document, uiCopy("Purpose"), row.purpose), userFact(document, uiCopy("Desired outcome"), row.desired_outcome), userFact(document, uiCopy("Scope"), row.scope_statement), fact(document, uiCopy("Your role"), controlledLabel(row.current_user_role)));
  orientation.append(facts, consultationStages(document, detail), userElement(document, "p", "nur-adjunct-boundary", detail.what_nur_may_be_wrong_about));

  const contributions = panel(document, uiCopy("GATHER"), uiFormat("Contributions · {0}", [detail.contributions.length]));
  const contributionList = element(document, "div", "nur-adjunct-list");
  if (!detail.contributions.length) contributionList.append(empty(document, uiCopy("No contribution yet"), uiCopy("Lived experience, constraints and disagreement stay visible instead of being smoothed away.")));
  for (const contribution of detail.contributions) {
    const item = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(element(document, "strong", undefined, controlledLabel(contribution.contribution_type)), element(document, "span", "nur-adjunct-chip", controlledLabel(contribution.provenance_label, uiSource("Owner ledger"))));
    item.append(head, userElement(document, "p", undefined, contribution.body));
    contributionList.append(item);
  }
  contributions.append(contributionList);
  if (row.status === "ACTIVE") {
    const type = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
    for (const [value, label] of CONSULTATION_CONTRIBUTION_OPTIONS) {
      const option = element(document, "option", undefined, uiCopy(label)) as HTMLOptionElement;
      option.value = value;
      type.append(option);
    }
    const body = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
    body.placeholder = uiCopy("Add only what belongs inside this Consultation…");
    const send = button(document, uiCopy("Add contribution"), "consultation-contribute", true);
    const contributionState = status(document, uiCopy("This contribution is shared only with members of the bounded room."));
    contributions.append(type, body, send, contributionState);
    send.addEventListener("click", async () => {
      if (!body.value.trim()) {
        contributionState.textContent = uiCopy("Write one contribution first.");
        contributionState.className = "nur-adjunct-status is-warn";
        return;
      }
      send.disabled = true;
      try {
        await api.addConsultationContribution(consultationId, {
          contribution_type: type.value, body: body.value.trim(),
          language_tag: document.documentElement.lang || "en",
        });
        await renderConsultationDetail(document, api, consultationId);
      } catch (error) {
        contributionState.textContent = localizedFailure(error, uiSource("Contribution was not saved."));
        contributionState.className = "nur-adjunct-status is-warn";
        send.disabled = false;
      }
    });
  }

  const movement = panel(document, uiCopy("Owner movement"), row.status === "COMPLETED" ? uiCopy("RETURN is held") : uiFormat("Complete {0}", [controlledLabel(detail.next_stage)]));
  const stageList = element(document, "div", "nur-adjunct-list");
  for (const stage of detail.completed_stages) {
    const item = element(document, "article", "nur-adjunct-row");
    item.append(element(document, "strong", undefined, controlledLabel(stage.stage)), userElement(document, "p", undefined, JSON.stringify(stage.stage_payload)));
    stageList.append(item);
  }
  movement.append(stageList);
  if (row.status === "ACTIVE" && row.current_user_role === "OWNER" && detail.next_stage) {
    const note = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
    note.placeholder = detail.next_stage === "RETURN" ? uiCopy("Record the outcome and prediction comparison…") : uiFormat("Record the {0} evidence…", [controlledLabel(detail.next_stage)]);
    const advance = button(document, uiFormat("Persist {0}", [controlledLabel(detail.next_stage)]), `consultation-stage-${detail.next_stage.toLowerCase()}`, true);
    const stageState = status(document, uiCopy("Stage movement happens only after server persistence."));
    movement.append(note, advance, stageState);
    advance.addEventListener("click", async () => {
      if (!note.value.trim()) {
        stageState.textContent = uiCopy("Record this stage before advancing.");
        stageState.className = "nur-adjunct-status is-warn";
        return;
      }
      advance.disabled = true;
      try {
        const result = await api.completeConsultationStage(consultationId, detail.next_stage!, { note: note.value.trim() });
        if (result.glow?.status === "AWARDED") stageState.textContent = uiFormat("RETURN persisted · +{0} Glow", [text(result.glow.awarded_points, "0")]);
        await renderConsultationDetail(document, api, consultationId);
      } catch (error) {
        stageState.textContent = localizedFailure(error, uiSource("Stage was not persisted."));
        stageState.className = "nur-adjunct-status is-warn";
        advance.disabled = false;
      }
    });
  } else if (row.status === "ACTIVE") {
    movement.append(empty(document, uiCopy("Owner movement only"), uiCopy("Members contribute evidence and disagreement. The Consultation owner advances the stage.")));
  } else {
    movement.append(status(document, uiCopy("This Consultation completed its RETURN loop."), "good"));
  }
  grid.append(orientation, contributions, movement);
}

async function loadCommunityFeed(api: V197ApiClient): Promise<{
  rooms: Awaited<ReturnType<V197ApiClient["communityRooms"]>>;
  posts: V197CommunityPost[];
}> {
  const rooms = await api.communityRooms();
  const groups = await Promise.all(rooms.map(room => api.communityPosts(room.id).catch(() => [])));
  const posts = groups.flat().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return { rooms, posts };
}

async function renderCommunityIndex(document: Document, api: V197ApiClient): Promise<void> {
  const { rooms, posts } = await loadCommunityFeed(api);
  const shell = mount(document, uiCopy("Shared signal without private spill."), uiCopy("Community is built from real bounded rooms and persisted contributions. No fake people, replies, activity or live public count appears here."), "/universe");
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const roomPanel = panel(document, uiCopy("Group NUR boundaries"), uiFormat("Rooms · {0}", [rooms.length]));
  roomPanel.id = "nur-v197-community-controls";
  const roomList = element(document, "div", "nur-adjunct-list");
  if (!rooms.length) roomList.append(empty(document, uiCopy("No bounded room yet"), uiCopy("Create one real room. NUR will not invent a community around you.")));
  for (const room of rooms) {
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(userElement(document, "strong", undefined, room.title), element(document, "span", "nur-adjunct-chip", uiFormat("{0}{1}", [room.is_demo ? ("" + uiCopy("DEMO ·") + " ") : "", controlledLabel(room.room_kind)])));
    row.append(head, room.description ? userElement(document, "p", undefined, room.description) : element(document, "p", undefined, controlledLabel(room.privacy)));
    const actions = element(document, "div", "nur-adjunct-actions");
    const open = button(document, uiCopy("Enter bounded room"), `community-room-${room.id}`);
    open.addEventListener("click", () => navigate(`/universe/community/room/${room.id}`));
    actions.append(open);
    row.append(actions);
    roomList.append(row);
  }
  roomPanel.append(roomList);
  const roomTitle = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  roomTitle.id = "nur-v197-room-title";
  roomTitle.placeholder = uiCopy("Name one bounded room");
  const createRoom = button(document, uiCopy("Create Group NUR room"), "community-room-create", true);
  const createCouncil = button(document, uiCopy("Start a Council room"), "community-council-create");
  const roomState = status(document, uiCopy("The creator becomes owner. Membership is explicit and server-enforced."));
  const roomActions = element(document, "div", "nur-adjunct-actions");
  roomActions.append(createRoom, createCouncil);
  roomPanel.append(roomTitle, roomActions, roomState);
  const createBoundedRoom = async (
    control: HTMLButtonElement,
    roomKind: "GROUP" | "COUNCIL",
  ): Promise<void> => {
    if (!roomTitle.value.trim()) {
      roomState.textContent = uiCopy("Name the room first.");
      roomState.className = "nur-adjunct-status is-warn";
      return;
    }
    createRoom.disabled = true;
    createCouncil.disabled = true;
    try {
      const created = await api.createCommunityRoom(roomTitle.value.trim(), roomKind);
      navigate(`/universe/community/room/${created.id}`);
    } catch (error) {
      roomState.textContent = localizedFailure(error, uiSource("Room was not created."));
      roomState.className = "nur-adjunct-status is-warn";
      control.focus();
      createRoom.disabled = false;
      createCouncil.disabled = false;
    }
  };
  createRoom.addEventListener("click", () => { void createBoundedRoom(createRoom, "GROUP"); });
  createCouncil.addEventListener("click", () => { void createBoundedRoom(createCouncil, "COUNCIL"); });

  const feed = panel(document, uiCopy("Persisted signal feed"), uiFormat("Posts · {0}", [posts.length]));
  const postList = element(document, "div", "nur-adjunct-list");
  if (!posts.length) postList.append(empty(document, uiCopy("No post yet"), uiCopy("Room members can write the first persisted contribution.")));
  for (const post of posts) {
    const room = rooms.find(candidate => candidate.id === post.room_id);
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(userElement(document, "strong", undefined, post.title), userElement(document, "span", "nur-adjunct-chip", uiFormat("{0}{1}", [post.is_demo ? ("" + uiCopy("DEMO ·") + " ") : "", room?.title ?? uiCopy("ROOM")])));
    row.append(head, userElement(document, "p", undefined, post.body));
    const actions = element(document, "div", "nur-adjunct-actions");
    const open = button(document, uiCopy("Open thread"), `community-post-${post.id}`);
    open.addEventListener("click", () => navigate(`/universe/community/post/${post.id}?room=${post.room_id}`));
    actions.append(open);
    row.append(actions);
    postList.append(row);
  }
  feed.append(postList);
  grid.append(roomPanel, feed);
}

async function renderCommunityRoom(document: Document, api: V197ApiClient, roomId: string): Promise<void> {
  const [room, summary, messages, posts] = await Promise.all([
    api.get<Record<string, unknown>>(`/community/rooms/${encodeURIComponent(roomId)}`),
    api.communityRoomSummary(roomId), api.communityMessages(roomId), api.communityPosts(roomId),
  ]);
  const roomTitle = text(room.title);
  const roomDescription = text(room.description, uiCopy(ADJUNCT_COPY.boundedGroupRoom));
  const shell = mount(document, roomTitle, roomDescription, "/universe/community");
  protectMountedOwnerCopy(shell, roomTitle, roomDescription);
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const boundary = panel(document, uiCopy("Room boundary"), uiFormat("{0} · {1}", [controlledLabel(room.current_user_role), controlledLabel(room.room_kind)]));
  boundary.classList.add("is-wide");
  const facts = element(document, "div", "nur-adjunct-facts");
  facts.append(fact(document, uiCopy("Messages"), text(summary.counts.messages, uiCopy("0"))), fact(document, uiCopy("Posts"), text(summary.counts.posts, uiCopy("0"))), fact(document, uiCopy("Contributions"), text(summary.counts.comments, uiCopy("0"))), fact(document, uiCopy("External public feed"), controlledLabel(summary.external_public_feed)));
  boundary.append(facts, element(document, "p", "nur-adjunct-boundary", controlledLabel(room.privacy)));
  const boundaryActions = element(document, "div", "nur-adjunct-actions");
  const consultation = button(document, uiCopy("Start Consultation"), "community-start-consultation", true);
  consultation.addEventListener("click", () => navigate("/universe/consultation"));
  boundaryActions.append(consultation);
  boundary.append(boundaryActions);
  if (text(room.current_user_role) === "OWNER") {
    const memberEmail = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
    memberEmail.id = "nur-v197-member-email";
    memberEmail.type = "email";
    memberEmail.autocomplete = "off";
    memberEmail.placeholder = uiCopy("Exact NUR account email");
    const addMember = button(document, uiCopy("Add member"), "community-member-add");
    const memberState = status(document, uiCopy("Only an existing NUR account can cross this room boundary."));
    boundary.append(memberEmail, addMember, memberState);
    addMember.addEventListener("click", async () => {
      if (!memberEmail.value.trim()) {
        memberState.textContent = uiCopy("Enter the exact account email first.");
        memberState.className = "nur-adjunct-status is-warn";
        return;
      }
      addMember.disabled = true;
      try {
        await api.addCommunityMember(roomId, memberEmail.value.trim());
        memberState.textContent = uiCopy("Member added to this boundary.");
        memberState.className = "nur-adjunct-status is-good";
      } catch (error) {
        memberState.textContent = localizedFailure(error, uiSource("Member was not added."));
        memberState.className = "nur-adjunct-status is-warn";
        addMember.disabled = false;
      }
    });
  }

  const conversation = panel(document, uiCopy("Group NUR"), uiFormat("Conversation · {0}", [messages.length]));
  conversation.id = "universe-community";
  const messageList = element(document, "div", "nur-adjunct-list");
  if (!messages.length) messageList.append(empty(document, uiCopy("No room message yet"), uiCopy("NUR stays quiet until a member contributes.")));
  for (const message of messages) {
    const item = element(document, "article", "nur-adjunct-row");
    item.append(element(document, "span", "nur-adjunct-chip", uiFormat("{0}{1}", [message.is_demo ? ("" + uiCopy("DEMO ·") + " ") : "", controlledLabel(message.provenance_label, uiSource("Member written"))])), userElement(document, "p", undefined, message.body));
    messageList.append(item);
  }
  const messageInput = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  messageInput.id = "nur-v197-room-message";
  messageInput.placeholder = uiCopy("Write inside this room boundary…");
  const sendMessage = button(document, uiCopy("Send to room"), "community-message-send", true);
  const messageState = status(document, uiCopy("A persisted real message may earn server-verified Glow. DEMO messages never do."));
  conversation.append(messageList, messageInput, sendMessage, messageState);
  sendMessage.addEventListener("click", async () => {
    if (!messageInput.value.trim()) return;
    sendMessage.disabled = true;
    try {
      const saved = await api.postCommunityMessage(roomId, messageInput.value.trim(), document.documentElement.lang || "en");
      messageState.textContent = saved.glow?.status === "AWARDED" ? uiFormat("Persisted · +{0} Glow", [saved.glow.awarded_points]) : uiCopy("Persisted in the bounded room.");
      messageState.className = "nur-adjunct-status is-good";
      await renderCommunityRoom(document, api, roomId);
    } catch (error) {
      messageState.textContent = localizedFailure(error, uiSource("Message was not saved."));
      messageState.className = "nur-adjunct-status is-warn";
      sendMessage.disabled = false;
    }
  });

  const threads = panel(document, uiCopy("Room threads"), uiFormat("Posts · {0}", [posts.length]));
  const threadList = element(document, "div", "nur-adjunct-list");
  for (const post of posts) {
    const item = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(userElement(document, "strong", undefined, post.title), element(document, "span", "nur-adjunct-chip", post.is_demo ? uiCopy("DEMO") : controlledLabel(post.provenance_label, uiSource("Member written"))));
    item.append(head, userElement(document, "p", undefined, post.body));
    const open = button(document, uiCopy("Open thread"), `community-post-${post.id}`);
    open.addEventListener("click", () => navigate(`/universe/community/post/${post.id}?room=${roomId}`));
    item.append(open);
    threadList.append(item);
  }
  const postTitle = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  postTitle.placeholder = uiCopy("Thread title");
  const postBody = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  postBody.placeholder = uiCopy("Question, lived experience, resource, outcome or Project log…");
  const publish = button(document, uiCopy("Publish in room"), "community-post-create", true);
  const postState = status(document, uiCopy("Only room members can read this thread."));
  threads.append(threadList, postTitle, postBody, publish, postState);
  publish.addEventListener("click", async () => {
    if (!postTitle.value.trim() || !postBody.value.trim()) {
      postState.textContent = uiCopy("A thread needs both title and body.");
      postState.className = "nur-adjunct-status is-warn";
      return;
    }
    publish.disabled = true;
    try {
      const saved = await api.createCommunityPost(roomId, postTitle.value.trim(), postBody.value.trim(), document.documentElement.lang || "en");
      navigate(`/universe/community/post/${saved.id}?room=${roomId}`);
    } catch (error) {
      postState.textContent = localizedFailure(error, uiSource("Thread was not published."));
      postState.className = "nur-adjunct-status is-warn";
      publish.disabled = false;
    }
  });
  grid.append(boundary, conversation, threads);

  if (text(room.room_kind) === "COUNCIL") {
    const positions = await api.communityPositions(roomId);
    const council = panel(document, uiCopy("Council ledger"), uiFormat("Positions · {0} · Decisions · {1}", [positions.length, text(summary.counts.decisions, "0")]));
    council.classList.add("is-wide");
    const positionList = element(document, "div", "nur-adjunct-list");
    if (!positions.length) {
      positionList.append(empty(document, uiCopy("No position yet"), uiCopy("A Council preserves disagreement before it records a decision.")));
    }
    for (const position of positions) {
      const row = element(document, "article", "nur-adjunct-row");
      row.append(userElement(document, "p", undefined, position.position));
      if (position.is_minority) row.append(element(document, "span", "nur-adjunct-chip", uiCopy("MINORITY POSITION")));
      positionList.append(row);
    }
    const positionInput = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
    positionInput.id = "nur-v197-council-position";
    positionInput.placeholder = uiCopy("State one position without erasing disagreement");
    const addPosition = button(document, uiCopy("Add position"), "council-position-add", true);
    const councilState = status(document, uiCopy("Every position is persisted with its real owner."));
    council.append(positionList, positionInput, addPosition, councilState);
    addPosition.addEventListener("click", async () => {
      if (!positionInput.value.trim()) return;
      addPosition.disabled = true;
      try {
        await api.createCouncilPosition(roomId, positionInput.value.trim());
        await renderCommunityRoom(document, api, roomId);
      } catch (error) {
        councilState.textContent = localizedFailure(error, uiSource("Position was not saved."));
        councilState.className = "nur-adjunct-status is-warn";
        addPosition.disabled = false;
      }
    });
    if (text(room.current_user_role) === "OWNER") {
      const decisionInput = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
      decisionInput.id = "nur-v197-council-decision";
      decisionInput.placeholder = uiCopy("Record the bounded Council decision");
      const recordDecision = button(document, uiCopy("Record decision"), "council-decision-record");
      council.append(decisionInput, recordDecision);
      recordDecision.addEventListener("click", async () => {
        if (!decisionInput.value.trim()) return;
        recordDecision.disabled = true;
        try {
          await api.createCouncilDecision(roomId, decisionInput.value.trim());
          await renderCommunityRoom(document, api, roomId);
        } catch (error) {
          councilState.textContent = localizedFailure(error, uiSource("Decision was not saved."));
          councilState.className = "nur-adjunct-status is-warn";
          recordDecision.disabled = false;
        }
      });
    }
    grid.append(council);
  }
}

async function renderCommunityPost(document: Document, api: V197ApiClient, postId: string): Promise<void> {
  const requestedRoom = new URL(window.location.href).searchParams.get("room");
  const rooms = await api.communityRooms();
  let roomId = requestedRoom;
  let post: V197CommunityPost | undefined;
  if (roomId) post = (await api.communityPosts(roomId)).find(row => row.id === postId);
  if (!post) {
    for (const room of rooms) {
      const found = (await api.communityPosts(room.id)).find(row => row.id === postId);
      if (found) { post = found; roomId = room.id; break; }
    }
  }
  if (!post || !roomId) throw new Error(uiCopy("This thread is not available inside your room memberships."));
  const comments = await api.communityComments(roomId, postId);
  const shell = mount(document, post.title, post.body, `/universe/community/room/${roomId}`);
  protectMountedOwnerCopy(shell, post.title, post.body);
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const thread = panel(document, uiCopy("Bounded thread"), uiFormat("{0}{1}", [post.is_demo ? ("" + uiCopy("DEMO ·") + " ") : "", controlledLabel(post.provenance_label, uiSource("Member written"))]));
  thread.classList.add("is-wide");
  thread.append(userElement(document, "p", undefined, post.body));
  const reactions = element(document, "div", "nur-adjunct-actions");
  const useful = button(document, uiCopy("✦ Useful"), "community-react-useful");
  const witness = button(document, uiCopy("Witness"), "community-react-witness");
  const reactionState = status(document, uiCopy("Reactions are unique persisted room records."));
  const react = async (reaction: string) => {
    useful.disabled = true; witness.disabled = true;
    try {
      await api.createCommunityReaction(roomId!, "POST", postId, reaction);
      reactionState.textContent = uiFormat("{0} reaction persisted.", [controlledLabel(reaction)]);
      reactionState.className = "nur-adjunct-status is-good";
    } catch (error) {
      reactionState.textContent = localizedFailure(error, uiSource("Reaction failed."));
      reactionState.className = "nur-adjunct-status is-warn";
    }
  };
  useful.addEventListener("click", () => void react(structuralValue("USEFUL")));
  witness.addEventListener("click", () => void react(structuralValue("WITNESS")));
  reactions.append(useful, witness);
  thread.append(reactions, reactionState);

  const discussion = panel(document, uiCopy("Discussion"), uiFormat("Replies · {0}", [comments.length]));
  discussion.classList.add("is-wide");
  const list = element(document, "div", "nur-adjunct-list");
  if (!comments.length) list.append(empty(document, uiCopy("No reply yet"), uiCopy("No fabricated person is waiting here.")));
  for (const comment of comments) {
    const row = element(document, "article", "nur-adjunct-row");
    row.append(element(document, "span", "nur-adjunct-chip", comment.is_demo ? uiCopy("Demo") : uiCopy("Member written")), userElement(document, "p", undefined, comment.body));
    list.append(row);
  }
  const reply = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  reply.placeholder = uiCopy("Reply with experience, evidence, constraint or disagreement…");
  const send = button(document, uiCopy("Reply"), "community-comment-create", true);
  const replyState = status(document, uiCopy("The reply remains inside this room thread."));
  discussion.append(list, reply, send, replyState);
  send.addEventListener("click", async () => {
    if (!reply.value.trim()) return;
    send.disabled = true;
    try {
      const saved = await api.createCommunityComment(roomId!, postId, reply.value.trim(), document.documentElement.lang || "en");
      replyState.textContent = saved.glow?.status === "AWARDED" ? uiFormat("Reply persisted · +{0} Glow", [saved.glow.awarded_points]) : uiCopy("Reply persisted.");
      replyState.className = "nur-adjunct-status is-good";
      await renderCommunityPost(document, api, postId);
    } catch (error) {
      replyState.textContent = localizedFailure(error, uiSource("Reply was not saved."));
      replyState.className = "nur-adjunct-status is-warn";
      send.disabled = false;
    }
  });
  grid.append(thread, discussion);
}

async function renderProjectsIndex(document: Document, api: V197ApiClient): Promise<void> {
  const projects = await api.projects();
  const shell = mount(document, uiCopy("Intent becomes evidence, then a shipped result."), uiCopy("AM Projects keeps objective, tasks, bounded agent proposals, evidence, reviews and owner approval in one Project Orbit."));
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const ledger = panel(document, uiCopy("Owner Project ledger"), uiFormat("Projects · {0}", [projects.length]));
  const list = element(document, "div", "nur-adjunct-list");
  if (!projects.length) list.append(empty(document, uiCopy("No Project yet"), uiCopy("Create one objective. No agent gets authority merely because a card exists.")));
  for (const project of projects) {
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(userElement(document, "strong", undefined, text(project.title)), element(document, "span", "nur-adjunct-chip", controlledLabel(project.status)));
    row.append(head, userElement(document, "p", undefined, text(project.objective)));
    const open = button(document, uiCopy("Open Project Orbit"), `project-open-${recordId(project)}`);
    open.addEventListener("click", () => navigate(`/projects/${recordId(project)}/overview`));
    row.append(open);
    list.append(row);
  }
  ledger.append(list);

  const create = panel(document, uiCopy("New Project Orbit"), uiCopy("Define what done means"));
  const title = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  title.placeholder = uiCopy("Project title");
  const objective = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  objective.placeholder = uiCopy("Objective and success definition…");
  const system = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  for (const [value, label] of PROJECT_SYSTEM_OPTIONS) {
    const option = element(document, "option", undefined, uiCopy(label)) as HTMLOptionElement;
    option.value = value;
    system.append(option);
  }
  const createButton = button(document, uiCopy("Create Project Orbit"), "project-create", true);
  const createState = status(document, uiCopy("External actions remain denied until an owner explicitly approves a bounded run."));
  create.append(title, objective, system, createButton, createState);
  createButton.addEventListener("click", async () => {
    if (!title.value.trim() || !objective.value.trim()) {
      createState.textContent = uiCopy("A Project needs a title and objective.");
      createState.className = "nur-adjunct-status is-warn";
      return;
    }
    createButton.disabled = true;
    try {
      const created = await api.createProject({ title: title.value.trim(), objective: objective.value.trim(), system_slug: system.value });
      navigate(`/projects/${recordId(created)}/overview`);
    } catch (error) {
      createState.textContent = localizedFailure(error, uiSource("Project was not created."));
      createState.className = "nur-adjunct-status is-warn";
      createButton.disabled = false;
    }
  });
  grid.append(ledger, create);
}

async function renderProjectDetail(document: Document, api: V197ApiClient, projectId: string, route: string): Promise<void> {
  const [project, tasks, runs, evidence, reviews, artifacts, files] = await Promise.all([
    api.project(projectId), api.projectTasks(projectId), api.projectRuns(projectId),
    api.projectEvidence(projectId), api.projectReviews(projectId), api.projectArtifacts(projectId),
    api.projectFiles(projectId),
  ]);
  const projectTitle = text(project.title);
  const projectObjective = text(project.objective);
  const shell = mount(document, projectTitle, projectObjective, "/projects");
  protectMountedOwnerCopy(shell, projectTitle, projectObjective);
  const tabs = element(document, "nav", "nur-adjunct-actions");
  for (const [tab, label] of PROJECT_TAB_OPTIONS) {
    const control = button(document, uiCopy(label), `project-tab-${tab}`, route.endsWith(`/${tab}`));
    control.addEventListener("click", () => navigate(`/projects/${projectId}/${tab}`));
    tabs.append(control);
  }
  shell.append(tabs);
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const state = panel(document, uiCopy("Project Orbit"), uiFormat("{0} · {1}", [controlledLabel(project.status), projectSystemLabel(project.system_slug)]));
  state.classList.add("is-wide");
  const facts = element(document, "div", "nur-adjunct-facts");
  facts.append(fact(document, uiCopy("Tasks"), text(tasks.length)), fact(document, uiCopy("Passed evidence"), text(evidence.filter(row => row.verification_status === "PASSED").length)), fact(document, uiCopy("Agent proposals"), text(runs.length)), fact(document, uiCopy("Owner reviews"), text(reviews.length)));
  state.append(facts, element(document, "p", "nur-adjunct-boundary", uiCopy("No run can pre-authorize spending, publishing, deployment, messaging, secret access or security changes.")));

  const taskPanel = panel(document, uiCopy("Execution"), uiFormat("Tasks · {0}", [tasks.length]));
  const taskList = element(document, "div", "nur-adjunct-list");
  for (const task of tasks) {
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(userElement(document, "strong", undefined, text(task.title)), element(document, "span", "nur-adjunct-chip", controlledLabel(task.status)));
    const acceptanceCriteria = text(task.acceptance_criteria, uiCopy(ADJUNCT_COPY.acceptanceCriteriaNotSet));
    row.append(head, task.acceptance_criteria ? userElement(document, "p", undefined, acceptanceCriteria) : element(document, "p", undefined, acceptanceCriteria));
    if (task.status !== "DONE") {
      const done = button(document, uiCopy("Close with passed evidence"), `project-task-done-${recordId(task)}`);
      done.addEventListener("click", async () => {
        try {
          await api.patchProjectTask(recordId(task), { status: "DONE" });
          await renderProjectDetail(document, api, projectId, route);
        } catch (error) {
          const note = status(document, localizedFailure(error, uiSource("Task completion was rejected.")), "warn");
          row.append(note);
        }
      });
      row.append(done);
    }
    taskList.append(row);
  }
  const taskTitle = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  taskTitle.placeholder = uiCopy("One concrete task");
  const criteria = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  criteria.placeholder = uiCopy("Acceptance criteria");
  const addTask = button(document, uiCopy("Add task"), "project-task-create", true);
  const taskState = status(document, uiCopy("A task cannot become DONE without PASSED evidence."));
  taskPanel.append(taskList, taskTitle, criteria, addTask, taskState);
  addTask.addEventListener("click", async () => {
    if (!taskTitle.value.trim() || !criteria.value.trim()) return;
    addTask.disabled = true;
    try {
      await api.createProjectTask(projectId, { title: taskTitle.value.trim(), acceptance_criteria: criteria.value.trim(), assigned_role: "implementer" });
      await renderProjectDetail(document, api, projectId, route);
    } catch (error) {
      taskState.textContent = localizedFailure(error, uiSource("Task was not created."));
      taskState.className = "nur-adjunct-status is-warn";
      addTask.disabled = false;
    }
  });

  const proof = panel(document, uiCopy("Evidence gate"), uiFormat("Evidence · {0}", [evidence.length]));
  const proofList = element(document, "div", "nur-adjunct-list");
  for (const item of evidence) {
    const row = element(document, "article", "nur-adjunct-row");
    row.append(element(document, "span", "nur-adjunct-chip", controlledLabel(item.verification_status)), userElement(document, "p", undefined, text(item.summary)));
    proofList.append(row);
  }
  const proofSummary = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  proofSummary.placeholder = uiCopy("What was verified?");
  const proofLocator = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  proofLocator.placeholder = uiCopy("Evidence locator/path/URL");
  const taskSelect = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  taskSelect.append(element(document, "option", undefined, uiCopy("Project-level evidence")));
  taskSelect.options[0].value = "";
  for (const task of tasks) {
    const option = element(document, "option", undefined, text(task.title)) as HTMLOptionElement;
    option.value = recordId(task);
    option.dataset.nurUserContent = "true";
    taskSelect.append(option);
  }
  const addEvidence = button(document, uiCopy("Record passed evidence"), "project-evidence-create", true);
  const proofState = status(document, uiCopy("PASSED evidence requires both a named verifier and a locator."));
  proof.append(proofList, taskSelect, proofSummary, proofLocator, addEvidence, proofState);
  addEvidence.addEventListener("click", async () => {
    if (!proofSummary.value.trim() || !proofLocator.value.trim()) return;
    addEvidence.disabled = true;
    try {
      const saved = await api.createProjectEvidence(projectId, {
        task_id: taskSelect.value || null, evidence_kind: "TEST_OUTPUT",
        summary: proofSummary.value.trim(), locator: proofLocator.value.trim(),
        verification_status: "PASSED", verifier: "OWNER",
      });
      const glow = saved.glow as Record<string, unknown> | undefined;
      proofState.textContent = glow?.status === "AWARDED" ? uiFormat("Evidence persisted · +{0} Glow", [text(glow.awarded_points, "0")]) : uiCopy("Evidence persisted.");
      await renderProjectDetail(document, api, projectId, route);
    } catch (error) {
      proofState.textContent = localizedFailure(error, uiSource("Evidence was not recorded."));
      proofState.className = "nur-adjunct-status is-warn";
      addEvidence.disabled = false;
    }
  });

  const agent = panel(document, uiCopy("Bounded agent work"), uiFormat("Runs · {0}", [runs.length]));
  const runList = element(document, "div", "nur-adjunct-list");
  for (const run of runs) {
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(element(document, "strong", undefined, controlledLabel(run.role, uiSource("Agent role"))), element(document, "span", "nur-adjunct-chip", controlledLabel(run.status)));
    row.append(head, userElement(document, "p", undefined, text(run.request_summary)));
    if (run.status === "PROPOSED") {
      const actions = element(document, "div", "nur-adjunct-actions");
      const approve = button(document, uiCopy("Approve bounded run"), `project-run-approve-${recordId(run)}`, true);
      const cancel = button(document, uiCopy("Cancel"), `project-run-cancel-${recordId(run)}`);
      approve.addEventListener("click", async () => { await api.projectRunAction(recordId(run), "approve"); await renderProjectDetail(document, api, projectId, route); });
      cancel.addEventListener("click", async () => { await api.projectRunAction(recordId(run), "cancel"); await renderProjectDetail(document, api, projectId, route); });
      actions.append(approve, cancel); row.append(actions);
    }
    runList.append(row);
  }
  const role = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  for (const value of ["architect", "implementer", "researcher", "visual reviewer", "QA", "security reviewer", "writer", "translator"]) {
    const option = element(document, "option", undefined, controlledLabel(value, uiSource("Agent role"))) as HTMLOptionElement; option.value = value; role.append(option);
  }
  const request = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  request.placeholder = uiCopy("Propose a scoped task. This records intent; it does not execute autonomously.");
  const propose = button(document, uiCopy("Propose agent run"), "project-run-propose", true);
  const runState = status(document, uiCopy("Owner approval changes PROPOSED to APPROVED. It still does not grant external action authority."));
  agent.append(runList, role, request, propose, runState);
  propose.addEventListener("click", async () => {
    if (!request.value.trim()) return;
    propose.disabled = true;
    try {
      await api.proposeProjectRun(projectId, { role: role.value, request_summary: request.value.trim(), task_id: tasks.length ? recordId(tasks[0]) : null });
      await renderProjectDetail(document, api, projectId, route);
    } catch (error) {
      runState.textContent = localizedFailure(error, uiSource("Run proposal failed."));
      runState.className = "nur-adjunct-status is-warn";
      propose.disabled = false;
    }
  });

  const review = panel(document, uiCopy("Owner review"), uiFormat("Reviews · {0} · Artifacts · {1}", [reviews.length, artifacts.length]));
  const reviewList = element(document, "div", "nur-adjunct-list");
  for (const item of reviews) {
    const row = element(document, "article", "nur-adjunct-row");
    row.append(element(document, "span", "nur-adjunct-chip", controlledLabel(item.decision)), item.note ? userElement(document, "p", undefined, text(item.note)) : element(document, "p", undefined, uiCopy(ADJUNCT_COPY.noNote)));
    reviewList.append(row);
  }
  const reviewNote = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  reviewNote.placeholder = uiCopy("Why is this accepted, rejected or corrected?");
  const approveReview = button(document, uiCopy("Record owner approval"), "project-review-create", true);
  const reviewState = status(document, uiCopy("Review records judgment; it does not rewrite evidence."));
  review.append(reviewList, reviewNote, approveReview, reviewState);
  approveReview.addEventListener("click", async () => {
    if (!reviewNote.value.trim()) return;
    approveReview.disabled = true;
    try {
      await api.createProjectReview(projectId, { decision: "APPROVE", note: reviewNote.value.trim() });
      await renderProjectDetail(document, api, projectId, route);
    } catch (error) {
      reviewState.textContent = localizedFailure(error, uiSource("Review was not saved."));
      reviewState.className = "nur-adjunct-status is-warn";
      approveReview.disabled = false;
    }
  });
  const deliverables = buildDeliverablesPanel(document, api, projectId, route, files, tasks);

  // Every visible tab owns an implemented surface. Retired deep links resolve
  // to overview without exposing an empty placeholder tab.
  const activeTab = PROJECT_TAB_OPTIONS.map(([tab]) => tab).find(tab => route.endsWith(`/${tab}`)) ?? "overview";
  const panelsByTab: Record<string, HTMLElement[]> = {
    overview: [state, taskPanel, proof, agent, deliverables, review],
    tasks: [state, taskPanel],
    evidence: [state, proof],
    agents: [state, agent],
    runs: [state, agent],
    deliverables: [state, deliverables],
  };
  const visible = panelsByTab[activeTab] ?? panelsByTab.overview;
  grid.append(...visible);
}

function humanBytes(size: unknown): string {
  const n = typeof size === "number" ? size : Number(size);
  if (!Number.isFinite(n) || n < 0) return "—";
  const format = (value: number, maximumFractionDigits = 0) => new Intl.NumberFormat(activeUiLocale(), { maximumFractionDigits }).format(value);
  if (n < 1024) return uiFormat("{0} B", [format(n)]);
  if (n < 1024 * 1024) return uiFormat("{0} KB", [format(n / 1024, 1)]);
  return uiFormat("{0} MB", [format(n / (1024 * 1024), 1)]);
}

async function triggerBrowserDownload(api: V197ApiClient, fileId: string, filename: string): Promise<void> {
  const blob = await api.downloadProjectFile(fileId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "download";
  anchor.dataset.adjunctDownload = fileId;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function buildDeliverablesPanel(
  document: Document,
  api: V197ApiClient,
  projectId: string,
  route: string,
  files: Array<Record<string, unknown>>,
  tasks: Array<Record<string, unknown>>,
): HTMLElement {
  const deliverables = panel(document, uiCopy("Deliverables"), uiFormat("Files · {0}", [files.length]));
  deliverables.classList.add("is-wide");
  deliverables.dataset.adjunctPanel = "deliverables";
  const fileList = element(document, "div", "nur-adjunct-list");
  fileList.dataset.adjunctList = "project-files";
  if (!files.length) fileList.append(empty(document, uiCopy("No stored bytes yet"), uiCopy("Upload a real file, or generate an evidence package. Nothing is invented.")));
  for (const file of files) {
    const row = element(document, "article", "nur-adjunct-row");
    row.dataset.adjunctFile = recordId(file);
    const head = element(document, "div", "nur-adjunct-row-head");
    const stateLabel = uiFormat("{0} · {1}", [controlledLabel(file.provenance, uiSource("Owner supplied source")), controlledLabel(file.storage_state)]);
    head.append(
      userElement(document, "strong", undefined, text(file.original_filename, uiCopy(ADJUNCT_COPY.file))),
      element(document, "span", "nur-adjunct-chip", stateLabel),
    );
    row.append(head, element(document, "p", undefined, uiFormat("{0} · sha256 {1}… · {2}", [humanBytes(file.byte_size), text(file.checksum_sha256, "—").slice(0, 12), controlledLabel(file.scan_state, uiSource("Scan not available"))])));
    const actions = element(document, "div", "nur-adjunct-actions");
    if (file.storage_state === "STORED") {
      const download = button(document, uiCopy("Download"), `project-file-download-${recordId(file)}`);
      download.addEventListener("click", async () => {
        download.disabled = true;
        try {
          await triggerBrowserDownload(api, recordId(file), text(file.safe_filename, "download"));
        } catch (error) {
          row.append(status(document, localizedFailure(error, uiSource("Download failed.")), "warn"));
        } finally {
          download.disabled = false;
        }
      });
      actions.append(download);
    } else if (file.storage_state === "QUARANTINED") {
      actions.append(status(document, uiCopy(ADJUNCT_COPY.quarantinedDownloadBlocked), "warn"));
    }
    row.append(actions);
    fileList.append(row);
  }

  const upload = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  upload.type = "file";
  upload.dataset.adjunctControl = "project-file-input";
  const uploadButton = button(document, uiCopy("Upload file"), "project-file-upload", true);
  const generate = button(document, uiCopy("Generate evidence package"), "project-run-evidence-package");
  const deliverState = status(document, uiCopy("Files are owner-scoped real bytes. Executable formats are quarantined; no run gains authority beyond its approved, deny-by-default capabilities."));
  deliverables.append(fileList, upload, uploadButton, generate, deliverState);

  uploadButton.addEventListener("click", async () => {
    const chosen = upload.files?.[0];
    if (!chosen) {
      deliverState.textContent = uiCopy("Choose a file to upload.");
      deliverState.className = "nur-adjunct-status is-warn";
      return;
    }
    uploadButton.disabled = true;
    try {
      const saved = await api.uploadProjectFile(projectId, chosen);
      const quarantined = (saved as Record<string, unknown>).storage_state === "QUARANTINED";
      deliverState.textContent = quarantined
        ? uiCopy("Stored but quarantined: executable/script formats cannot be downloaded (no scanner connected).")
        : uiCopy("File stored with a verified checksum.");
      deliverState.className = quarantined ? "nur-adjunct-status is-warn" : "nur-adjunct-status is-good";
      await renderProjectDetail(document, api, projectId, route);
    } catch (error) {
      deliverState.textContent = localizedFailure(error, uiSource("Upload failed."));
      deliverState.className = "nur-adjunct-status is-warn";
      uploadButton.disabled = false;
    }
  });

  generate.addEventListener("click", async () => {
    generate.disabled = true;
    deliverState.textContent = uiCopy("Proposing, approving and queueing a bounded EVIDENCE_PACKAGE run…");
    deliverState.className = "nur-adjunct-status is-quiet";
    try {
      const firstTaskId = tasks.length ? recordId(tasks[0]) : null;
      const proposed = await api.proposeExecutionRun(projectId, {
        role: "verifier", request_summary: "Generate a deterministic evidence package.",
        adapter_key: "EVIDENCE_PACKAGE", task_id: firstTaskId,
      });
      const runId = recordId(proposed);
      await api.projectRunAction(runId, "approve");
      let run = await api.projectRunAction(runId, "queue");
      // In queued (non-inline) mode the worker runs asynchronously; poll for truth.
      for (let attempt = 0; attempt < 20 && text(run.status) === "QUEUED"; attempt += 1) {
        await new Promise(resolve => window.setTimeout(resolve, 500));
        run = await api.projectRun(runId);
      }
      const finalStatus = text(run.status);
      if (finalStatus === "SUCCEEDED") {
        deliverState.textContent = uiCopy("Evidence package generated. It is listed above as a downloadable deliverable.");
        deliverState.className = "nur-adjunct-status is-good";
      } else if (finalStatus === "RUNNING" || finalStatus === "QUEUED") {
        deliverState.textContent = uiCopy("The run is executing on the queue. Refresh shortly to download the package.");
        deliverState.className = "nur-adjunct-status is-quiet";
      } else {
        deliverState.textContent = uiFormat("The run did not succeed ({0}). Nothing was fabricated.", [controlledLabel(finalStatus)]);
        deliverState.className = "nur-adjunct-status is-warn";
      }
      await renderProjectDetail(document, api, projectId, route);
    } catch (error) {
      deliverState.textContent = localizedFailure(error, uiSource("The evidence package run failed."));
      deliverState.className = "nur-adjunct-status is-warn";
      generate.disabled = false;
    }
  });

  return deliverables;
}

function renderGlow(document: Document, snapshot: V197BridgeSnapshot): void {
  const glow = snapshot.glow;
  const shell = mount(document, uiCopy("Movement becomes visible light."), uiCopy("Glow is a persisted, source-linked economy. Points appear only after a server-verified action; caps, idempotency and DEMO gates remain active."));
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const level = panel(document, uiCopy("Current constellation"), uiFormat("{0} · Level {1}", [formatV197GlowRank(glow.rank), glow.level]));
  level.classList.add("is-wide");
  const facts = element(document, "div", "nur-adjunct-facts");
  facts.append(fact(document, uiCopy("Available Glow"), text(glow.balance)), fact(document, uiCopy("Lifetime"), text(glow.lifetime_points)), fact(document, uiCopy("Today"), text(glow.today_points)), fact(document, uiCopy("This week"), text(glow.weekly_points)));
  level.append(facts);
  if (glow.next_unlock) {
    const remaining = text((glow.next_unlock as Record<string, unknown>).points_remaining, "0");
    const rank = formatV197GlowRank((glow.next_unlock as Record<string, unknown>).rank);
    level.append(status(document, uiFormat("{0} source-linked Glow until {1}.", [remaining, rank])));
  } else level.append(status(document, uiCopy("Current configured constellation reached."), "good"));

  const quests = panel(document, uiCopy("Return tension"), uiCopy("Quests and mission"));
  const questRows = [glow.daily_quest, glow.weekly_mission].filter(Boolean) as Array<Record<string, unknown>>;
  const questList = element(document, "div", "nur-adjunct-list");
  for (const quest of questRows) {
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(element(document, "strong", undefined, formatV197GlowQuest(quest)), element(document, "span", "nur-adjunct-chip", quest.completed ? uiCopy("RETURNED") : uiFormat("{0}/{1}", [text(quest.progress, "0"), text(quest.target, "1")])));
    row.append(head);
    questList.append(row);
  }
  if (!questRows.length) questList.append(empty(document, uiCopy("No active quest"), uiCopy("NUR will not invent progress.")));
  quests.append(questList);

  const streaks = panel(document, uiCopy("Continuity"), uiFormat("Streaks · {0}", [glow.streaks.length]));
  const streakList = element(document, "div", "nur-adjunct-list");
  for (const streak of glow.streaks) {
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(element(document, "strong", undefined, formatV197GlowStreak(streak.streak_key)), element(document, "span", "nur-adjunct-chip", uiFormat("{0} current · {1} best", [streak.current_count, streak.best_count])));
    row.append(head, element(
      document,
      "p",
      undefined,
      streak.repairs_remaining
        ? streak.repairs_remaining === 1
          ? uiFormat("{0} recovery token", [streak.repairs_remaining])
          : uiFormat("{0} recovery tokens", [streak.repairs_remaining])
        : uiCopy("No recovery token recorded"),
    ));
    streakList.append(row);
  }
  if (!glow.streaks.length) streakList.append(empty(document, uiCopy("No streak yet"), uiCopy("One eligible persisted action starts continuity.")));
  streaks.append(streakList);

  const ledger = panel(document, uiCopy("Source-linked ledger"), uiFormat("Recent Glow · {0}", [glow.recent_transactions.length]));
  ledger.classList.add("is-wide");
  const transactionList = element(document, "div", "nur-adjunct-list");
  for (const transaction of glow.recent_transactions) {
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(element(document, "strong", undefined, formatV197GlowEventReason(transaction.event_type)), element(document, "span", "nur-adjunct-chip", uiFormat("+{0}", [transaction.final_points])));
    row.append(head, element(document, "p", undefined, uiFormat("{0} · {1}", [formatV197GlowEvent(transaction.event_type), date(transaction.created_at)])));
    transactionList.append(row);
  }
  if (!glow.recent_transactions.length) transactionList.append(empty(document, uiCopy("No transaction yet"), uiCopy("No points are displayed without persisted proof.")));
  ledger.append(transactionList);
  grid.append(level, quests, streaks, ledger);
}

async function renderNotifications(document: Document, api: V197ApiClient): Promise<void> {
  const [preferences, notifications] = await Promise.all([api.notificationPreferences(), api.notifications()]);
  const shell = mount(document, uiCopy("Return cues, under your control."), uiCopy("NUR notifications are owner-scoped and factual. There are no fabricated replies, fake urgency or hidden external delivery channels."));
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const inbox = panel(document, uiCopy("In-app ledger"), uiFormat("Notifications · {0}", [notifications.length]));
  const list = element(document, "div", "nur-adjunct-list");
  if (!notifications.length) list.append(empty(document, uiCopy("Nothing is demanding your attention"), uiCopy("NUR will not manufacture a social obligation.")));
  for (const notification of notifications) {
    const row = element(document, "article", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    const ownerWritten = isOwnerWrittenNotification(notification);
    head.append(
      ownerWritten
        ? userElement(document, "strong", undefined, text(notification.title))
        : element(document, "strong", undefined, systemNotificationTitle(notification)),
      element(document, "span", "nur-adjunct-chip", uiFormat("{0}{1}", [notification.is_demo ? ("" + uiCopy("Demo ·") + " ") : "", controlledLabel(notification.category, uiSource("Notification"))])),
    );
    row.append(
      head,
      ownerWritten
        ? userElement(document, "p", undefined, text(notification.body))
        : element(document, "p", undefined, systemNotificationBody(notification)),
    );
    const actions = element(document, "div", "nur-adjunct-actions");
    if (notification.route) {
      const open = button(document, uiCopy("Open"), `notification-open-${recordId(notification)}`);
      open.addEventListener("click", () => navigate(text(notification.route, "/today")));
      actions.append(open);
    }
    if (!notification.read_at) {
      const read = button(document, uiCopy("Mark read"), `notification-read-${recordId(notification)}`);
      read.addEventListener("click", async () => { await api.markNotificationRead(recordId(notification)); await renderNotifications(document, api); });
      actions.append(read);
    }
    row.append(actions);
    list.append(row);
  }
  inbox.append(list);

  const controls = panel(document, uiCopy("Delivery boundary"), uiCopy("Frequency and quiet hours"));
  const frequency = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  frequency.dataset.adjunctControl = "notification-frequency";
  for (const [value, label] of NOTIFICATION_FREQUENCY_OPTIONS) {
    const option = element(document, "option", undefined, uiCopy(label)) as HTMLOptionElement;
    option.value = value; option.selected = value === preferences.frequency; frequency.append(option);
  }
  const quietStart = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  quietStart.dataset.adjunctControl = "notification-quiet-start";
  quietStart.type = "time"; quietStart.value = text(preferences.quiet_hours_start, "");
  const quietEnd = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  quietEnd.dataset.adjunctControl = "notification-quiet-end";
  quietEnd.type = "time"; quietEnd.value = text(preferences.quiet_hours_end, "");
  const save = button(document, uiCopy("Save notification boundary"), "notification-preferences-save", true);
  const preferenceState = status(document, uiFormat("{0} · external push is not claimed.", [controlledLabel(preferences.delivery_status, ADJUNCT_COPY.inAppOnly)]));
  controls.append(frequency, quietStart, quietEnd, save, preferenceState);
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      await api.patchNotificationPreferences({ category_settings: preferences.category_settings ?? {}, frequency: frequency.value, quiet_hours_start: quietStart.value || null, quiet_hours_end: quietEnd.value || null, push_enabled: false, email_enabled: false });
      preferenceState.textContent = uiCopy("Notification boundary persisted.");
      preferenceState.className = "nur-adjunct-status is-good";
    } catch (error) {
      preferenceState.textContent = localizedFailure(error, uiSource("Preferences were not saved."));
      preferenceState.className = "nur-adjunct-status is-warn";
      save.disabled = false;
    }
  });

  const reminder = panel(document, uiCopy("Owner reminder"), uiCopy("Create one truthful re-entry cue"));
  const title = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  title.dataset.adjunctControl = "notification-title";
  title.placeholder = uiCopy("What should return?");
  const body = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  body.dataset.adjunctControl = "notification-body";
  body.placeholder = uiCopy("Why will this still matter?");
  const route = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  route.dataset.adjunctControl = "notification-route";
  route.placeholder = uiCopy("/plan");
  const create = button(document, uiCopy("Create in-app reminder"), "notification-reminder-create", true);
  const reminderState = status(document, uiCopy("This creates a real owner-written reminder, not a fake human ping."));
  reminder.append(title, body, route, create, reminderState);
  create.addEventListener("click", async () => {
    if (!title.value.trim() || !body.value.trim()) return;
    create.disabled = true;
    try {
      await api.createReminder({ category: "PROGRESS", title: title.value.trim(), body: body.value.trim(), route: route.value.trim() || "/today" });
      await renderNotifications(document, api);
    } catch (error) {
      reminderState.textContent = localizedFailure(error, uiSource("Reminder was not created."));
      reminderState.className = "nur-adjunct-status is-warn";
      create.disabled = false;
    }
  });
  grid.append(inbox, controls, reminder);
}

const AGENTIC_TERMINAL_STATES = new Set(["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"]);

function stopAgenticDetailPolling(document: Document): void {
  agenticDetailPollStops.get(document)?.();
  agenticDetailPollStops.delete(document);
}

function latestAgenticSequence(events: Array<Record<string, unknown>>): number {
  return events.reduce((latest, event) => {
    const sequence = typeof event.sequence === "number" ? event.sequence : Number(event.sequence);
    return Number.isFinite(sequence) && sequence >= 0 ? Math.max(latest, sequence) : latest;
  }, 0);
}

function startAgenticDetailPolling(
  document: Document,
  api: V197ApiClient,
  session: V197Session,
  workflowId: string,
  workflowState: string,
  events: Array<Record<string, unknown>>,
  lifecycleState: HTMLElement,
): void {
  stopAgenticDetailPolling(document);
  if (AGENTIC_TERMINAL_STATES.has(workflowState)) return;
  const view = document.defaultView;
  if (!view) return;
  let stopped = false;
  let timeout: number | null = null;
  const afterSequence = latestAgenticSequence(events);
  const stop = () => {
    stopped = true;
    if (timeout !== null) view.clearTimeout(timeout);
    timeout = null;
  };
  const schedule = () => {
    if (stopped || timeout !== null) return;
    timeout = view.setTimeout(() => void poll(), AGENTIC_DETAIL_POLL_MS);
  };
  const poll = async () => {
    timeout = null;
    if (stopped) return;
    if (document.hidden) {
      schedule();
      return;
    }
    try {
      const nextEvents = await api.agenticWorkflowEvents(workflowId, afterSequence);
      if (stopped) return;
      if (nextEvents.length) {
        stop();
        await renderAgenticDetail(document, api, session, workflowId);
        return;
      }
    } catch (error) {
      if (stopped) return;
      setStatus(
        lifecycleState,
        localizedFailure(error, uiSource("The run ledger could not refresh.")),
        "warn",
      );
    }
    schedule();
  };
  agenticDetailPollStops.set(document, stop);
  schedule();
}

function agenticField(
  document: Document,
  label: string,
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): HTMLElement {
  const field = element(document, "label", "nur-adjunct-field");
  field.append(element(document, "span", undefined, label), control);
  return field;
}

function agenticSelect(document: Document, action: string): HTMLSelectElement {
  const select = element(document, "select", "nur-adjunct-select") as HTMLSelectElement;
  select.dataset.adjunctControl = action;
  return select;
}

function agenticOption(document: Document, value: string, label = value): HTMLOptionElement {
  const option = element(document, "option", undefined, label);
  option.value = value;
  return option;
}

function agenticWorkflowRows(
  document: Document,
  workflows: V197AgenticWorkflow[],
): HTMLElement {
  const grouped = groupWorkflows(workflows);
  const emptyCopy: Record<(typeof DRAWER_SECTIONS)[number]["id"], UiCopyKey> = {
    waiting: uiSource("No workflows are waiting."),
    working: uiSource("No workflows are running."),
    scheduled: uiSource("No workflows are scheduled."),
    completed: uiSource("No workflows are completed."),
    failed: uiSource("No workflows have failed."),
  };
  const container = element(document, "div", "nur-agentic-groups");
  for (const section of DRAWER_SECTIONS) {
    const group = element(document, "section", "nur-agentic-group");
    group.append(element(document, "h3", undefined, uiFormat("{0} · {1}", [section.label, grouped[section.id].length])));
    const list = element(document, "div", "nur-adjunct-list");
    for (const workflow of grouped[section.id]) {
      const row = element(document, "div", "nur-adjunct-row");
      const head = element(document, "div", "nur-adjunct-row-head");
      head.append(
        userElement(document, "strong", undefined, workflow.title),
        element(document, "span", "nur-adjunct-chip", controlledLabel(workflow.state)),
      );
      const progress = uiFormat("{0}/{1} steps · {2} cents recorded", [workflow.steps_done, workflow.step_count, workflow.cost_cents]);
      const actions = element(document, "div", "nur-adjunct-actions");
      const open = button(document, uiCopy("Open run ledger"), `agentic-open-${workflow.id}`);
      open.addEventListener("click", () => navigate(`/agents/${workflow.id}`));
      actions.append(open);
      row.append(head, userElement(document, "p", undefined, workflow.objective), element(document, "p", undefined, progress), actions);
      list.append(row);
    }
    if (!grouped[section.id].length) list.append(empty(
      document,
      uiCopy(emptyCopy[section.id]),
      uiCopy("No owner-scoped workflow is placed here."),
    ));
    group.append(list);
    container.append(group);
  }
  return container;
}

async function renderAgents(
  document: Document,
  api: V197ApiClient,
  session: V197Session,
): Promise<void> {
  const [tools, policy, workflows, approvals] = await Promise.all([
    api.agenticTools(),
    api.agenticPolicy(),
    api.agenticWorkflows(),
    api.agenticApprovals(),
  ]);
  const shell = mount(
    document,
    uiCopy("Agency under your authority."),
    uiCopy("NUR can only run a bounded, owner-authored plan through the persisted policy, approval ledger and durable outbox."),
    "/systems",
  );
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);

  const policyPanel = panel(document, uiCopy("Owner policy"), uiCopy("What NUR may prepare or run"));
  policyPanel.classList.add("is-wide");
  const policyFacts = element(document, "div", "nur-adjunct-facts");
  policyFacts.append(
    fact(document, uiCopy("Scope"), uiCopy("Account only")),
    fact(document, uiCopy("Persisted"), policy.persisted ? uiCopy("Yes") : uiCopy("No policy row yet")),
    fact(document, uiCopy("Capabilities"), policy.granted_capabilities.join(", ") || uiCopy("None")),
  );
  const initiative = agenticSelect(document, "agentic-initiative");
  for (const level of ["OFF", "SUGGEST", "PREPARE", "INTERNAL", "CONNECTED", "DELEGATED"] as const) {
    const option = agenticOption(document, level, controlledLabel(level));
    option.selected = policy.initiative_level === level;
    initiative.append(option);
  }
  const maxRisk = agenticSelect(document, "agentic-max-risk");
  for (const risk of ["R0_READ_ONLY", "R1_PRIVATE_DRAFT", "R2_DURABLE_PRIVATE", "R3_EXTERNAL", "R4_IRREVERSIBLE"] as AgenticRiskClass[]) {
    const option = agenticOption(document, risk, describeRisk(risk, true).split(".")[0]);
    option.selected = policy.max_risk_class === risk;
    maxRisk.append(option);
  }
  const dailyBudget = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  dailyBudget.type = "number";
  dailyBudget.min = "0";
  dailyBudget.max = "10000000";
  dailyBudget.step = "1";
  dailyBudget.value = String(policy.daily_budget_cents);
  dailyBudget.dataset.adjunctControl = "agentic-daily-budget";
  const policyControls = element(document, "div", "nur-agentic-policy-controls");
  policyControls.append(
    agenticField(document, uiCopy("Initiative level"), initiative),
    agenticField(document, uiCopy("Maximum risk class"), maxRisk),
    agenticField(document, uiCopy("Daily cost ceiling in cents"), dailyBudget),
  );
  const toolList = element(document, "div", "nur-adjunct-list");
  for (const tool of tools) {
    const row = element(document, "div", "nur-adjunct-row nur-agentic-tool");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(
      element(document, "strong", undefined, agenticToolName(tool.key)),
      element(document, "span", "nur-adjunct-chip", tool.bound ? controlledLabel(tool.risk_class) : controlledLabel("UNBOUND")),
    );
    const permissions = element(document, "div", "nur-agentic-tool-permissions");
    const permitLabel = element(document, "label", "nur-adjunct-toggle");
    permitLabel.append(element(document, "span", undefined, uiCopy("Permit this tool")));
    const permit = element(document, "input") as HTMLInputElement;
    permit.type = "checkbox";
    permit.checked = tool.bound && policy.permitted_tools.includes(tool.key);
    permit.disabled = !tool.bound;
    permit.dataset.agenticPermit = tool.key;
    permitLabel.append(permit);
    const autoLabel = element(document, "label", "nur-adjunct-toggle");
    autoLabel.append(element(document, "span", undefined, uiCopy("Allow policy auto-run")));
    const auto = element(document, "input") as HTMLInputElement;
    auto.type = "checkbox";
    auto.checked = tool.bound && policy.auto_run_tools.includes(tool.key);
    auto.disabled = !tool.bound || !permit.checked;
    auto.dataset.agenticAuto = tool.key;
    permit.addEventListener("change", () => {
      auto.disabled = !permit.checked;
      if (!permit.checked) auto.checked = false;
    });
    autoLabel.append(auto);
    permissions.append(permitLabel, autoLabel);
    row.append(head, element(document, "p", undefined, agenticToolSummary(tool.key)), element(document, "p", undefined, describeRisk(tool.risk_class, tool.reversible)), permissions);
    toolList.append(row);
  }
  const policyActions = element(document, "div", "nur-adjunct-actions");
  const savePolicy = button(document, uiCopy("Save agency policy"), "agentic-policy-save", true);
  const policyState = status(document, uiCopy("Unbound tools stay visible but cannot be permitted or called."));
  policyActions.append(savePolicy);
  policyPanel.append(policyFacts, policyControls, toolList, policyActions, policyState);
  savePolicy.addEventListener("click", async () => {
    savePolicy.disabled = true;
    const permitted = [...policyPanel.querySelectorAll<HTMLInputElement>("[data-agentic-permit]:checked")]
      .map(input => input.dataset.agenticPermit ?? "").filter(Boolean);
    const autoRun = [...policyPanel.querySelectorAll<HTMLInputElement>("[data-agentic-auto]:checked")]
      .map(input => input.dataset.agenticAuto ?? "").filter(key => key && permitted.includes(key));
    try {
      const next = await api.putAgenticPolicy({
        seen_version: policy.version,
        initiative_level: initiative.value as V197AgenticPolicy["initiative_level"],
        max_risk_class: maxRisk.value as AgenticRiskClass,
        permitted_tools: permitted,
        auto_run_tools: autoRun,
        denied_tools: policy.denied_tools.filter(key => !permitted.includes(key)),
        daily_budget_cents: Math.max(0, Number.parseInt(dailyBudget.value || "0", 10)),
        max_proposals_per_day: policy.max_proposals_per_day,
        cooldown_minutes: policy.cooldown_minutes,
        quiet_hours: policy.quiet_hours && Object.keys(policy.quiet_hours).length ? policy.quiet_hours : null,
      });
      policy.permitted_tools = next.permitted_tools;
      policy.auto_run_tools = next.auto_run_tools;
      policy.version = next.version;
      policyState.textContent = uiCopy("Owner policy persisted. No workflow was started.");
      policyState.className = "nur-adjunct-status is-good";
    } catch (error) {
      policyState.textContent = localizedFailure(error, uiSource("Agency policy could not be saved."));
      policyState.className = "nur-adjunct-status is-warn";
    } finally {
      savePolicy.disabled = false;
    }
  });

  const builder = panel(document, uiCopy("Owner-authored workflow"), uiCopy("One bounded step at a time"));
  const title = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  title.dataset.adjunctControl = "agentic-title";
  title.placeholder = uiCopy("Name this workflow");
  title.maxLength = 400;
  const objective = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  objective.dataset.adjunctControl = "agentic-objective";
  objective.placeholder = uiCopy("What exact result should this workflow pursue?");
  objective.maxLength = 5000;
  const success = element(document, "input", "nur-adjunct-input") as HTMLInputElement;
  success.dataset.adjunctControl = "agentic-success";
  success.placeholder = uiCopy("What observable result counts as done?");
  success.maxLength = 500;
  const toolSelect = agenticSelect(document, "agentic-tool");
  for (const tool of tools.filter(row => row.bound)) toolSelect.append(agenticOption(document, tool.key, agenticToolName(tool.key)));
  const role = agenticSelect(document, "agentic-role");
  for (const value of ["operator", "researcher", "implementer", "writer", "translator", "verifier", "critic", "qa", "security_reviewer", "visual_reviewer"]) {
    role.append(agenticOption(document, value, controlledLabel(value)));
  }
  const argumentsInput = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  argumentsInput.dataset.adjunctControl = "agentic-arguments";
  argumentsInput.value = "{}";
  argumentsInput.spellcheck = false;
  const rationale = element(document, "textarea", "nur-adjunct-textarea") as HTMLTextAreaElement;
  rationale.dataset.adjunctControl = "agentic-rationale";
  rationale.placeholder = uiCopy("Why is this step necessary?");
  rationale.maxLength = 2000;
  const create = button(document, uiCopy("Compile workflow draft"), "agentic-workflow-create", true);
  const createState = status(document, uiCopy("Create compiles and persists a draft. It does not start execution."));
  const createActions = element(document, "div", "nur-adjunct-actions");
  createActions.append(create);
  builder.append(
    agenticField(document, uiCopy("Title"), title),
    agenticField(document, uiCopy("Objective"), objective),
    agenticField(document, uiCopy("Success criterion"), success),
    agenticField(document, uiCopy("Bound tool"), toolSelect),
    agenticField(document, uiCopy("Role"), role),
    agenticField(document, uiCopy("Tool arguments as JSON"), argumentsInput),
    agenticField(document, uiCopy("Rationale"), rationale),
    createActions,
    createState,
  );
  create.addEventListener("click", async () => {
    if (!title.value.trim() || !objective.value.trim() || !success.value.trim() || !rationale.value.trim()) {
      createState.textContent = uiCopy("Title, objective, success criterion and rationale are required.");
      createState.className = "nur-adjunct-status is-warn";
      return;
    }
    if (!policy.permitted_tools.includes(toolSelect.value)) {
      createState.textContent = uiCopy("Permit the selected tool in the owner policy before compiling this workflow.");
      createState.className = "nur-adjunct-status is-warn";
      return;
    }
    let inputRefs: Record<string, unknown>;
    try {
      const parsed = JSON.parse(argumentsInput.value) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(uiCopy("Tool arguments must be a JSON object."));
      inputRefs = parsed as Record<string, unknown>;
    } catch (error) {
      createState.textContent = localizedFailure(error, uiSource("Tool arguments must be valid JSON."));
      createState.className = "nur-adjunct-status is-warn";
      return;
    }
    create.disabled = true;
    try {
      const created = await api.createAgenticWorkflow({
        request_id: crypto.randomUUID(),
        title: title.value.trim(),
        objective: objective.value.trim(),
        context_manifest: { source: "owner-authored V197 agency chamber", orbit_id: session.orbit.id },
        success_criteria: [success.value.trim()],
        proposed_steps: [{
          key: "step-1",
          role: role.value,
          tool_key: toolSelect.value,
          depends_on: [],
          input_refs: inputRefs,
          rationale: rationale.value.trim(),
        }],
      });
      navigate(`/agents/${created.id}`);
    } catch (error) {
      createState.textContent = localizedFailure(error, uiSource("Workflow did not compile."));
      createState.className = "nur-adjunct-status is-warn";
      create.disabled = false;
    }
  });

  const approvalPanel = panel(document, uiCopy("Waiting for you"), uiFormat("Approvals · {0}", [approvals.length]));
  const approvalList = element(document, "div", "nur-adjunct-list");
  for (const approval of approvals) {
    const card = buildApprovalCard(approval);
    const row = element(document, "div", "nur-adjunct-row");
    row.dataset.agenticApprovalId = approval.id;
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(
      approval.workflow_title
        ? userElement(document, "strong", undefined, approval.workflow_title)
        : element(document, "strong", undefined, uiFormat("Workflow {0}", [approval.workflow_id.slice(0, 8)])),
      element(document, "span", "nur-adjunct-chip", controlledLabel(approval.risk_class)),
    );
    const exactArguments = element(document, "pre", "nur-adjunct-json", JSON.stringify(approval.redacted_arguments, null, 2));
    setVerbatimUserText(exactArguments, JSON.stringify(approval.redacted_arguments, null, 2));
    const decisionState = status(document, card.expiryNote ?? uiCopy("This decision is bound to the displayed plan, call version and argument digest."));
    const decisions = element(document, "div", "nur-adjunct-actions");
    if (card.actionable) {
      const approve = button(document, uiCopy("Approve exact call"), `agentic-approval-approve-${approval.id}`, true);
      const reject = button(document, uiCopy("Reject"), `agentic-approval-reject-${approval.id}`);
      const edit = button(document, uiCopy("Edit arguments"), `agentic-approval-edit-${approval.id}`);
      const submitEdit = button(document, uiCopy("Submit edited call"), `agentic-approval-submit-edit-${approval.id}`, true);
      const editInput = element(
        document,
        "textarea",
        "nur-adjunct-json-input",
        JSON.stringify(approval.redacted_arguments, null, 2),
      ) as HTMLTextAreaElement;
      editInput.setAttribute("aria-label", uiCopy("Edit the owner-visible approval arguments as JSON"));
      editInput.hidden = true;
      submitEdit.hidden = true;
      const editorContract = resolveApprovalEditor(approval);
      const editorBoundary = status(
        document,
        editorContract.mode === "RAW_JSON"
          ? uiFormat("{0} Review and submit the complete JSON object.", [editorContract.reason])
          : uiCopy("The API supplied an object input schema for this approval."),
      );
      editorBoundary.dataset.approvalEditorMode = editorContract.mode.toLowerCase().replace("_", "-");
      editorBoundary.hidden = true;
      const decide = async (choice: "APPROVE" | "REJECT" | "EDIT", editedArguments?: Record<string, unknown>) => {
        approve.disabled = true;
        reject.disabled = true;
        edit.disabled = true;
        submitEdit.disabled = true;
        try {
          await api.decideAgenticApproval(approval, choice, undefined, editedArguments);
          await renderAgents(document, api, session);
        } catch (error) {
          decisionState.textContent = localizedFailure(error, uiSource("Approval decision did not persist."));
          decisionState.className = "nur-adjunct-status is-warn";
          approve.disabled = false;
          reject.disabled = false;
          edit.disabled = false;
          submitEdit.disabled = false;
        }
      };
      const toggleEdit = () => {
        editInput.hidden = !editInput.hidden;
        submitEdit.hidden = editInput.hidden;
        editorBoundary.hidden = editInput.hidden;
        if (!editInput.hidden) editInput.focus();
      };
      submitEdit.addEventListener("click", () => {
        try {
          const parsed: unknown = JSON.parse(editInput.value);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error(uiCopy("Edited arguments must be a JSON object."));
          }
          void decide("EDIT", parsed as Record<string, unknown>);
        } catch (error) {
          decisionState.textContent = localizedFailure(error, uiSource("Edited arguments must be valid JSON."));
          decisionState.className = "nur-adjunct-status is-warn";
        }
      });
      approve.addEventListener("click", () => void decide("APPROVE"));
      reject.addEventListener("click", () => void decide("REJECT"));
      edit.addEventListener("click", toggleEdit);
      decisions.append(approve, reject, edit, editorBoundary, editInput, submitEdit);
    }
    row.append(
      head,
      userElement(document, "p", undefined, card.why),
      fact(document, uiCopy("Tool"), card.toolLabel),
      userFact(document, uiCopy("Scope"), card.scope),
      fact(document, uiCopy("Risk"), card.risk),
      userFact(document, uiCopy("Expected"), card.expected),
      fact(document, uiCopy("Cost"), card.cost),
      ...(approval.expires_at ? [fact(document, uiCopy("Expires"), date(approval.expires_at))] : []),
      exactArguments,
      decisions,
      decisionState,
    );
    approvalList.append(row);
  }
  if (!approvals.length) approvalList.append(empty(document, uiCopy("No approval is waiting"), uiCopy("NUR has no pending call that requires your consent.")));
  approvalPanel.append(approvalList);

  const workflowPanel = panel(document, uiCopy("Run ledger"), uiFormat("Owner workflows · {0}", [workflows.length]));
  workflowPanel.classList.add("is-wide");
  workflowPanel.append(agenticWorkflowRows(document, workflows));
  grid.append(policyPanel, builder, approvalPanel, workflowPanel);
}

async function renderAgenticDetail(
  document: Document,
  api: V197ApiClient,
  session: V197Session,
  workflowId: string,
): Promise<void> {
  stopAgenticDetailPolling(document);
  const [workflow, events] = await Promise.all([
    api.agenticWorkflow(workflowId),
    api.agenticWorkflowEvents(workflowId),
  ]);
  const shell = mount(document, workflow.title, workflow.objective, "/agents");
  protectMountedOwnerCopy(shell, workflow.title, workflow.objective);
  const grid = element(document, "div", "nur-adjunct-grid");
  shell.append(grid);
  const statePanel = panel(document, uiCopy("Workflow state"), controlledLabel(workflow.state));
  statePanel.classList.add("is-wide");
  const stateFacts = element(document, "div", "nur-adjunct-facts");
  stateFacts.append(
    fact(document, uiCopy("Plan version"), String(workflow.plan_version)),
    fact(document, uiCopy("Cost recorded"), uiFormat("{0} cents", [workflow.cost_cents])),
    userFact(document, uiCopy("Success"), workflow.success_criteria.join(" · ")),
  );
  const lifecycleActions = element(document, "div", "nur-adjunct-actions");
  const lifecycleState = status(document, uiCopy("Every lifecycle write is owner-scoped, version-fenced and append-only in the run ledger."));
  if (workflow.state === "PLAN_READY") {
    const start = button(document, uiCopy("Start this plan"), "agentic-workflow-start", true);
    start.addEventListener("click", async () => {
      start.disabled = true;
      try {
        await api.startAgenticWorkflow(workflow.id, workflow.plan_version);
        await renderAgenticDetail(document, api, session, workflow.id);
      } catch (error) {
        lifecycleState.textContent = localizedFailure(error, uiSource("Workflow did not start."));
        lifecycleState.className = "nur-adjunct-status is-warn";
        start.disabled = false;
      }
    });
    lifecycleActions.append(start);
  }
  if (!AGENTIC_TERMINAL_STATES.has(workflow.state)) {
    const cancel = button(document, uiCopy("Cancel workflow"), "agentic-workflow-cancel");
    cancel.addEventListener("click", async () => {
      cancel.disabled = true;
      try {
        await api.cancelAgenticWorkflow(workflow.id);
        await renderAgenticDetail(document, api, session, workflow.id);
      } catch (error) {
        lifecycleState.textContent = localizedFailure(error, uiSource("Cancellation did not persist."));
        lifecycleState.className = "nur-adjunct-status is-warn";
        cancel.disabled = false;
      }
    });
    lifecycleActions.append(cancel);
  }
  statePanel.append(stateFacts, lifecycleActions, lifecycleState);

  const stepsPanel = panel(document, uiCopy("Compiled plan"), uiFormat("Steps · {0}", [workflow.steps.length]));
  const stepList = element(document, "div", "nur-adjunct-list");
  for (const step of workflow.steps) {
    const row = element(document, "div", "nur-adjunct-row");
    const head = element(document, "div", "nur-adjunct-row-head");
    head.append(userElement(document, "strong", undefined, `${step.ordinal}. ${step.key}`), element(document, "span", "nur-adjunct-chip", controlledLabel(step.state)));
    row.append(head, element(document, "p", undefined, uiFormat("{0} · {1} v{2}", [controlledLabel(step.role, uiSource("Agent role")), step.tool_key ? agenticToolName(step.tool_key) : uiCopy("No tool"), step.tool_version ?? uiCopy("none")])));
    const inputEvidence = element(document, "pre", "nur-adjunct-json");
    setVerbatimUserText(inputEvidence, JSON.stringify(step.input_refs, null, 2));
    row.append(inputEvidence);
    if (step.retryable) {
      const actions = element(document, "div", "nur-adjunct-actions");
      const retry = button(document, uiCopy("Retry workflow from this plan"), `agentic-workflow-retry-${workflow.id}`);
      retry.addEventListener("click", async () => {
        retry.disabled = true;
        try {
          const successor = await api.retryAgenticWorkflow(workflow.id, requestKey("agentic-retry"), workflow.plan_version);
          navigate(`/agents/${successor.id}`);
        } catch (error) {
          lifecycleState.textContent = localizedFailure(error, uiSource("Workflow retry was refused."));
          lifecycleState.className = "nur-adjunct-status is-warn";
          retry.disabled = false;
        }
      });
      actions.append(retry);
      row.append(actions);
    }
    stepList.append(row);
  }
  stepsPanel.append(stepList);

  const eventPanel = panel(document, uiCopy("Append-only evidence"), uiFormat("Run events · {0}", [events.length]));
  const eventList = element(document, "div", "nur-adjunct-list");
  for (const event of events) {
    const row = element(document, "div", "nur-adjunct-row");
    row.append(
      element(document, "strong", undefined, controlledLabel(event.event_type, uiSource("Workflow event"))),
      userElement(document, "p", undefined, text(event.summary)),
      element(document, "p", undefined, uiFormat("{0} · {1}", [controlledLabel(event.actor, uiSource("Workflow actor")), date(event.created_at)])),
    );
    eventList.append(row);
  }
  if (!events.length) eventList.append(empty(document, uiCopy("No event returned"), uiCopy("The API did not return an append-only event for this workflow.")));
  eventPanel.append(eventList);
  grid.append(statePanel, stepsPanel, eventPanel);
  startAgenticDetailPolling(document, api, session, workflow.id, workflow.state, events, lifecycleState);
}

function renderError(document: Document, error: unknown, backRoute = "/systems"): void {
  const shell = mount(document, uiCopy("This chamber could not open."), uiCopy("NUR kept the boundary closed instead of inventing data."), backRoute);
  const grid = element(document, "div", "nur-adjunct-grid");
  const errorPanel = panel(document, uiCopy("Honest runtime state"), uiCopy("No fabricated fallback"));
  errorPanel.classList.add("is-wide");
  errorPanel.append(status(document, localizedFailure(error, uiSource("The requested owner data is unavailable.")), "warn"));
  grid.append(errorPanel);
  shell.append(grid);
}

export async function renderV197Adjunct(
  document: Document,
  route: string,
  api: V197ApiClient,
  snapshot: V197BridgeSnapshot | null,
  refreshSnapshot: RefreshSnapshot,
  session: V197Session,
): Promise<boolean> {
  if (!route.startsWith("/agents/")) stopAgenticDetailPolling(document);
  const existing = document.getElementById(ROOT_ID);
  const isAdjunct = route === "/settings"
    || route === "/memory"
    || route === "/teach-nur"
    || route === "/billing"
    || route === "/capsules"
    || route === "/agents"
    || route.startsWith("/agents/")
    || route.startsWith("/capsule/")
    || route === "/universe/insights/candidates"
    || route.startsWith("/universe/insights/candidates/")
    || route === "/consultations"
    || route.startsWith("/consultations/")
    || route === "/universe/consultation"
    || route.startsWith("/universe/consultation/")
    || route === "/community"
    || route === "/universe/community"
    || route.startsWith("/community/")
    || route.startsWith("/universe/community/")
    || route === "/projects"
    || route.startsWith("/projects/")
    || route === "/glow"
    || route === "/notifications"
    || route === "/universe/omega"
    || route === "/universe/omega/review"
    || route.startsWith("/universe/omega/why-changed/");
  if (!isAdjunct) {
    existing?.remove();
    restoreAdjunctBackground(document);
    return false;
  }

  try {
    if (route === "/settings") {
      if (!snapshot) throw new Error(uiCopy("Settings require the full owner snapshot."));
      await renderSettings(document, api, snapshot, refreshSnapshot);
    }
    else if (route === "/memory") {
      if (!snapshot) throw new Error(uiCopy("Memory requires the full owner snapshot."));
      await renderMemory(document, api, snapshot);
    }
    else if (route === "/teach-nur") {
      if (!snapshot) throw new Error(uiCopy("Teach NUR requires the full owner snapshot."));
      await renderTeachNUR(document, api, snapshot);
    }
    else if (route === "/billing") await renderBilling(document, api);
    else if (route === "/capsules") {
      if (!snapshot) throw new Error(uiCopy("Capsules require the full owner snapshot."));
      await renderOwnerCapsules(document, api, snapshot);
    }
    else if (route === "/agents") await renderAgents(document, api, session);
    else if (route.startsWith("/agents/")) await renderAgenticDetail(document, api, session, decodeURIComponent(route.slice("/agents/".length)));
    else if (route.startsWith("/capsule/")) await renderCapsule(document, api, decodeURIComponent(route.slice("/capsule/".length)));
    else if (route === "/consultations" || route === "/universe/consultation") await renderConsultationIndex(document, api, session.orbit.id);
    else if (route.startsWith("/consultations/")) await renderConsultationDetail(document, api, decodeURIComponent(route.split("/")[2] ?? ""));
    else if (route.startsWith("/universe/consultation/")) await renderConsultationDetail(document, api, decodeURIComponent(route.split("/")[3] ?? ""));
    else if (route === "/universe/insights/candidates" || route.startsWith("/universe/insights/candidates/")) await renderCandidateInsights(document, api);
    else if (route.startsWith("/community/room/")) await renderCommunityRoom(document, api, decodeURIComponent(route.split("/")[3] ?? ""));
    else if (route.startsWith("/universe/community/room/")) await renderCommunityRoom(document, api, decodeURIComponent(route.split("/")[4] ?? ""));
    else if (route.startsWith("/community/post/")) await renderCommunityPost(document, api, decodeURIComponent(route.split("/")[3] ?? ""));
    else if (route.startsWith("/universe/community/post/")) await renderCommunityPost(document, api, decodeURIComponent(route.split("/")[4] ?? ""));
    else if (route === "/community" || route === "/universe/community" || route.startsWith("/community/")) await renderCommunityIndex(document, api);
    else if (route.startsWith("/universe/community/")) await renderCommunityIndex(document, api);
    else if (route === "/projects" || route === "/projects/new") await renderProjectsIndex(document, api);
    else if (route.startsWith("/projects/")) await renderProjectDetail(document, api, decodeURIComponent(route.split("/")[2] ?? ""), route);
    else if (route === "/glow") {
      if (!snapshot) throw new Error(uiCopy("Glow requires the full owner snapshot."));
      renderGlow(document, snapshot);
    }
    else if (route === "/notifications") await renderNotifications(document, api);
    else if (route === "/universe/omega/review") await renderOmegaReview(document, api);
    else if (route.startsWith("/universe/omega/why-changed/")) await renderOmegaWhyChanged(document, api, decodeURIComponent(route.slice("/universe/omega/why-changed/".length)));
    else await renderOmegaDashboard(document, api);
  } catch (error) {
    renderError(
      document,
      error,
      route.startsWith("/universe/omega")
        ? "/universe/omega"
        : route.startsWith("/universe/")
          ? "/universe"
          : "/systems",
    );
  }
  return true;
}
