import { useListLessonPlans } from "@api/generated/catalog/catalog";
import { LessonPlanListSort } from "@api/generated/model";

import type { SequenceItem } from "../lib/course-sequence";

/** The most plans the API gives in one page; the catalog of the project is far below it. */
const LESSON_PLAN_OPTIONS_LIMIT = 100;

export interface LessonPlanOptions {
  options: SequenceItem[];
  isPending: boolean;
  isError: boolean;
}

/**
 * The lesson plans the picker of the sequence can offer for a course: one page of `listLessonPlans`
 * by title, without the plans already in the saved sequence of the course (`excludeCourseId`) and,
 * as the API lists by default, without the archived ones (RN-27). Each one is made an item of a
 * sequence. A plan taken out of the draft is offered again by the picker from the saved sequence.
 */
export function useLessonPlanOptions(courseId: string): LessonPlanOptions {
  const query = useListLessonPlans({
    excludeCourseId: courseId,
    limit: LESSON_PLAN_OPTIONS_LIMIT,
    sort: LessonPlanListSort.title,
  });

  const options: SequenceItem[] = (query.data?.data ?? []).map((plan) => ({
    lessonPlanId: plan.id,
    title: plan.title,
    contents: plan.contents,
    expectedDurationMinutes: plan.expectedDurationMinutes,
    materialUrl: plan.materialUrl,
    courseCount: plan.courseCount,
    archivedAt: plan.archivedAt,
  }));

  return { options, isPending: query.isPending, isError: query.isError };
}
