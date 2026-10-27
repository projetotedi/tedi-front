import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { getGetLessonPlanUsageQueryKey } from "@api/generated/catalog/catalog";

import { fetchLessonPlanUsage } from "../lib/lesson-plan-queries";
import {
  buildLessonPlanUsage,
  getLessonPlanUsageHandler,
  LESSON_PLAN_ID,
  NOT_FOUND_ERROR,
} from "./handlers";
import { server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Like the QueryClient of the app, which retries a query that failed with a 5xx or a network error. */
function createRetryingQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: 0 } } });
}

describe("fetchLessonPlanUsage", () => {
  it("asks the usage of the plan with the new duration in the query string", async () => {
    const onCall = vi.fn();
    const usage = buildLessonPlanUsage({ newDurationMinutes: 150 });
    server.use(getLessonPlanUsageHandler({ response: usage, onCall }));

    const result = await fetchLessonPlanUsage(createQueryClient(), LESSON_PLAN_ID, 150);

    expect(result).toEqual(usage);
    expect(onCall).toHaveBeenCalledWith({ id: LESSON_PLAN_ID, expectedDurationMinutes: 150 });
  });

  it("never reuses an answer that is already in the cache", async () => {
    const onCall = vi.fn();
    server.use(getLessonPlanUsageHandler({ onCall }));
    const queryClient = createQueryClient();
    const key = getGetLessonPlanUsageQueryKey(LESSON_PLAN_ID, { expectedDurationMinutes: 120 });
    queryClient.setQueryData(key, buildLessonPlanUsage({ courses: [] }));

    const result = await fetchLessonPlanUsage(queryClient, LESSON_PLAN_ID, 120);

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(result.courses).toHaveLength(2);
  });

  it("rejects with the error of the API", async () => {
    server.use(getLessonPlanUsageHandler({ error: NOT_FOUND_ERROR }));

    await expect(
      fetchLessonPlanUsage(createQueryClient(), LESSON_PLAN_ID, 120),
    ).rejects.toMatchObject({ statusCode: 404, error: "LESSON_PLAN_NOT_FOUND" });
  });

  it("does not retry a failure, even when the QueryClient is set to retry queries", async () => {
    const onCall = vi.fn();
    server.use(
      getLessonPlanUsageHandler({
        error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" },
        onCall,
      }),
    );

    await expect(
      fetchLessonPlanUsage(createRetryingQueryClient(), LESSON_PLAN_ID, 120),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(onCall).toHaveBeenCalledTimes(1);
  });
});
