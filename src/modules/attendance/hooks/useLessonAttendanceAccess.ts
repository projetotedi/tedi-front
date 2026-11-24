import { useListMemberAttendance } from "@api/generated/attendance/attendance";
import type { LessonResponseDto, MemberAttendanceResponseDto } from "@api/generated/model";
import { useAuth, usePermissionCheck } from "@modules/auth";

import {
  canConfirmMember,
  canTakeStudents,
  isOwnRow,
  readOnlyReasonOf,
} from "../lib/attendance-access";

const NO_STAFF: MemberAttendanceResponseDto[] = [];

export function useLessonAttendanceAccess(lesson: LessonResponseDto) {
  const { user } = useAuth();
  const can = usePermissionCheck();
  const members = useListMemberAttendance(lesson.id);
  const staff = members.data ?? NO_STAFF;
  const readOnlyReason = readOnlyReasonOf(lesson);
  const isOpen = readOnlyReason === null;

  return {
    members,
    staff,
    readOnlyReason,
    canTakeStudents: isOpen && canTakeStudents(can, staff, user?.id),
    canCorrect: isOpen && can("attendance.correct", {}),
    canConfirm: (member: MemberAttendanceResponseDto) =>
      isOpen && canConfirmMember(can, member, staff, user?.id),
    isOwn: (member: MemberAttendanceResponseDto) => isOwnRow(member, user?.id),
    userName: user?.name ?? "",
  };
}
