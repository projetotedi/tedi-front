import { http, HttpResponse } from "msw";

import {
  AssignmentRole,
  AssignmentSource,
  AssignmentStatus,
  ClassStatus,
  CourseCategory,
  CourseStatus,
  LessonStatus,
  MemberRegistrationStatus,
  MemberStatus,
  type ApiFieldErrorDto,
  type ClassDetailDto,
  type CreateAssignmentDto,
  type LessonAssignmentResponseDto,
  type LessonCoverageDto,
  type LessonListItemResponseDto,
  type LessonResponseDto,
  type ListLessons200,
  type ListMembers200,
  type MemberAssignmentResponseDto,
  type MemberListItemResponseDto,
  type MeResponseDto,
  type PermissionsDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

/*
 * Fixtures and MSW handlers of the screens of the allocation, from the Figma: the member "Beatriz
 * Nunes", the class "Informática Básica — A" and the lesson "10/03 · Senhas e privacidade". The ids
 * are UUIDs of the shape the generated schema accepts (version 7, variant 8). The module does not
 * import the `__tests__` of another one, so the session and the builders of the lessons and of the
 * class are written here, with only what these screens read.
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

function permissionsWith(granted: Partial<PermissionsDto>): PermissionsDto {
  return granted as PermissionsDto;
}

// The matrix of the back (docs/PERMISSIONS.md), only the permissions these screens read: everybody
// sees the lessons and the classes, and only the director and the coordination assign (and so list
// the members). The director reads the assignments of the members of her department, the
// coordination of every one, and the member of none.
const MEMBER_PERMISSIONS = permissionsWith({
  "assignments.create": "none",
  "members.list": "none",
  "members.view": "none",
  "lessons.view": "all",
  "classes.view": "all",
});

const DIRECTOR_PERMISSIONS = permissionsWith({
  "assignments.create": "all",
  "members.list": "all",
  "members.view": "department",
  "lessons.view": "all",
  "classes.view": "all",
});

const COORDINATOR_PERMISSIONS = permissionsWith({
  ...DIRECTOR_PERMISSIONS,
  "members.view": "all",
});

const PERMISSIONS_BY_ROLE: Record<Role, PermissionsDto> = {
  [Role.member]: MEMBER_PERMISSIONS,
  [Role.director]: DIRECTOR_PERMISSIONS,
  [Role.coordinator]: COORDINATOR_PERMISSIONS,
  [Role.superadmin]: COORDINATOR_PERMISSIONS,
};

export function buildMeUser(role: Role = Role.coordinator): MeResponseDto {
  return {
    id: USER_ID,
    name: "Ana Coordenadora",
    ra: null,
    email: null,
    role,
    permissions: PERMISSIONS_BY_ROLE[role],
  };
}

/** The same user with some permissions replaced: the way to ask for one the matrix does not give her. */
export function buildMeUserWith(
  permissions: Partial<PermissionsDto>,
  role: Role = Role.coordinator,
): MeResponseDto {
  const user = buildMeUser(role);
  return { ...user, permissions: { ...user.permissions, ...permissions } };
}

interface MeHandlerOptions {
  user?: MeResponseDto | null;
}

export function meHandler({ user = buildMeUser() }: MeHandlerOptions = {}) {
  return http.get("*/auth/me", () => {
    if (!user) {
      return HttpResponse.json({ statusCode: 401, message: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(user);
  });
}

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

/** The answer of `GET /lessons`: `total` can be more than the items of the page. */
export function buildLessonsPage(
  items: LessonListItemResponseDto[] = [],
  total: number = items.length,
  limit = 100,
): ListLessons200 {
  return { data: items, total, page: 1, limit };
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

/** The answer of `GET /members`. */
export function buildMembersPage(
  items: MemberListItemResponseDto[] = [buildMemberListItem()],
  total: number = items.length,
  limit = 100,
): ListMembers200 {
  return { data: items, total, page: 1, limit };
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

interface CoverageOptions {
  /** Teachers confirmed: 0 or 1. */
  teacher?: number;
  /** Monitors confirmed. */
  monitors?: number;
  /** What the lesson expects, `null` when it does not say. Two by default, as the Figma does. */
  expectedMonitors?: number | null;
}

/** The coverage the API counts over the confirmed assignments: one teacher expected, and the monitors. */
export function buildCoverage({
  teacher = 0,
  monitors = 0,
  expectedMonitors = 2,
}: CoverageOptions = {}): LessonCoverageDto {
  return {
    teacher: { confirmed: teacher, expected: 1 },
    monitors: { confirmed: monitors, expected: expectedMonitors },
  };
}

/**
 * Response of `GET /lessons/:id`: "Senhas e privacidade", planned for 2026-03-10 in the class
 * "Informática Básica — A", with no one confirmed yet and two monitors expected, so below the
 * expected. `belowExpectedMonitors` follows the coverage, as the API derives it, unless an override
 * says otherwise.
 */
export function buildLesson(overrides: Partial<LessonResponseDto> = {}): LessonResponseDto {
  const coverage = overrides.coverage ?? buildCoverage();
  const { expected, confirmed } = coverage.monitors;

  return {
    id: LESSON_ID,
    title: LESSON_TITLE,
    belowExpectedMonitors: expected !== null && confirmed < expected,
    coverage,
    objective: "Criar senhas fortes e proteger os dados.",
    date: "2026-03-10",
    startTime: "09:00",
    endTime: "11:00",
    durationMinutes: 120,
    location: "Laboratório 2 — Bloco B",
    status: LessonStatus.planned,
    expectedStudents: 12,
    expectedMonitors: expected,
    subject: null,
    postNotes: null,
    originalDate: null,
    rescheduleReason: null,
    rescheduleNote: null,
    cancelReason: null,
    cancelledAt: null,
    cancelledById: null,
    sequenceOrder: 2,
    lessonPlan: null,
    class: {
      id: CLASS_ID,
      code: "INFO-A",
      name: CLASS_NAME,
      archivedAt: null,
      startDate: "2026-03-02",
      endDate: "2026-06-30",
    },
    course: { id: COURSE_ID, name: "Informática Básica" },
    edition: { id: EDITION_ID, name: "2026.1" },
    createdById: USER_ID,
    createdAt: "2026-02-12T12:00:00.000Z",
    updatedAt: "2026-02-12T12:00:00.000Z",
    ...overrides,
  };
}

/**
 * Response of `GET /classes/:id`: "Informática Básica — A" with 8 of 15 seats taken ("8 alunos
 * matriculados" of the Figma). It is the only thing the card of the coverage reads (`summary`), so
 * the rest is the minimum the type asks for.
 */
export function buildClassDetail(overrides: Partial<ClassDetailDto> = {}): ClassDetailDto {
  return {
    id: CLASS_ID,
    code: "INFO-A",
    name: CLASS_NAME,
    edition: { id: EDITION_ID, name: "2026.1" },
    startDate: "2026-03-02",
    endDate: "2026-06-30",
    location: "Laboratório 2 — Bloco B",
    capacity: 15,
    status: ClassStatus.in_progress,
    archivedAt: null,
    createdAt: "2026-02-12T12:00:00.000Z",
    createdBy: null,
    course: {
      id: COURSE_ID,
      name: "Informática Básica",
      category: CourseCategory.basic,
      status: CourseStatus.active,
      lessonPlanCount: 6,
      plannedWorkloadMinutes: 540,
    },
    summary: {
      enrolledCount: 8,
      capacity: 15,
      occupancyRate: 0.53,
      lessonsDone: null,
      lessonsTotal: null,
      averageAttendance: null,
    },
    enrollmentsPreview: [],
    enrollmentsTotal: 8,
    ...overrides,
  };
}

export interface ApiErrorOptions {
  statusCode: number;
  error: string;
  message?: string;
  details?: ApiFieldErrorDto[];
}

export const VALIDATION_ERROR = (details: ApiFieldErrorDto[]): ApiErrorOptions => ({
  statusCode: 400,
  error: "VALIDATION_FAILED",
  message: "Bad request.",
  details,
});

export const MEMBER_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 400,
  error: "MEMBER_NOT_FOUND",
  message: "The member does not exist.",
};

export const DUPLICATE_ROLE_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "DUPLICATE_ROLE_IN_LESSON",
  message: "The member already has a place in the lesson.",
};

export const TEACHER_TAKEN_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "LESSON_TEACHER_TAKEN",
  message: "The lesson already has a confirmed teacher.",
};

export const LESSON_CANCELLED_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "LESSON_CANCELLED",
  message: "A cancelled lesson takes no assignments.",
};

export const MEMBER_INACTIVE_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "MEMBER_INACTIVE",
  message: "The member is not active.",
};

export const LESSON_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "LESSON_NOT_FOUND",
  message: "Lesson not found.",
};

