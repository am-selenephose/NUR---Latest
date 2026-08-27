import { type UiCopyKey, uiCopy, uiSource } from "../lib/i18n";
import type { V197SystemSnapshot } from "./v197ApiClient";

type SystemUiSource = {
  title: UiCopyKey;
  definition: UiCopyKey;
  questions: readonly UiCopyKey[];
  checklist: readonly UiCopyKey[];
  ignored: UiCopyKey;
  followed: UiCopyKey;
};

const SYSTEM_UI_SOURCE: Readonly<Record<string, SystemUiSource>> = {
  ambition: {
    title: uiSource("Ambition"),
    definition: uiSource("Private hunger, discipline, identity, long-range desire, self-respect, and work that matters even when nobody applauds."),
    questions: [
      uiSource("What do you want but keep minimizing?"),
      uiSource("What would make this week feel less wasted?"),
      uiSource("What are you scared to admit you care about?"),
      uiSource("What is one action nobody needs to see?"),
      uiSource("Are you protecting your ambition or starving it?"),
      uiSource("What would your future self be angry you ignored?"),
    ],
    checklist: [
      uiSource("Define one private goal."),
      uiSource("Write why it matters."),
      uiSource("Choose one 20-minute move."),
      uiSource("Remove one performative task."),
      uiSource("Log one quiet win."),
      uiSource("Return tomorrow."),
    ],
    ignored: uiSource("Open loops are likely to harden into drift and resentment."),
    followed: uiSource("Repeated private movement is likely to stabilize identity and confidence."),
  },
  rebuild: {
    title: uiSource("Rebuild"),
    definition: uiSource("Anything damaged, collapsed, lost, neglected, or needing repair: body, mind, money, trust, relationships, rhythm, home, work, or project."),
    questions: [
      uiSource("What needs rebuilding?"),
      uiSource("Is it relationship, body, mind, money, work, home, project, or trust?"),
      uiSource("What is still salvageable?"),
      uiSource("What is not worth saving?"),
      uiSource("What is the smallest stabilizing action?"),
      uiSource("What keeps re-breaking it?"),
      uiSource("What support or boundary is needed?"),
    ],
    checklist: [
      uiSource("Name the broken area."),
      uiSource("Choose the rebuild type."),
      uiSource("Define the first repair action."),
      uiSource("Remove one repeating damage source."),
      uiSource("Create a recovery timeline."),
      uiSource("Mark the first repair."),
      uiSource("Return with an outcome."),
    ],
    ignored: uiSource("The same damage source is likely to repeat without a smaller repair and boundary."),
    followed: uiSource("Small stable repairs are likely to restore capacity before ambition expands."),
  },
  creation: {
    title: uiSource("Creation"),
    definition: uiSource("Making things: art, writing, product, code, business, content, systems, projects, ideas, releases, and deliverables."),
    questions: [
      uiSource("What are you making?"),
      uiSource("Is it an idea, draft, prototype, product, release, content, or art?"),
      uiSource("What is the current state?"),
      uiSource("What proves progress?"),
      uiSource("What is the smallest shippable piece?"),
      uiSource("What keeps delaying release?"),
      uiSource("What needs review?"),
    ],
    checklist: [
      uiSource("Create the project."),
      uiSource("Define the deliverable."),
      uiSource("Create one task."),
      uiSource("Attach evidence."),
      uiSource("Run and review the work."),
      uiSource("Ship one milestone."),
      uiSource("Log the outcome."),
    ],
    ignored: uiSource("The work is likely to stall in ideation, avoidance, or review without a shippable edge."),
    followed: uiSource("A small reviewed deliverable is likely to turn imagination into momentum."),
  },
  growth: {
    title: uiSource("Growth"),
    definition: uiSource("Expansion of capability: skill, learning, income, leverage, mastery, and the compounding progress that changes what you are able to do."),
    questions: [
      uiSource("What capability are you trying to grow?"),
      uiSource("Is this skill, knowledge, income, leverage, or reach?"),
      uiSource("What can you already do that you could not before?"),
      uiSource("What is the bottleneck holding the next level?"),
      uiSource("What proves the growth is real and not just effort?"),
      uiSource("What is the next deliberate session or move?"),
    ],
    checklist: [
      uiSource("Name the capability."),
      uiSource("Define what proof of growth looks like."),
      uiSource("Create one deliberate practice or earning block."),
      uiSource("Complete one session."),
      uiSource("Record what changed."),
      uiSource("Return the outcome to the timeline."),
    ],
    ignored: uiSource("Effort without a proof of change is likely to feel busy while capability stays flat."),
    followed: uiSource("Deliberate practice with recorded evidence is likely to compound into real capability."),
  },
  introspection: {
    title: uiSource("Introspection"),
    definition: uiSource("Honest awareness of your own state: energy, capacity, meaning, patterns, what is actually happening beneath the activity, and what it is telling you."),
    questions: [
      uiSource("What is actually true about your state right now?"),
      uiSource("Energy and capacity from 0 to 10?"),
      uiSource("What pattern keeps repeating?"),
      uiSource("What are you avoiding noticing?"),
      uiSource("What does this week want you to understand?"),
      uiSource("What is one honest thing to write down?"),
    ],
    checklist: [
      uiSource("Check state and capacity honestly."),
      uiSource("Write one unfiltered observation."),
      uiSource("Name the pattern."),
      uiSource("Decide whether it needs rest, repair, or a decision."),
      uiSource("Log the reflection."),
      uiSource("Return to it once more later."),
    ],
    ignored: uiSource("Activity without review is likely to repeat the same pattern at higher cost."),
    followed: uiSource("Recorded honest review is likely to surface the pattern early enough to change it."),
  },
  connection: {
    title: uiSource("Connection"),
    definition: uiSource("People, relationships, community, conversation, repair, support, group belonging, boundaries, and social energy."),
    questions: [
      uiSource("Who are you thinking about?"),
      uiSource("Is this support, conflict, repair, distance, or collaboration?"),
      uiSource("What is unsaid?"),
      uiSource("What is the next conversation?"),
      uiSource("Does this need a boundary?"),
      uiSource("Does this need a council or group NUR?"),
    ],
    checklist: [
      uiSource("Add the person or orbit."),
      uiSource("Log the open conversation."),
      uiSource("Send one clear message."),
      uiSource("Attempt repair where appropriate."),
      uiSource("Set a boundary where needed."),
      uiSource("Start a council when multiple people are involved."),
      uiSource("Return the outcome."),
    ],
    ignored: uiSource("Unspoken loops are likely to accumulate tension or distance."),
    followed: uiSource("A clear conversation or boundary is likely to reduce relational ambiguity."),
  },
};

