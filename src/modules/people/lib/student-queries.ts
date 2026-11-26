import type { QueryClient } from "@tanstack/react-query";

const STUDENTS = "/students";
const STUDENTS_BY_ENROLLMENT = "/enrollments/students";
const AVAILABLE_STUDENTS = /^\/classes\/[^/]+\/available-students$/;

/**
 * Whatever shows a student: `listStudents` and `getStudent` (`/students...`), the list by enrollment
 * of the screen of students and the students available to enroll in a class (an archived one leaves
 * it). The keys of the other modules are only read here, by their URL.
 */
function showsStudents(queryKey: readonly unknown[]): boolean {
  const [key] = queryKey;
  return (
    typeof key === "string" &&
    (key === STUDENTS ||
      key.startsWith(`${STUDENTS}/`) ||
      key === STUDENTS_BY_ENROLLMENT ||
      AVAILABLE_STUDENTS.test(key))
  );
}

/** After a student is created, edited, archived or reactivated (GUS-123). */
export async function invalidateAfterStudentChanged(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ predicate: ({ queryKey }) => showsStudents(queryKey) });
}
