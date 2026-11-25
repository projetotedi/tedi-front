import { keepPreviousData, skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { getPreviewClassLessonsUrl, previewClassLessons } from "@api/generated/lessons/lessons";
import type {
  ApiErrorDto,
  ClassLessonsPreviewResponseDto,
  GenerateClassLessonsDto,
} from "@api/generated/model";
import { useDebounce } from "@shared/hooks/useDebounce";

/** The pause after the last change before the API is asked: the same as the search of the access screen. */
export const PREVIEW_DEBOUNCE_MS = 400;

export interface ClassLessonsPreviewState {
  query: UseQueryResult<ClassLessonsPreviewResponseDto, ApiErrorDto>;
  /** The body that the preview on the screen stands for. `null` until there has been a preview. */
  previewedBody: GenerateClassLessonsDto | null;
  /**
   * The preview on the screen is the one of the fields as they are now: nothing waits for the
   * pause, nothing is on its way and what is shown is not the one kept from before. Only then is
   * it safe to generate, because what is generated is what the person saw.
   */
  isCurrent: boolean;
}

/**
 * The preview of the dates of a class (`POST /classes/:id/lessons/preview`) as a query that follows
 * the body of the form. The Orval hook of this route is a mutation (it is a `POST`), which would
 * need an effect to fire it on every change; a query already knows how to keep the last answer,
 * drop the one that is no longer wanted and not repeat a body it has. So the generated function is
 * the `queryFn` (the precedent is `fetchLessonPlanUsage`, in `catalog`), and the HTTP client is
 * never touched.
 *
 * - `null` is a form with a field missing or invalid: nothing is asked.
 * - The body is held for `PREVIEW_DEBOUNCE_MS` after the last change, so typing is not a request
 *   per key. The debounce is over the body as a string: an object made again on every render is a
 *   new value each time, would restart the pause and render forever.
 * - The last preview stays (`keepPreviousData`) while the next one is on its way, so the list
 *   does not flash empty; `isCurrent` says it is not the current one yet.
 * - It is never "fresh" (`staleTime: 0`) and does not retry: the person changes a field or presses
 *   "Tentar de novo", and a rule of the system (409) answers the same on the second try.
 */
export function useClassLessonsPreview(
  classId: string,
  body: GenerateClassLessonsDto | null,
): ClassLessonsPreviewState {
  const bodyKey = body === null ? null : JSON.stringify(body);
  const debouncedKey = useDebounce(bodyKey, PREVIEW_DEBOUNCE_MS);
  const debouncedBody = useMemo(
    () => (debouncedKey === null ? null : (JSON.parse(debouncedKey) as GenerateClassLessonsDto)),
    [debouncedKey],
  );

  const query = useQuery<ClassLessonsPreviewResponseDto, ApiErrorDto>({
    queryKey: [getPreviewClassLessonsUrl(classId), debouncedBody],
    queryFn:
      debouncedBody === null
        ? skipToken
        : ({ signal }) => previewClassLessons(classId, debouncedBody, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  });

  // The answer that is not the one kept from before is the answer to `debouncedKey`: remember the
  // body of the last such answer. Set while rendering, which React allows for the state of the
  // component itself, so there is no frame where the answer and its body disagree.
  const [previewedKey, setPreviewedKey] = useState<string | null>(null);
  if (
    debouncedKey !== null &&
    previewedKey !== debouncedKey &&
    query.data !== undefined &&
    !query.isPlaceholderData
  ) {
    setPreviewedKey(debouncedKey);
  }
  const previewedBody = useMemo(
    () => (previewedKey === null ? null : (JSON.parse(previewedKey) as GenerateClassLessonsDto)),
    [previewedKey],
  );

  const isCurrent =
    bodyKey !== null &&
    bodyKey === debouncedKey &&
    query.isSuccess &&
    !query.isPlaceholderData &&
    !query.isFetching;

  return { query, previewedBody, isCurrent };
}
