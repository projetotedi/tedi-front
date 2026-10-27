import type {
  CourseLessonPlanItemResponseDto,
  CourseLessonPlansResponseDto,
} from "@api/generated/model";

/**
 * A lesson plan in the sequence being built. The position is the place in the array, so the item
 * does not carry one: it would go stale at the first move.
 */
export type SequenceItem = Omit<CourseLessonPlanItemResponseDto, "position">;

/** The saved sequence as the starting point of the draft, in the order the API answered. */
export function toSequenceItems(response: CourseLessonPlansResponseDto): SequenceItem[] {
  return response.items.map(({ position: _position, ...item }) => item);
}

/**
 * The planned workload of a draft: the sum of the durations of its plans (RF-018, RN-24). It is
 * never typed. The API answers the same sum on save, and the dialog shows this one while it is
 * still being edited.
 */
export function sequenceWorkloadMinutes(items: readonly SequenceItem[]): number {
  return items.reduce((total, item) => total + item.expectedDurationMinutes, 0);
}

/** The body of the `PUT`: the whole sequence, in order. */
export function toLessonPlanIds(items: readonly SequenceItem[]): string[] {
  return items.map((item) => item.lessonPlanId);
}

/**
 * The plans the picker offers: the catalog and the saved sequence together (so a plan taken out of
 * the draft can come back), without what is already in the draft and without archived plans, which
 * cannot enter a sequence (RN-27). For a plan that is in both, the saved copy wins, as it is what
 * the API answered for this course. Sorted by title.
 */
export function availableLessonPlans(
  catalog: readonly SequenceItem[],
  saved: readonly SequenceItem[],
  draft: readonly SequenceItem[],
): SequenceItem[] {
  const inDraft = new Set(draft.map((item) => item.lessonPlanId));
  const candidates = new Map<string, SequenceItem>();

  for (const item of [...catalog, ...saved]) candidates.set(item.lessonPlanId, item);

  return [...candidates.values()]
    .filter((item) => !inDraft.has(item.lessonPlanId) && item.archivedAt === null)
    .sort((first, second) => first.title.localeCompare(second.title, "pt-BR"));
}
