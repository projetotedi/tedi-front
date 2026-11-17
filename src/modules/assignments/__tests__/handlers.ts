import {
  AssignmentRole,
  AssignmentSource,
  AssignmentStatus,
  LessonStatus,
  MemberRegistrationStatus,
  MemberStatus,
  type LessonAssignmentResponseDto,
  type LessonListItemResponseDto,
  type MemberAssignmentResponseDto,
  type MemberListItemResponseDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

/*
 * Fixtures of the screens of the allocation, from the Figma: the member "Beatriz Nunes", the class
 * "Informática Básica — A" and the lesson "10/03 · Senhas e privacidade". The ids are UUIDs of the
 * shape the generated schema accepts (version 7, variant 8).
 */
export const LESSON_ID = "01952ef7-0000-7000-8000-0000000000f1";
export const OTHER_LESSON_ID = "01952ef7-0000-7000-8000-0000000000f2";
export const THIRD_LESSON_ID = "01952ef7-0000-7000-8000-0000000000f3";
export const CLASS_ID = "01952ef7-0000-7000-8000-0000000000d1";
export const OTHER_CLASS_ID = "01952ef7-0000-7000-8000-0000000000d2";
export const COURSE_ID = "01952ef7-0000-7000-8000-0000000000c1";
export const EDITION_ID = "01952ef7-0000-7000-8000-0000000000e1";
export const MEMBER_ID = "01952ef7-0000-7000-8000-0000000000b1";
export const OTHER_MEMBER_ID = "01952ef7-0000-7000-8000-0000000000b2";
export const THIRD_MEMBER_ID = "01952ef7-0000-7000-8000-0000000000b3";
export const ASSIGNMENT_ID = "01952ef7-0000-7000-8000-0000000000a1";
export const OTHER_ASSIGNMENT_ID = "01952ef7-0000-7000-8000-0000000000a2";
export const USER_ID = "01952ef7-0000-7000-8000-000000000001";

export const MEMBER_NAME = "Beatriz Nunes";
export const CLASS_NAME = "Informática Básica — A";
export const OTHER_CLASS_NAME = "Redes Sociais — C";
export const LESSON_TITLE = "Senhas e privacidade";
/** How the Figma writes the lesson in the select of the form: the day and the month, a dot and the title. */
export const LESSON_OPTION = "10/03 · Senhas e privacidade";

/** An item of `GET /lessons`: "Senhas e privacidade", planned for 2026-03-10, with no teacher. */
export function buildLessonListItem(
  overrides: Partial<LessonListItemResponseDto> = {},
): LessonListItemResponseDto {
  return {
    id: LESSON_ID,
    title: LESSON_TITLE,
    date: "2026-03-10",
    startTime: "09:00",
    endTime: "11:00",
    status: LessonStatus.planned,
    teacher: null,
    belowExpectedMonitors: false,
    class: { id: CLASS_ID, code: "INFO-A", name: CLASS_NAME, colorIndex: 0 },
    ...overrides,
  };
}

/**
 * An item of `GET /members`: "Beatriz Nunes", an active member with access and an approved
 * registration, who can be assigned. Overrides win over any default.
 */
export function buildMemberListItem(
  overrides: Partial<MemberListItemResponseDto> = {},
): MemberListItemResponseDto {
  return {
    id: MEMBER_ID,
    name: MEMBER_NAME,
    ra: "202400003",
    role: Role.member,
    department: null,
    mainFunction: null,
    joinedAt: null,
    exitDate: null,
    exitReason: null,
    status: MemberStatus.active,
    accessEnabled: true,
    registrationStatus: MemberRegistrationStatus.approved,
    ...overrides,
  };
}

/**
 * An item of `GET /lessons/:id/assignments`: "Beatriz Nunes" confirmed as the teacher of the lesson,
 * made by a coordinator. Overrides win over any default.
 */
export function buildLessonAssignment(
  overrides: Partial<LessonAssignmentResponseDto> = {},
): LessonAssignmentResponseDto {
  return {
    id: ASSIGNMENT_ID,
    lessonId: LESSON_ID,
    person: { id: MEMBER_ID, name: MEMBER_NAME },
    role: AssignmentRole.teacher,
    status: AssignmentStatus.confirmed,
    source: AssignmentSource.direct,
    note: null,
    createdById: USER_ID,
    createdAt: "2026-03-01T12:00:00.000Z",
    updatedAt: "2026-03-01T12:00:00.000Z",
    reviewedById: USER_ID,
    reviewedAt: "2026-03-01T12:00:00.000Z",
    cancelledById: null,
    cancelledAt: null,
    ...overrides,
  };
}

/**
 * An item of `GET /members/:id/assignments`: the teacher of "Senhas e privacidade" on 2026-03-10,
 * confirmed. The lesson is a part of it, so an override of `lesson` replaces the whole reference.
 */
export function buildMemberAssignment(
  overrides: Partial<MemberAssignmentResponseDto> = {},
): MemberAssignmentResponseDto {
  return {
    id: ASSIGNMENT_ID,
    lesson: {
      id: LESSON_ID,
      title: LESSON_TITLE,
      date: "2026-03-10",
      startTime: "09:00",
      endTime: "11:00",
      status: LessonStatus.planned,
    },
    role: AssignmentRole.teacher,
    status: AssignmentStatus.confirmed,
    source: AssignmentSource.direct,
    createdAt: "2026-03-01T12:00:00.000Z",
    ...overrides,
  };
}
