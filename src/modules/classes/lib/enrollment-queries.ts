import type { QueryClient } from "@tanstack/react-query";

const PREFIXES = ["/classes", "/courses/", "/students", "/enrollments"] as const;

function isEnrollmentKey(queryKey: readonly unknown[]): boolean {
  const [key] = queryKey;
  return typeof key === "string" && PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * What the app has to read again after students are enrolled, an enrollment changes status or is
 * removed: the class (its seats and the card "Alunos matriculados"), the lists of classes and of
 * the classes of a course (their counts), the students available and enrolled, the enrollments of
 * each student and the list of students by enrollment.
 */
export async function invalidateAfterEnrollmentChanged(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ predicate: ({ queryKey }) => isEnrollmentKey(queryKey) });
}
