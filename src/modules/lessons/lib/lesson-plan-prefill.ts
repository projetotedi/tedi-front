import type { QueryClient } from "@tanstack/react-query";

import { getGetLessonPlanQueryKey, getLessonPlan } from "@api/generated/catalog/catalog";

/** What a lesson takes from the plan it comes from (RN-18): its title and its objective. */
export interface LessonPlanPrefill {
  title: string;
  objective: string;
}

/**
 * The title and the objective of a lesson plan, to fill a new lesson. The item of the sequence of
 * the course has the title but not the objective, so the plan is read on its own. It is a request
 * made on demand, when the person chooses a plan: a cached answer is never reused (`staleTime: 0`),
 * because the plan may have been edited since, and it is not retried (`retry: false`), because the
 * form already shows the title and keeps working while this runs, so a failure should reach the
 * person at once and not after the retries of the app. A plan without objective gives "".
 */
export async function fetchLessonPlanPrefill(
  queryClient: QueryClient,
  lessonPlanId: string,
): Promise<LessonPlanPrefill> {
  const plan = await queryClient.fetchQuery({
    queryKey: getGetLessonPlanQueryKey(lessonPlanId),
    queryFn: ({ signal }) => getLessonPlan(lessonPlanId, { signal }),
    staleTime: 0,
    retry: false,
  });

  return { title: plan.title, objective: plan.objective ?? "" };
}
