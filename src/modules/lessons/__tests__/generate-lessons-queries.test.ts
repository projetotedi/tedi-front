import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { getGetClassQueryKey } from "@api/generated/classes/classes";
import {
  getListLessonsCalendarQueryKey,
  getListLessonsQueryKey,
  getPreviewClassLessonsUrl,
} from "@api/generated/lessons/lessons";

import { invalidateAfterLessonsGenerated } from "../lib/lesson-queries";
import { buildLessonsPage, buildPreview, CLASS_ID, FIGMA_BODY } from "./generate-handlers";

const OTHER_CLASS_ID = "01952ef7-0000-7000-8000-0000000000d2";

let queryClient: QueryClient;

const isInvalidated = (queryKey: readonly unknown[]) =>
  queryClient.getQueryState(queryKey)?.isInvalidated;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("invalidateAfterLessonsGenerated", () => {
  it("invalidates the detail of the class, whose count of lessons changes", async () => {
    queryClient.setQueryData(getGetClassQueryKey(CLASS_ID), { id: CLASS_ID });

    await invalidateAfterLessonsGenerated(queryClient, CLASS_ID);

    expect(isInvalidated(getGetClassQueryKey(CLASS_ID))).toBe(true);
  });

  it("invalidates every list of lessons, whatever the filters it was asked with", async () => {
    const ofTheClass = getListLessonsQueryKey({ classId: CLASS_ID, limit: 5 });
    const ofAnother = getListLessonsQueryKey({ classId: OTHER_CLASS_ID });
    const unfiltered = getListLessonsQueryKey();
    for (const key of [ofTheClass, ofAnother, unfiltered]) {
      queryClient.setQueryData(key, buildLessonsPage());
    }

    await invalidateAfterLessonsGenerated(queryClient, CLASS_ID);

    expect(isInvalidated(ofTheClass)).toBe(true);
    expect(isInvalidated(ofAnother)).toBe(true);
    expect(isInvalidated(unfiltered)).toBe(true);
  });

  it("invalidates the calendar of lessons, which is not under the same key as the list", async () => {
    const calendar = getListLessonsCalendarQueryKey({ from: "2026-04-01", to: "2026-04-30" });
    queryClient.setQueryData(calendar, []);

    await invalidateAfterLessonsGenerated(queryClient, CLASS_ID);

    expect(isInvalidated(calendar)).toBe(true);
  });

  it("drops the previews of the class: they described a class with no lessons", async () => {
    const preview = [getPreviewClassLessonsUrl(CLASS_ID), FIGMA_BODY];
    queryClient.setQueryData(preview, buildPreview());

    await invalidateAfterLessonsGenerated(queryClient, CLASS_ID);

    expect(queryClient.getQueryState(preview)).toBeUndefined();
  });

  it("does not touch the detail nor the previews of another class", async () => {
    const otherDetail = getGetClassQueryKey(OTHER_CLASS_ID);
    const otherPreview = [getPreviewClassLessonsUrl(OTHER_CLASS_ID), FIGMA_BODY];
    queryClient.setQueryData(otherDetail, { id: OTHER_CLASS_ID });
    queryClient.setQueryData(otherPreview, buildPreview());

    await invalidateAfterLessonsGenerated(queryClient, CLASS_ID);

    expect(isInvalidated(otherDetail)).toBe(false);
    expect(queryClient.getQueryData(otherPreview)).toEqual(buildPreview());
    expect(isInvalidated(otherPreview)).toBe(false);
  });

  it("does not invalidate what is not about lessons, such as the session", async () => {
    queryClient.setQueryData(["/auth/me"], { id: "user" });

    await invalidateAfterLessonsGenerated(queryClient, CLASS_ID);

    expect(isInvalidated(["/auth/me"])).toBe(false);
  });
});
