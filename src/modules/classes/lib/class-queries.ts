import type { QueryClient } from "@tanstack/react-query";

import { getCreateClassUrl, getGetClassQueryKey } from "@api/generated/classes/classes";
import type { ClassDetailDto, ClassResponseDto } from "@api/generated/model";

const COURSES_PATH = "/courses/";
const CLASSES_SUFFIX = "/classes";

/**
 * `/classes` and everything under it (the list, the detail, the summary by course and the
 * enrollments) and `/courses/<id>/classes`, the card "Turmas deste curso": every key that shows a
 * class.
 */
function isClassKey(queryKey: readonly unknown[]): boolean {
  const [key] = queryKey;
  if (typeof key !== "string") return false;
  const base = getCreateClassUrl();

  return (
    key === base ||
    key.startsWith(`${base}/`) ||
    (key.startsWith(COURSES_PATH) && key.endsWith(CLASSES_SUFFIX))
  );
}

/**
 * What the app has to know after a class is created, edited, archived or reactivated (GUS-133): the
 * detail of the class takes what the API answered at once (the header and the cards change without
 * waiting), and every key that shows a class is fetched again: the list (with its filters and
 * counts), the classes of each course and the summary of the classes of a course, which the dialog
 * that archives a course reads.
 */
export async function invalidateAfterClassChanged(
  queryClient: QueryClient,
  saved?: ClassResponseDto,
): Promise<void> {
  if (saved) {
    queryClient.setQueryData<ClassDetailDto>(
      getGetClassQueryKey(saved.id),
      (detail) =>
        detail && {
          ...detail,
          code: saved.code,
          name: saved.name,
          edition: saved.edition,
          startDate: saved.startDate,
          endDate: saved.endDate,
          location: saved.location,
          capacity: saved.capacity,
          status: saved.status,
          archivedAt: saved.archivedAt,
          summary: { ...detail.summary, capacity: saved.capacity },
        },
    );
  }

  await queryClient.invalidateQueries({ predicate: ({ queryKey }) => isClassKey(queryKey) });
}
