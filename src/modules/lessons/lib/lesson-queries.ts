import type { QueryClient } from "@tanstack/react-query";

import { getGetClassQueryKey } from "@api/generated/classes/classes";
import {
  getListLessonsCalendarQueryKey,
  getListLessonsQueryKey,
  getPreviewClassLessonsUrl,
} from "@api/generated/lessons/lessons";

/**
 * What the app has to know after the lessons of a class are generated:
 *
 * - the detail of the class (`getClass`): `summary.lessonsTotal` changes from nothing to the
 *   number of lessons, and is what the card Resumo shows;
 * - every list of lessons (`listLessons`, whose key has the filters after the path, so the key
 *   without them is the prefix of all) and the calendar of lessons, so "Aulas da turma" lists the
 *   lessons and any other screen that lists them opens up to date, with no reload;
 * - the previews of the class are dropped: they described a class with no lessons, and any new one
 *   would be answered with 409 `LESSONS_ALREADY_GENERATED`.
 *
 * Importing the keys of `classes` is importing the contract, not the module: they are generated.
 */
export async function invalidateAfterLessonsGenerated(
  queryClient: QueryClient,
  classId: string,
): Promise<void> {
  queryClient.removeQueries({ queryKey: [getPreviewClassLessonsUrl(classId)] });

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetClassQueryKey(classId) }),
    queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListLessonsCalendarQueryKey() }),
  ]);
}