export const ASSIGNMENT_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "ASSIGNMENT_NOT_FOUND",
  message: "Assignment not found.",
};

export const ASSIGNMENT_NOT_ACTIVE_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "ASSIGNMENT_NOT_ACTIVE",
  message: "The assignment is not active.",
};

export const FORBIDDEN_SCOPE_ERROR: ApiErrorOptions = {
  statusCode: 403,
  error: "FORBIDDEN_SCOPE",
  message: "Outside the department of the director.",
};

export const SERVER_ERROR: ApiErrorOptions = {
  statusCode: 500,
  error: "INTERNAL_SERVER_ERROR",
};

function apiErrorResponse({ statusCode, error, message, details }: ApiErrorOptions) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error, ...(details ? { details } : {}) },
    { status: statusCode },
  );
}

interface HandlerOptions<TCall, TResponse> {
  /** The answer, or a function of the call, for a test whose answer follows what it was asked. */
  response?: TResponse | ((call: TCall) => TResponse);
  error?: ApiErrorOptions;
  networkError?: boolean;
  /** Holds the answer until the test resolves it, to look at the loading state. */
  delay?: Promise<void>;
  onCall?: (call: TCall) => void;
}

function resolveResponse<TCall, TResponse>(
  response: TResponse | ((call: TCall) => TResponse),
  call: TCall,
): TResponse {
  return typeof response === "function" ? (response as (call: TCall) => TResponse)(call) : response;
}

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export interface IdCall {
  id: string;
}

