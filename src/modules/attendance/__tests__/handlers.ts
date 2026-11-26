import { http, HttpResponse } from "msw";

import {
  AssignmentRole,
  EnrollmentStatus,
  LessonStatus,
  type LessonResponseDto,
  type MemberAttendanceResponseDto,
  type MeResponseDto,
  type PermissionsDto,
  type StudentAttendanceResponseDto,
  type StudentRollCallItemResponseDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

export const USER_ID = "01952ef7-0000-7000-8000-000000000001";
export const TEACHER_ID = "01952ef7-0000-7000-8000-0000000000b1";
export const MONITOR_ID = "01952ef7-0000-7000-8000-0000000000b2";
export const LESSON_ID = "01952ef7-0000-7000-8000-0000000000f1";
export const STUDENT_NAMES = [
  "Maria",
  "João",
  "Antônia",
  "Sebastião",
  "Terezinha",
  "Benedito",
  "Cleusa",
];

const MANAGER = {
  "attendance.takeStudents": "all",
  "attendance.confirmMember": "all",
  "attendance.correct": "all",
} as PermissionsDto;

const MEMBER = {
  "attendance.takeStudents": "allocated",
  "attendance.confirmMember": "lessonTeacher",
  "attendance.correct": "none",
} as PermissionsDto;

export function buildMeUser(role: Role = Role.coordinator, id = USER_ID): MeResponseDto {
  return {
    id,
    name: "Ana Coordenadora",
    ra: null,
    email: null,
    role,
    permissions: role === Role.member ? MEMBER : MANAGER,
    mustChangePassword: false,
  };
}

export function meHandler({ user }: { user: MeResponseDto | null }) {
  return http.get("*/auth/me", () =>
    user === null ? new HttpResponse(null, { status: 401 }) : HttpResponse.json(user),
  );
}

export function buildLesson(overrides: Partial<LessonResponseDto> = {}): LessonResponseDto {
  return {
    id: LESSON_ID,
    title: "Teclado, mouse e janelas",
    date: "2026-03-10",
    startTime: "09:00",
    endTime: "11:00",
    durationMinutes: 120,
    status: LessonStatus.done,
    class: { id: "c1", name: "Informática A", archivedAt: null },
    attendance: { pending: true, students: { signed: 1, total: 7 } },
    ...overrides,
  } as LessonResponseDto;
}

export function buildStudents(): StudentRollCallItemResponseDto[] {
  return STUDENT_NAMES.map((name, index) => ({
    enrollment: {
      id: `enrollment-${index}`,
      status: EnrollmentStatus.active,
      statusChangedAt: "2026-03-01",
    },
    student: { id: `student-${index}`, name },
    attendance: null,
  }));
}

export function buildSigned(
  overrides: Partial<StudentAttendanceResponseDto> = {},
): StudentAttendanceResponseDto {
  return {
    id: "attendance-0",
    enrollmentId: "enrollment-0",
    lessonId: LESSON_ID,
    status: "absent",
    signedBy: { id: TEACHER_ID, name: "Beatriz Nunes" },
    signedAt: "2026-03-10T14:05:00.000Z",
    justified: false,
    justification: null,
    corrections: [],
    ...overrides,
  };
}

export function buildMembers(): MemberAttendanceResponseDto[] {
  const pending = { status: null, confirmedBy: null, confirmedAt: null, hourEntryId: null };
  return [
    {
      assignmentId: "assignment-0",
      person: { id: TEACHER_ID, name: "Beatriz Nunes" },
      role: AssignmentRole.teacher,
      ...pending,
    },
    {
      assignmentId: "assignment-1",
      person: { id: MONITOR_ID, name: "Diego Almeida" },
      role: AssignmentRole.monitor,
      ...pending,
    },
  ];
}

interface Options {
  students?: StudentRollCallItemResponseDto[];
  members?: MemberAttendanceResponseDto[];
}

/** A small API that keeps what it was told, and the bodies it received. */
export function attendanceApi({
  students = buildStudents(),
  members = buildMembers(),
}: Options = {}) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const signed = (status: "present" | "absent") => ({
    status,
    confirmedBy: { id: USER_ID, name: "Ana Coordenadora" },
    confirmedAt: "2026-03-10T14:20:00.000Z",
  });

  async function record(request: Request) {
    const body = await request.json();
    calls.push({ method: request.method, path: new URL(request.url).pathname, body });
    return body as {
      entries: { enrollmentId?: string; assignmentId?: string; status: "present" | "absent" }[];
    };
  }

  return {
    calls,
    handlers: [
      http.get("*/lessons/:id/attendance/students", () => HttpResponse.json(students)),
      http.get("*/lessons/:id/attendance/members", () => HttpResponse.json(members)),
      http.put("*/lessons/:id/attendance/students", async ({ request }) => {
        const { entries } = await record(request);
        students = students.map((item) => {
          const entry = entries.find((sent) => sent.enrollmentId === item.enrollment.id);
          return entry
            ? { ...item, attendance: buildSigned({ status: entry.status, id: item.enrollment.id }) }
            : item;
        });
        return HttpResponse.json(students);
      }),
      http.put("*/lessons/:id/attendance/members", async ({ request }) => {
        const { entries } = await record(request);
        members = members.map((member) => {
          const entry = entries.find((sent) => sent.assignmentId === member.assignmentId);
          return entry ? { ...member, ...signed(entry.status) } : member;
        });
        return HttpResponse.json(members);
      }),
      http.patch("*/student-attendance/:id/:action", async ({ request }) => {
        await record(request);
        return HttpResponse.json(buildSigned());
      }),
    ],
  };
}
