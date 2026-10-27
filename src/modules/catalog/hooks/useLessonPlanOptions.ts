import { MOCK_LESSON_PLANS } from "../mocks/lesson-plans.mock";
import type { SequenceItem } from "../lib/course-sequence";

/** The lesson plans of the mock catalog that can still enter a sequence, as items of a sequence. */
const MOCK_OPTIONS: SequenceItem[] = MOCK_LESSON_PLANS.filter(
  (plan) => plan.usage !== "archived",
).map((plan) => ({
  lessonPlanId: plan.id,
  title: plan.title,
  contents: plan.contents,
  expectedDurationMinutes: plan.expectedDurationMinutes,
  materialUrl: plan.materialUrl,
  // The API counts the course that has the plan, so a plan of a sequence is always in at least one.
  courseCount: Math.max(plan.courseCount, 1),
  archivedAt: null,
}));

export interface LessonPlanOptions {
  options: SequenceItem[];
  isPending: boolean;
  isError: boolean;
}

/**
 * The lesson plans the picker of the sequence can offer for a course (RN-27: never an archived one).
 *
 * TEMPORARY. The API has no list of lesson plans yet (`GET /lesson-plans?excludeCourseId=`, GUS-95),
 * so this reads the mock catalog that the list screen uses, which is why the ids here are not UUIDs
 * (`lesson-plan-07`): saving a sequence with one of them is a 400 on the real API. When GUS-95 is
 * done, only the body of this hook changes, to `useListLessonPlans({ excludeCourseId: courseId })`
 * mapped to `SequenceItem`; the signature, the dialog and the picker stay.
 */
export function useLessonPlanOptions(_courseId: string): LessonPlanOptions {
  return { options: MOCK_OPTIONS, isPending: false, isError: false };
}
