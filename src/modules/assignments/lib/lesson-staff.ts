import {
  AssignmentRole,
  AssignmentSource,
  AssignmentStatus,
  type LessonAssignmentResponseDto,
  type PersonRefDto,
} from "@api/generated/model";

/**
 * The teacher of a lesson: the person of the assignment that is a teacher and is confirmed (RN-02).
 * A pending teacher is a candidate, not the teacher, so she does not count. The API allows at most
 * one confirmed teacher per lesson; the person of one that was removed comes as `null`, and then
 * there is nobody to name, so the answer is `null` too.
 */
export function findConfirmedTeacher(
  assignments: readonly LessonAssignmentResponseDto[],
): PersonRefDto | null {
  const teacher = assignments.find(
    (assignment) =>
      assignment.role === AssignmentRole.teacher &&
      assignment.status === AssignmentStatus.confirmed &&
      assignment.person !== null,
  );

  return teacher?.person ?? null;
}

/**
 * The applications that wait for an answer: an assignment that a member asked for (`application`)
 * and that is still pending. A pending one that a coordinator made is not an application.
 */
export function countPendingApplications(
  assignments: readonly LessonAssignmentResponseDto[],
): number {
  return assignments.filter(
    (assignment) =>
      assignment.source === AssignmentSource.application &&
      assignment.status === AssignmentStatus.pending,
  ).length;
}

/**
 * Whether an assignment still holds its place in the lesson, and so can be cancelled: pending and
 * confirmed do, declined and cancelled are final (A5).
 */
export function isActiveAssignment(status: AssignmentStatus): boolean {
  return status === AssignmentStatus.pending || status === AssignmentStatus.confirmed;
}
