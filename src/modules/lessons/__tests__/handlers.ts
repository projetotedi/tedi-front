import { http, HttpResponse } from "msw";

import {
  LessonPlanUsageStatus,
  LessonStatus,
  type ApiFieldErrorDto,
  type CancelLessonDto,
  type CourseLessonPlanItemResponseDto,
  type CourseLessonPlansResponseDto,
  type CreateLessonDto,
  type LessonPlanDetailDto,
  type LessonResponseDto,
  type MeResponseDto,
  type PermissionsDto,
  type RescheduleLessonDto,
  type UpdateLessonDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

function permissionsWith(granted: Partial<PermissionsDto>): PermissionsDto {
  return granted as PermissionsDto;
}

// The matrix of the back (docs/PERMISSIONS.md): everybody sees the lessons, and only the director
// and the coordination manage them.
const VIEWER_PERMISSIONS = permissionsWith({
  "catalog.view": "all",
  "classes.view": "all",
  "lessons.view": "all",
  "lessons.manage": "none",
});

const MANAGER_PERMISSIONS = permissionsWith({
  "catalog.view": "all",
  "classes.view": "all",
  "lessons.view": "all",
  "lessons.manage": "all",
});

const PERMISSIONS_BY_ROLE: Record<Role, PermissionsDto> = {
  [Role.member]: VIEWER_PERMISSIONS,
  [Role.director]: MANAGER_PERMISSIONS,
  [Role.coordinator]: MANAGER_PERMISSIONS,
  [Role.superadmin]: MANAGER_PERMISSIONS,
};

export function buildMeUser(role: Role = Role.coordinator): MeResponseDto {
  return {
    id: "01952ef7-0000-7000-8000-000000000001",
    name: "Ana Coordenadora",
    ra: null,
    email: null,
    role,
    permissions: PERMISSIONS_BY_ROLE[role],
  };
}

/** The same user without `lessons.view`, the permission of the routes of the module. */
export function buildMeUserWithoutLessons(role: Role = Role.coordinator): MeResponseDto {
  const user = buildMeUser(role);
  return { ...user, permissions: { ...user.permissions, "lessons.view": "none" } };
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

export const LESSON_ID = "01952ef7-0000-7000-8000-0000000000f1";
export const OTHER_LESSON_ID = "01952ef7-0000-7000-8000-0000000000f2";
export const CLASS_ID = "01952ef7-0000-7000-8000-0000000000d1";
export const COURSE_ID = "01952ef7-0000-7000-8000-0000000000c1";
export const EDITION_ID = "01952ef7-0000-7000-8000-0000000000e1";
export const LESSON_PLAN_ID = "01952ef7-0000-7000-8000-0000000000a1";
export const LESSON_PLAN_ID_2 = "01952ef7-0000-7000-8000-0000000000a2";
export const ARCHIVED_LESSON_PLAN_ID = "01952ef7-0000-7000-8000-0000000000a3";

export const CLASS_NAME = "Informática Básica — A";
export const COURSE_NAME = "Informática Básica";

/** The period of the class of the Figma: the first and the last day a lesson of it can have. */
export const CLASS_PERIOD = { startDate: "2026-03-02", endDate: "2026-06-30" } as const;

/**
 * Response of the lesson routes: "Teclado, mouse e janelas", planned for 2026-03-10 from 09:00 to
 * 11:00 in the class "Informática Básica — A", created from the first plan of the course, never
 * rescheduled. Overrides win over any default.
 */
export function buildLesson(overrides: Partial<LessonResponseDto> = {}): LessonResponseDto {
  return {
    id: LESSON_ID,
    title: "Teclado, mouse e janelas",
    belowExpectedMonitors: false,
    coverage: {
      teacher: { confirmed: 0, expected: 1 },
      monitors: { confirmed: 0, expected: null },
    },
    objective: "Usar teclado e mouse e organizar janelas.",
    date: "2026-03-10",
    startTime: "09:00",
    endTime: "11:00",
    durationMinutes: 120,
    location: "Laboratório 2 — Bloco B",
    status: LessonStatus.planned,
    expectedStudents: 12,
    expectedMonitors: 2,
    subject: null,
    postNotes: null,
    originalDate: null,
    rescheduleReason: null,
    rescheduleNote: null,
    cancelReason: null,
    cancelledAt: null,
    cancelledById: null,
    sequenceOrder: 1,
    lessonPlan: { id: LESSON_PLAN_ID, title: "Teclado, mouse e janelas", archivedAt: null },
    class: {
      id: CLASS_ID,
      code: "INFO-A",
      name: CLASS_NAME,
      archivedAt: null,
      ...CLASS_PERIOD,
    },
    course: { id: COURSE_ID, name: COURSE_NAME },
    edition: { id: EDITION_ID, name: "2026.1" },
    createdById: "01952ef7-0000-7000-8000-000000000001",
    createdAt: "2026-02-12T12:00:00.000Z",
    updatedAt: "2026-02-12T12:00:00.000Z",
    ...overrides,
  };
}

/** A lesson created on its own, outside the sequence of the course. */
export function buildStandaloneLesson(overrides: Partial<LessonResponseDto> = {}) {
  return buildLesson({ lessonPlan: null, sequenceOrder: null, ...overrides });
}

export function buildCancelledLesson(overrides: Partial<LessonResponseDto> = {}) {
  return buildLesson({
    status: LessonStatus.cancelled,
    cancelReason: "Feriado municipal.",
    cancelledAt: "2026-03-05T12:00:00.000Z",
    cancelledById: "01952ef7-0000-7000-8000-000000000001",
    ...overrides,
  });
}

/** A lesson that was already rescheduled once: it was on 2026-03-03 before it moved. */
export function buildRescheduledLesson(overrides: Partial<LessonResponseDto> = {}) {
  return buildLesson({
    originalDate: "2026-03-03",
    rescheduleReason: "Sala indisponível",
    rescheduleNote: "A sala foi usada para a prova.",
    ...overrides,
  });
}

/** An item of the sequence of a course (`GET /courses/:id/lesson-plans`). */
export function buildSequenceItem(
  overrides: Partial<CourseLessonPlanItemResponseDto> = {},
): CourseLessonPlanItemResponseDto {
  return {
    lessonPlanId: LESSON_PLAN_ID,
    position: 1,
    title: "Teclado, mouse e janelas",
    contents: ["Teclado e mouse", "Janelas do sistema"],
    expectedDurationMinutes: 120,
    materialUrl: null,
    courseCount: 1,
    archivedAt: null,
    ...overrides,
  };
}

/**
 * Response of `GET /courses/:id/lesson-plans`. By default it is the sequence of the Figma with two
 * plans, "Teclado, mouse e janelas" (1) and "Senhas e privacidade" (2). The positions are renumbered
 * from 1 and the workload is the sum of the durations, as the API does.
 */
export function buildCourseLessonPlans(
  items: CourseLessonPlanItemResponseDto[] = [
    buildSequenceItem(),
    buildSequenceItem({
      lessonPlanId: LESSON_PLAN_ID_2,
      title: "Senhas e privacidade",
      expectedDurationMinutes: 90,
    }),
  ],
): CourseLessonPlansResponseDto {
  return {
    courseId: COURSE_ID,
    items: items.map((item, index) => ({ ...item, position: index + 1 })),
    plannedWorkloadMinutes: items.reduce((total, item) => total + item.expectedDurationMinutes, 0),
  };
}

/** Response of `GET /lesson-plans/:id`: the plan the lesson comes from, with its own objective. */
export function buildLessonPlanDetail(
  overrides: Partial<LessonPlanDetailDto> = {},
): LessonPlanDetailDto {
  return {
    id: LESSON_PLAN_ID,
    title: "Teclado, mouse e janelas",
    objective: "Familiarizar o aluno com o teclado, o mouse e o uso básico das janelas.",
    expectedDurationMinutes: 120,
    contents: ["Teclado e mouse", "Janelas do sistema"],
    materialUrl: null,
    archivedAt: null,
    archivedById: null,
    archiveReason: null,
    createdById: "01952ef7-0000-7000-8000-000000000001",
    createdBy: { id: "01952ef7-0000-7000-8000-000000000001", name: "Ana Coordenadora" },
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-02-01T12:00:00.000Z",
    status: LessonPlanUsageStatus.in_use,
    usedIn: [],
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

export const OUTSIDE_PERIOD_ERROR: ApiErrorOptions = {
  statusCode: 400,
  error: "LESSON_OUTSIDE_CLASS_PERIOD",
  message: "The date is outside the period of the class.",
};

export const INVALID_TIME_RANGE_ERROR: ApiErrorOptions = {
  statusCode: 400,
  error: "INVALID_TIME_RANGE",
  message: "The end of the lesson must be after its start.",
};

export const LESSON_PLAN_NOT_IN_SEQUENCE_ERROR: ApiErrorOptions = {
  statusCode: 400,
  error: "LESSON_PLAN_NOT_IN_COURSE_SEQUENCE",
  message: "The lesson plan is not in the sequence of the course at this position.",
};

export const LESSON_CANCELLED_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "LESSON_CANCELLED",
  message: "A cancelled lesson cannot be changed.",
};

export const CLASS_ARCHIVED_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "CLASS_ARCHIVED",
  message: "Archived classes are read-only.",
};

export const LESSON_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "LESSON_NOT_FOUND",
  message: "Lesson not found.",
};

function apiErrorResponse({ statusCode, error, message, details }: ApiErrorOptions) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error, ...(details ? { details } : {}) },
    { status: statusCode },
  );
}

