import {
  AssignmentRole,
  LessonStatus,
  type LessonResponseDto,
  type MemberAttendanceResponseDto,
} from "@api/generated/model";
import type { Permission, PermissionTarget } from "@shared/lib/permissions";

import { projectDateOf } from "./attendance-format";

export type ReadOnlyReason = "lessonCancelled" | "classArchived" | "lessonInFuture";

type PermissionCheck = (permission: Permission, target?: PermissionTarget) => boolean;

export function readOnlyReasonOf(
  lesson: LessonResponseDto,
  now: Date = new Date(),
): ReadOnlyReason | null {
  if (lesson.status === LessonStatus.cancelled) return "lessonCancelled";
  if (lesson.class.archivedAt !== null) return "classArchived";
  return lesson.date > projectDateOf(now) ? "lessonInFuture" : null;
}

export function isOwnRow(member: MemberAttendanceResponseDto, userId: string | undefined): boolean {
  return userId !== undefined && member.person?.id === userId;
}

export function canTakeStudents(
  can: PermissionCheck,
  staff: readonly MemberAttendanceResponseDto[],
  userId: string | undefined,
): boolean {
  return can("attendance.takeStudents", {
    serverGrant: staff.some((member) => isOwnRow(member, userId)),
  });
}

export function canConfirmMember(
  can: PermissionCheck,
  member: MemberAttendanceResponseDto,
  staff: readonly MemberAttendanceResponseDto[],
  userId: string | undefined,
): boolean {
  if (member.person === null) return false;
  return can("attendance.confirmMember", {
    personId: member.person.id,
    serverGrant:
      member.role === AssignmentRole.monitor &&
      staff.some((other) => other.role === AssignmentRole.teacher && isOwnRow(other, userId)),
  });
}
