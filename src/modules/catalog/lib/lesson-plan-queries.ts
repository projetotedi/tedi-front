import type { QueryClient } from "@tanstack/react-query";

import {
  getCreateLessonPlanUrl,
  getGetLessonPlanUsageQueryKey,
  getLessonPlanUsage,
} from "@api/generated/catalog/catalog";
import type { GetLessonPlanUsageParams, LessonPlanUsageResponseDto } from "@api/generated/model";

export function invalidateLessonPlans(queryClient: QueryClient): Promise<void> {
  const basePath = getCreateLessonPlanUrl();

  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      const [key] = queryKey;
      return typeof key === "string" && key.startsWith(basePath);
    },
  });
}

/**
 * Asks the API what changing the duration of a plan does to the courses that use it (RF-017).
 * It is a request made on demand, when the person saves: a query hook would fire on mount, and the
 * simulation only makes sense for the duration that was just typed. `staleTime: 0` makes sure a
 * cached answer is never reused, since the sequence of the courses may have changed meanwhile.
 * `retry: false` because it is a step of the save, and the save is never retried by itself either:
 * the dialog stays locked while it runs, so a failure has to reach the person at once.
 */
export function fetchLessonPlanUsage(
  queryClient: QueryClient,
  lessonPlanId: string,
  expectedDurationMinutes: number,
): Promise<LessonPlanUsageResponseDto> {
  const params: GetLessonPlanUsageParams = { expectedDurationMinutes };

  return queryClient.fetchQuery({
    queryKey: getGetLessonPlanUsageQueryKey(lessonPlanId, params),
    queryFn: ({ signal }) => getLessonPlanUsage(lessonPlanId, params, { signal }),
    staleTime: 0,
    retry: false,
  });
}