interface HandlerOptions<TCall, TResponse = LessonResponseDto> {
  response?: TResponse;
  error?: ApiErrorOptions;
  networkError?: boolean;
  /** Holds the answer until the test resolves it, to look at the loading state. */
  delay?: Promise<void>;
  onCall?: (call: TCall) => void;
}

interface IdCall {
  id: string;
}

export interface CreateLessonCall {
  body: CreateLessonDto;
}

export interface UpdateLessonCall {
  id: string;
  body: UpdateLessonDto;
}

export interface CancelLessonCall {
  id: string;
  body: CancelLessonDto;
}

export interface RescheduleLessonCall {
  id: string;
  body: RescheduleLessonDto;
}

async function readBody<TBody>(request: Request): Promise<TBody> {
  return (await request.json()) as TBody;
}

export function getLessonHandler({
  response = buildLesson(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall> = {}) {
  return http.get("*/lessons/:id", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function createLessonHandler({
  response = buildLesson(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<CreateLessonCall> = {}) {
  return http.post("*/lessons", async ({ request }) => {
    onCall?.({ body: await readBody<CreateLessonDto>(request) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response, { status: 201 });
  });
}

export function updateLessonHandler({
  response = buildLesson(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<UpdateLessonCall> = {}) {
  return http.patch("*/lessons/:id", async ({ request, params }) => {
    onCall?.({ id: String(params.id), body: await readBody<UpdateLessonDto>(request) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function cancelLessonHandler({
  response = buildCancelledLesson(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<CancelLessonCall> = {}) {
  return http.patch("*/lessons/:id/cancel", async ({ request, params }) => {
    onCall?.({ id: String(params.id), body: await readBody<CancelLessonDto>(request) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function rescheduleLessonHandler({
  response = buildRescheduledLesson({ date: "2026-03-17", originalDate: "2026-03-10" }),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<RescheduleLessonCall> = {}) {
  return http.patch("*/lessons/:id/reschedule", async ({ request, params }) => {
    onCall?.({ id: String(params.id), body: await readBody<RescheduleLessonDto>(request) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function listCourseLessonPlansHandler({
  response = buildCourseLessonPlans(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall, CourseLessonPlansResponseDto> = {}) {
  return http.get("*/courses/:id/lesson-plans", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

type LessonPlanDetailResponse = LessonPlanDetailDto | ((id: string) => LessonPlanDetailDto);

export function getLessonPlanHandler({
  response = buildLessonPlanDetail(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall, LessonPlanDetailResponse> = {}) {
  return http.get("*/lesson-plans/:id", async ({ params }) => {
    const id = String(params.id);
    onCall?.({ id });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(typeof response === "function" ? response(id) : response);
  });
}
