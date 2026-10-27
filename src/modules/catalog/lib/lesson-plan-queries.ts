import type { QueryClient } from "@tanstack/react-query";

import { getCreateLessonPlanUrl } from "@api/generated/catalog/catalog";

export function invalidateLessonPlans(queryClient: QueryClient): Promise<void> {
  const basePath = getCreateLessonPlanUrl();

  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      const [key] = queryKey;
      return typeof key === "string" && key.startsWith(basePath);
    },
  });
}
