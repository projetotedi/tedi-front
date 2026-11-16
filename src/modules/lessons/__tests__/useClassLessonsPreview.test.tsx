import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Weekday, type GenerateClassLessonsDto } from "@api/generated/model";

import { PREVIEW_DEBOUNCE_MS, useClassLessonsPreview } from "../hooks/useClassLessonsPreview";
import {
  CLASS_ID,
  FIGMA_BODY,
  LESSONS_ALREADY_GENERATED_ERROR,
  previewClassLessonsHandler,
  type ClassBodyCall,
} from "./generate-handlers";
import { createDeferred, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

// The fake clock still follows the real one (`shouldAdvanceTime`), so the requests of MSW and the
// `waitFor` of Testing Library keep moving; the pause of the debounce is skipped by advancing it.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

const TUESDAYS: GenerateClassLessonsDto = FIGMA_BODY;
const WEDNESDAYS: GenerateClassLessonsDto = { ...FIGMA_BODY, weekday: Weekday.wednesday };

function renderPreview(initialBody: GenerateClassLessonsDto | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    queryClient,
    ...renderHook(
      ({ body }: { body: GenerateClassLessonsDto | null }) =>
        useClassLessonsPreview(CLASS_ID, body),
      { initialProps: { body: initialBody }, wrapper },
    ),
  };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("useClassLessonsPreview", () => {
  describe("asking", () => {
    it("asks nothing while a field is missing or invalid (no body)", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));

      const { result } = renderPreview(null);
      await advance(PREVIEW_DEBOUNCE_MS + 100);

      expect(onCall).not.toHaveBeenCalled();
      expect(result.current.query.fetchStatus).toBe("idle");
      expect(result.current.query.data).toBeUndefined();
      expect(result.current.previewedBody).toBeNull();
      expect(result.current.isCurrent).toBe(false);
    });

    it("asks nothing more when the body goes back to null after a preview, and keeps that preview", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      const { result, rerender } = renderPreview(TUESDAYS);
      await waitFor(() => expect(result.current.isCurrent).toBe(true));

      rerender({ body: null });
      await advance(PREVIEW_DEBOUNCE_MS + 100);

      expect(onCall).toHaveBeenCalledTimes(1);
      expect(result.current.query.fetchStatus).toBe("idle");
      // What was shown stays on the screen, but it is no longer the preview of the fields.
      expect(result.current.query.data).toBeDefined();
      expect(result.current.isCurrent).toBe(false);
    });

    it("asks once after the pause, not on every key, and with the last body", async () => {
      const onCall = vi.fn<(call: ClassBodyCall) => void>();
      server.use(previewClassLessonsHandler({ onCall }));
      const { result, rerender } = renderPreview(null);
      const typed = ["09:00", "09:30", "10:00"].map((startTime) => ({ ...FIGMA_BODY, startTime }));

      rerender({ body: typed[0] });
      await advance(100);
      rerender({ body: typed[1] });
      await advance(100);
      rerender({ body: typed[2] });
      await advance(200);
      // 200 ms after the last key: still inside the pause.
      expect(onCall).not.toHaveBeenCalled();

      await advance(PREVIEW_DEBOUNCE_MS);
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      expect(onCall).toHaveBeenCalledTimes(1);
      expect(onCall).toHaveBeenCalledWith({ id: CLASS_ID, body: typed[2] });
    });

    it("asks at once for the body it starts with: the pause is for changes, not for the first look", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));

      const { result } = renderPreview(TUESDAYS);

      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("does not ask again for an equal body made anew on every render, nor render forever", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      let renders = 0;
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      const { result } = renderHook(
        () => {
          renders += 1;
          // A new object each time, with the same content.
          return useClassLessonsPreview(CLASS_ID, { ...FIGMA_BODY });
        },
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        },
      );
      await waitFor(() => expect(result.current.isCurrent).toBe(true));
      // The pause that started on mount ends once, with the value it already had.
      await advance(PREVIEW_DEBOUNCE_MS + 100);

      const settled = renders;
      await advance(PREVIEW_DEBOUNCE_MS * 5);

      // A body that restarted the pause on every render would render again each 400 ms.
      expect(renders).toBe(settled);
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("asks the class it was given, in the path", async () => {
      const onCall = vi.fn<(call: ClassBodyCall) => void>();
      server.use(previewClassLessonsHandler({ onCall }));

      const { result } = renderPreview(TUESDAYS);
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      expect(onCall.mock.calls[0][0].id).toBe(CLASS_ID);
    });
  });

  describe("what is on the screen", () => {
    it("is current once the answer for the body of the fields is in", async () => {
      server.use(previewClassLessonsHandler());

      const { result } = renderPreview(TUESDAYS);
      expect(result.current.isCurrent).toBe(false);

      await waitFor(() => expect(result.current.isCurrent).toBe(true));
      expect(result.current.previewedBody).toEqual(TUESDAYS);
      expect(result.current.query.data?.weekday).toBe("tuesday");
    });

    it("keeps the last preview while the next one is on its way", async () => {
      server.use(previewClassLessonsHandler());
      const { result, rerender } = renderPreview(TUESDAYS);
      await waitFor(() => expect(result.current.isCurrent).toBe(true));
      const first = result.current.query.data;

      const deferred = createDeferred();
      server.use(previewClassLessonsHandler({ delay: deferred.promise }));
      rerender({ body: WEDNESDAYS });
      await advance(PREVIEW_DEBOUNCE_MS + 50);
      await waitFor(() => expect(result.current.query.isFetching).toBe(true));

      // The list does not go empty, but it is the one of Tuesdays, and says so.
      expect(result.current.query.data).toBe(first);
      expect(result.current.query.isPlaceholderData).toBe(true);
      expect(result.current.previewedBody).toEqual(TUESDAYS);
      expect(result.current.isCurrent).toBe(false);

      deferred.resolve();
      await waitFor(() => expect(result.current.isCurrent).toBe(true));
      expect(result.current.query.data?.weekday).toBe("wednesday");
      expect(result.current.previewedBody).toEqual(WEDNESDAYS);
    });

    it("is not current while waiting for the pause, before anything is asked", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      const { result, rerender } = renderPreview(TUESDAYS);
      await waitFor(() => expect(result.current.isCurrent).toBe(true));

      rerender({ body: WEDNESDAYS });

      expect(result.current.isCurrent).toBe(false);
      expect(result.current.query.isFetching).toBe(false);
      expect(onCall).toHaveBeenCalledTimes(1);

      await advance(PREVIEW_DEBOUNCE_MS + 50);
      await waitFor(() => expect(result.current.isCurrent).toBe(true));
      expect(onCall).toHaveBeenCalledTimes(2);
    });

    it("is current again at once when the fields go back to the body on the screen, with no new request", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      const { result, rerender } = renderPreview(TUESDAYS);
      await waitFor(() => expect(result.current.isCurrent).toBe(true));

      rerender({ body: WEDNESDAYS });
      expect(result.current.isCurrent).toBe(false);
      await advance(100);
      rerender({ body: TUESDAYS });

      expect(result.current.isCurrent).toBe(true);
      await advance(PREVIEW_DEBOUNCE_MS + 100);
      expect(onCall).toHaveBeenCalledTimes(1);
      expect(result.current.isCurrent).toBe(true);
    });

    it("keeps the body of the preview on the screen when the next one fails", async () => {
      server.use(previewClassLessonsHandler());
      const { result, rerender } = renderPreview(TUESDAYS);
      await waitFor(() => expect(result.current.isCurrent).toBe(true));

      server.use(previewClassLessonsHandler({ error: LESSONS_ALREADY_GENERATED_ERROR }));
      rerender({ body: WEDNESDAYS });
      await advance(PREVIEW_DEBOUNCE_MS + 50);
      await waitFor(() => expect(result.current.query.isError).toBe(true));

      expect(result.current.isCurrent).toBe(false);
      expect(result.current.previewedBody).toEqual(TUESDAYS);
    });
  });

  describe("failing", () => {
    it("shows the error of a rule of the system, as the API sent it, and does not try again", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ error: LESSONS_ALREADY_GENERATED_ERROR, onCall }));

      const { result } = renderPreview(TUESDAYS);
      await waitFor(() => expect(result.current.query.isError).toBe(true));
      await advance(PREVIEW_DEBOUNCE_MS * 3);

      expect(result.current.query.error).toMatchObject({
        statusCode: 409,
        error: "LESSONS_ALREADY_GENERATED",
      });
      expect(onCall).toHaveBeenCalledTimes(1);
      expect(result.current.isCurrent).toBe(false);
      expect(result.current.previewedBody).toBeNull();
    });

    it("asks again for the same body when told to refetch", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ networkError: true, onCall }));
      const { result } = renderPreview(TUESDAYS);
      await waitFor(() => expect(result.current.query.isError).toBe(true));

      server.use(previewClassLessonsHandler({ onCall }));
      await act(async () => {
        await result.current.query.refetch();
      });

      await waitFor(() => expect(result.current.isCurrent).toBe(true));
      expect(onCall).toHaveBeenCalledTimes(2);
    });
  });
});