export interface CreateAssignmentCall {
  /** The id of the lesson, from the URL. */
  id: string;
  body: CreateAssignmentDto;
}

/** `POST /lessons/:id/assignments`: 201 with the assignment created. */
export function createAssignmentHandler({
  response = buildLessonAssignment(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<CreateAssignmentCall, LessonAssignmentResponseDto> = {}) {
  return http.post("*/lessons/:id/assignments", async ({ request, params }) => {
    const call: CreateAssignmentCall = {
      id: String(params.id),
      body: (await request.json()) as CreateAssignmentDto,
    };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call), { status: 201 });
  });
}

/** `GET /lessons/:id/assignments`: nobody is assigned by default. */
export function listLessonAssignmentsHandler({
  response = [],
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall, LessonAssignmentResponseDto[]> = {}) {
  return http.get("*/lessons/:id/assignments", async ({ params }) => {
    const call: IdCall = { id: String(params.id) };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call));
  });
}

/** `GET /members/:id/assignments`: the teacher of "Senhas e privacidade" by default. */
export function listMemberAssignmentsHandler({
  response = [buildMemberAssignment()],
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall, MemberAssignmentResponseDto[]> = {}) {
  return http.get("*/members/:id/assignments", async ({ params }) => {
    const call: IdCall = { id: String(params.id) };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call));
  });
}

/** `PATCH /assignments/:id/cancel`: the assignment, cancelled. */
export function cancelAssignmentHandler({
  response = buildLessonAssignment({
    status: AssignmentStatus.cancelled,
    cancelledAt: "2026-03-05T12:00:00.000Z",
    cancelledById: USER_ID,
  }),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall, LessonAssignmentResponseDto> = {}) {
  return http.patch("*/assignments/:id/cancel", async ({ params }) => {
    const call: IdCall = { id: String(params.id) };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call));
  });
}

/** `GET /lessons/:id`. */
export function getLessonHandler({
  response = buildLesson(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall, LessonResponseDto> = {}) {
  return http.get("*/lessons/:id", async ({ params }) => {
    const call: IdCall = { id: String(params.id) };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call));
  });
}

/** `GET /classes/:id`. */
export function getClassHandler({
  response = buildClassDetail(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall, ClassDetailDto> = {}) {
  return http.get("*/classes/:id", async ({ params }) => {
    const call: IdCall = { id: String(params.id) };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call));
  });
}

export interface ListMembersCall {
  /** `null` when the request does not send the parameter. */
  status: string | null;
  enabled: string | null;
  limit: number | null;
}

/** `GET /members`: "Beatriz Nunes" by default. */
export function listMembersHandler({
  response = buildMembersPage(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ListMembersCall, ListMembers200> = {}) {
  return http.get("*/members", async ({ request }) => {
    const query = new URL(request.url).searchParams;
    const call: ListMembersCall = {
      status: query.get("status"),
      enabled: query.get("enabled"),
      limit: numberOrNull(query.get("limit")),
    };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call));
  });
}

export interface ListLessonsCall {
  /** `null` when the request does not send the parameter. */
  classId: string | null;
  from: string | null;
  limit: number | null;
}

/**
 * `GET /lessons`. The form asks it twice, for the classes (`from` today, with no `classId`) and for
 * the lessons of a class (`classId`), so a test that needs different answers gives `response` as a
 * function of the call.
 */
export function listLessonsHandler({
  response = buildLessonsPage([buildLessonListItem()]),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ListLessonsCall, ListLessons200> = {}) {
  return http.get("*/lessons", async ({ request }) => {
    const query = new URL(request.url).searchParams;
    const call: ListLessonsCall = {
      classId: query.get("classId"),
      from: query.get("from"),
      limit: numberOrNull(query.get("limit")),
    };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call));
  });
}