const TITLE_TO_SLUG = Object.fromEntries(
  Object.entries(SYSTEM_UI_SOURCE).map(([slug, copy]) => [copy.title, slug]),
) as Record<string, string>;

function sourceFor(slug: string | null | undefined): SystemUiSource | null {
  return slug ? SYSTEM_UI_SOURCE[slug.trim().toLowerCase()] ?? null : null;
}

export function v197SystemTitle(slug: string | null | undefined, fallback?: string): string {
  const source = sourceFor(slug) ?? sourceFor(TITLE_TO_SLUG[fallback ?? ""]);
  return source ? uiCopy(source.title) : fallback?.trim() || uiCopy("System");
}

export function v197SystemDefinition(system: Pick<V197SystemSnapshot, "slug">): string {
  const source = sourceFor(system.slug);
  return source ? uiCopy(source.definition) : uiCopy("No System definition is available.");
}

export function v197SystemQuestion(system: Pick<V197SystemSnapshot, "slug">, index: number): string {
  const source = sourceFor(system.slug)?.questions[index];
  return source ? uiCopy(source) : uiCopy("No additional diagnostic question.");
}

export function v197SystemNextMove(system: Pick<V197SystemSnapshot, "slug" | "next_move">): string {
  if (system.next_move.kind !== "CHECKLIST_SUGGESTION") return system.next_move.title;
  const source = sourceFor(system.slug)?.checklist.find(row => row === system.next_move.title);
  return source ? uiCopy(source) : uiCopy("Choose one owner-scoped next move.");
}

export function v197SystemPrediction(
  system: Pick<V197SystemSnapshot, "slug">,
  branch: "ignored" | "followed",
): string {
  const source = sourceFor(system.slug)?.[branch];
  return source ? uiCopy(source) : uiCopy("No deterministic System prediction is available.");
}

export function v197SystemProgressFormula(): string {
  return uiCopy("40% actions + 20% goals + 15% diagnostic + 15% returned outcomes + 10% Glow activity - blocker and missed-Return penalties");
}
