import { useGetClassesSummaryByCourse } from "@api/generated/classes/classes";

/**
 * How many classes (not archived) each course of a page has, for the column Turmas of the list of
 * courses (GUS-131): ONE call to `getClassesSummaryByCourse` for the whole page, never one per row.
 * The map is empty while it loads or when it fails, and the cell shows a dash then.
 */
export function useCourseClassCounts(courseIds: readonly string[]): Map<string, number> {
  const query = useGetClassesSummaryByCourse(
    { courseIds: courseIds.join(",") },
    { query: { enabled: courseIds.length > 0 } },
  );

  return new Map((query.data ?? []).map((summary) => [summary.courseId, summary.total]));
}
