import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { getGetClassQueryKey } from "@api/generated/classes/classes";
import {
  getGetLessonQueryKey,
  getListLessonsCalendarQueryKey,
  getListLessonsQueryKey,
} from "@api/generated/lessons/lessons";

import { fetchLessonPlanPrefill } from "../lib/lesson-plan-prefill";
import { applySavedLesson, invalidateLesson } from "../lib/lesson-queries";
import {
  buildLesson,
  buildLessonPlanDetail,
  buildRescheduledLesson,
  CLASS_ID,
  getLessonPlanHandler,
  LESSON_ID,
  LESSON_PLAN_ID,
  OTHER_LESSON_ID,
} from "./handlers";
import { server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Like the QueryClient of the app, which retries a query that failed with a 5xx or a network error. */
function createRetryingQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: 0 } } });
}

const isInvalidated = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated;

/** A cache with a list, the calendar, two lessons, the class and something that is not a lesson. */
function seededQueryClient() {
  const queryClient = createQueryClient();
  const keys = {
    list: [...getListLessonsQueryKey({ page: 1 })] as const,
    calendar: [
      ...getListLessonsCalendarQueryKey({ from: "2026-03-01", to: "2026-03-31" }),
    ] as const,
    lesson: getGetLessonQueryKey(LESSON_ID),
    otherLesson: getGetLessonQueryKey(OTHER_LESSON_ID),
    class: getGetClassQueryKey(CLASS_ID),
    course: ["/courses/x"] as const,
  };

  queryClient.setQueryData(keys.list, { data: [], total: 0 });
  queryClient.setQueryData(keys.calendar, []);
  queryClient.setQueryData(keys.lesson, buildLesson());
  queryClient.setQueryData(keys.otherLesson, buildLesson({ id: OTHER_LESSON_ID }));
  queryClient.setQueryData(keys.class, { id: CLASS_ID });
  queryClient.setQueryData(keys.course, { id: "x" });

  return { queryClient, keys };
}

describe("applySavedLesson", () => {
  it("writes the response into the getLesson cache, so the detail shows it with no new request", async () => {
    const { queryClient, keys } = seededQueryClient();
    const saved = buildRescheduledLesson({ date: "2026-03-17", originalDate: "2026-03-10" });

    await applySavedLesson(queryClient, saved);

    expect(queryClient.getQueryData(keys.lesson)).toEqual(saved);
    expect(isInvalidated(queryClient, keys.lesson)).toBe(false);
  });

  it("writes the detail of a lesson that was not in the cache yet (a lesson that was just created)", async () => {
    const queryClient = createQueryClient();
    const created = buildLesson();

    await applySavedLesson(queryClient, created);

    expect(queryClient.getQueryData(getGetLessonQueryKey(created.id))).toEqual(created);
  });

  it("invalidates /lessons and /lessons/calendar and the class detail, keeps other lessons", async () => {
    const { queryClient, keys } = seededQueryClient();

    await applySavedLesson(queryClient, buildLesson());

    expect(isInvalidated(queryClient, keys.list)).toBe(true);
    expect(isInvalidated(queryClient, keys.calendar)).toBe(true);
    expect(isInvalidated(queryClient, keys.class)).toBe(true);
    expect(isInvalidated(queryClient, keys.otherLesson)).toBe(false);
    expect(isInvalidated(queryClient, keys.course)).toBe(false);
  });

  it("invalidates the class the lesson belongs to, and not another one", async () => {
    const { queryClient } = seededQueryClient();
    const otherClassKey = getGetClassQueryKey("01952ef7-0000-7000-8000-0000000000d9");
    queryClient.setQueryData(otherClassKey, { id: "other" });

    await applySavedLesson(queryClient, buildLesson());

    expect(isInvalidated(queryClient, getGetClassQueryKey(CLASS_ID))).toBe(true);
    expect(isInvalidated(queryClient, otherClassKey)).toBe(false);
  });
});

describe("invalidateLesson", () => {
  it("invalidates the detail of that lesson only", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateLesson(queryClient, LESSON_ID);

    expect(isInvalidated(queryClient, keys.lesson)).toBe(true);
    expect(isInvalidated(queryClient, keys.otherLesson)).toBe(false);
    expect(isInvalidated(queryClient, keys.list)).toBe(false);
    expect(isInvalidated(queryClient, keys.class)).toBe(false);
  });
});

describe("fetchLessonPlanPrefill", () => {
  it("gives the title and the objective of the plan", async () => {
    const onCall = vi.fn();
    server.use(
      getLessonPlanHandler({
        response: buildLessonPlanDetail({
          title: "Senhas e privacidade",
          objective: "Criar senhas.",
        }),
        onCall,
      }),
    );

    const prefill = await fetchLessonPlanPrefill(createQueryClient(), LESSON_PLAN_ID);

    expect(prefill).toEqual({ title: "Senhas e privacidade", objective: "Criar senhas." });
    expect(onCall).toHaveBeenCalledWith({ id: LESSON_PLAN_ID });
  });

  it("turns a plan with no objective into an empty one", async () => {
    server.use(getLessonPlanHandler({ response: buildLessonPlanDetail({ objective: null }) }));

    const prefill = await fetchLessonPlanPrefill(createQueryClient(), LESSON_PLAN_ID);

    expect(prefill.objective).toBe("");
  });

  it("never reuses an answer that is already in the cache: the plan may have been edited", async () => {
    const onCall = vi.fn();
    server.use(
      getLessonPlanHandler({ response: buildLessonPlanDetail({ title: "Novo título" }), onCall }),
    );
    const queryClient = createQueryClient();
    queryClient.setQueryData(
      [`/lesson-plans/${LESSON_PLAN_ID}`],
      buildLessonPlanDetail({ title: "Título antigo" }),
    );

    const prefill = await fetchLessonPlanPrefill(queryClient, LESSON_PLAN_ID);

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(prefill.title).toBe("Novo título");
  });

  it("rejects with the error of the API", async () => {
    server.use(
      getLessonPlanHandler({ error: { statusCode: 404, error: "LESSON_PLAN_NOT_FOUND" } }),
    );

    await expect(fetchLessonPlanPrefill(createQueryClient(), LESSON_PLAN_ID)).rejects.toMatchObject(
      { statusCode: 404, error: "LESSON_PLAN_NOT_FOUND" },
    );
  });

  it("does not retry a failure, even when the QueryClient is set to retry queries", async () => {
    const onCall = vi.fn();
    server.use(
      getLessonPlanHandler({
        error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" },
        onCall,
      }),
    );

    await expect(
      fetchLessonPlanPrefill(createRetryingQueryClient(), LESSON_PLAN_ID),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(onCall).toHaveBeenCalledTimes(1);
  });
});
