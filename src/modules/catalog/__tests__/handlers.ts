import { http, HttpResponse } from "msw";

import {
  CourseCategory,
  CourseStatus,
  LessonPlanUsageStatus,
  type ApiFieldErrorDto,
  type ArchiveDto,
  type CourseDetailDto,
  type CourseLessonPlanItemResponseDto,
  type CourseLessonPlansResponseDto,
  type CreateLessonPlanDto,
  type LessonPlanDetailDto,
  type LessonPlanResponseDto,
  type LessonPlanUsageResponseDto,
  type MeResponseDto,
  type PermissionsDto,
  type ReplaceCourseLessonPlansDto,
  type UpdateLessonPlanDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { MOCK_LESSON_PLANS, type LessonPlanMock } from "../mocks/lesson-plans.mock";

function permissionsWith(granted: Partial<PermissionsDto>): PermissionsDto {
  return granted as PermissionsDto;
}

const MANAGER_PERMISSIONS = permissionsWith({
  "catalog.view": "all",
  "lessonPlans.manage": "all",
  "courses.manage": "all",
});

const PERMISSIONS_BY_ROLE: Record<Role, PermissionsDto> = {
  [Role.member]: permissionsWith({
    "catalog.view": "all",
    "lessonPlans.manage": "none",
    "courses.manage": "none",
  }),
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

export const LESSON_PLAN_ID = "01952ef7-0000-7000-8000-0000000000a1";

export function buildLessonPlan(
  overrides: Partial<LessonPlanResponseDto> = {},
): LessonPlanResponseDto {
  return {
    id: LESSON_PLAN_ID,
    title: "Teclado, mouse e janelas",
    objective: "Familiarizar o aluno com o teclado, o mouse e o uso básico das janelas.",
    expectedDurationMinutes: 90,
    contents: ["Teclado e mouse", "Janelas do sistema"],
    materialUrl: "https://drive.google.com/file/d/exemplo/view",
    archivedAt: null,
    archivedById: null,
    archiveReason: null,
    createdById: "01952ef7-0000-7000-8000-000000000001",
    createdAt: "2026-10-01T13:00:00.000Z",
    updatedAt: "2026-10-01T13:00:00.000Z",
    ...overrides,
  };
}

export function buildArchivedLessonPlan(
  overrides: Partial<LessonPlanResponseDto> = {},
): LessonPlanResponseDto {
  return buildLessonPlan({
    archivedAt: "2026-10-10T13:00:00.000Z",
    archivedById: "01952ef7-0000-7000-8000-000000000001",
    archiveReason: "Conteúdo revisado em um novo plano.",
    ...overrides,
  });
}

export const LESSON_PLAN_CREATOR_NAME = "Beatriz Nunes";

/** Response of `GET /lesson-plans/:id`: the `buildLessonPlan` plan, unused, with its creator. */
export function buildLessonPlanDetail(
  overrides: Partial<LessonPlanDetailDto> = {},
): LessonPlanDetailDto {
  const plan = buildLessonPlan();

  return {
    ...plan,
    status: LessonPlanUsageStatus.unused,
    createdBy: { id: plan.createdById, name: LESSON_PLAN_CREATOR_NAME },
    usedIn: [],
    ...overrides,
  };
}

export function buildArchivedLessonPlanDetail(
  overrides: Partial<LessonPlanDetailDto> = {},
): LessonPlanDetailDto {
  return buildLessonPlanDetail({
    archivedAt: "2026-10-10T13:00:00.000Z",
    archivedById: "01952ef7-0000-7000-8000-000000000001",
    archiveReason: "Conteúdo revisado em um novo plano.",
    ...overrides,
  });
}

export const COURSE_SOCIAL_NETWORKS = {
  courseId: "01952ef7-0000-7000-8000-0000000000c1",
  courseName: "Redes Sociais com Segurança",
} as const;

export const COURSE_SMARTPHONES = {
  courseId: "01952ef7-0000-7000-8000-0000000000c2",
  courseName: "Smartphones no dia a dia",
} as const;

export const COURSE_ID = COURSE_SOCIAL_NETWORKS.courseId;

/**
 * An item of the sequence of a course (`GET /courses/:id/lesson-plans`): "Conhecendo o WhatsApp",
 * a plan with a real (UUID) id. The `lesson-plan-NN` ids of the mock catalog are not UUIDs.
 */
export function buildSequenceItem(
  overrides: Partial<CourseLessonPlanItemResponseDto> = {},
): CourseLessonPlanItemResponseDto {
  return {
    lessonPlanId: "01952ef7-0000-7000-8000-0000000000b1",
    position: 1,
    title: "Conhecendo o WhatsApp",
    contents: ["WhatsApp: mensagens e áudios"],
    expectedDurationMinutes: 90,
    materialUrl: "https://example.com/material/whatsapp",
    courseCount: 1,
    archivedAt: null,
    ...overrides,
  };
}

const ARCHIVED_AT = "2026-10-10T13:00:00.000Z";

/** A plan of the mock catalog (the source of the picker until GUS-95) as an item of a sequence. */
export function buildMockSequenceItem(
  lessonPlanId: string,
  overrides: Partial<CourseLessonPlanItemResponseDto> = {},
): CourseLessonPlanItemResponseDto {
  const plan = MOCK_LESSON_PLANS.find((candidate) => candidate.id === lessonPlanId);
  if (plan === undefined) throw new Error(`No mock lesson plan "${lessonPlanId}"`);

  return toSequenceItem(plan, overrides);
}

function toSequenceItem(
  plan: LessonPlanMock,
  overrides: Partial<CourseLessonPlanItemResponseDto> = {},
): CourseLessonPlanItemResponseDto {
  return {
    lessonPlanId: plan.id,
    position: 1,
    title: plan.title,
    contents: plan.contents,
    expectedDurationMinutes: plan.expectedDurationMinutes,
    materialUrl: plan.materialUrl,
    // The API counts the course that is asking too, so a sequence item is always in at least one.
    courseCount: Math.max(plan.courseCount, 1),
    archivedAt: plan.usage === "archived" ? ARCHIVED_AT : null,
    ...overrides,
  };
}

/**
 * Response of `GET /courses/:id/lesson-plans` and `PUT /courses/:id/lesson-plans`. The positions
 * are renumbered from 1 and the workload is the sum of the durations, as the API does. By default
 * it is the sequence of the Figma, 7h in four plans: "Conhecendo o WhatsApp" (a UUID id) and three
 * plans of the mock catalog (`lesson-plan-04`, `-05` and `-06`), so the picker has plans to leave out.
 */
export function buildCourseSequence(
  items: CourseLessonPlanItemResponseDto[] = [
    buildSequenceItem(),
    buildMockSequenceItem("lesson-plan-04"),
    buildMockSequenceItem("lesson-plan-05"),
    buildMockSequenceItem("lesson-plan-06"),
  ],
): CourseLessonPlansResponseDto {
  return {
    courseId: COURSE_ID,
    items: items.map((item, index) => ({ ...item, position: index + 1 })),
    plannedWorkloadMinutes: items.reduce((total, item) => total + item.expectedDurationMinutes, 0),
  };
}

/** A plan used by two courses: an active one (2 of 4, intermediate) and an archived one (4 of 5, basic). */
export function buildInUseLessonPlanDetail(
  overrides: Partial<LessonPlanDetailDto> = {},
): LessonPlanDetailDto {
  return buildLessonPlanDetail({
    status: LessonPlanUsageStatus.in_use,
    usedIn: [
      {
        ...COURSE_SOCIAL_NETWORKS,
        category: CourseCategory.intermediate,
        position: 2,
        lessonPlanCount: 4,
        courseStatus: CourseStatus.active,
      },
      {
        ...COURSE_SMARTPHONES,
        category: CourseCategory.basic,
        position: 4,
        lessonPlanCount: 5,
        courseStatus: CourseStatus.archived,
      },
    ],
    ...overrides,
  });
}

/**
 * Response of `GET /lesson-plans/:id/usage` for the two courses of `buildInUseLessonPlanDetail`.
 * The workloads are fixed on purpose and cannot be derived from the plan duration
 * (425 -> 455 and 510 -> 540): whoever shows "7h05" and "7h35" is reading the API answer, not adding.
 */
export function buildLessonPlanUsage(
  overrides: Partial<LessonPlanUsageResponseDto> = {},
): LessonPlanUsageResponseDto {
  return {
    lessonPlanId: LESSON_PLAN_ID,
    currentDurationMinutes: 90,
    newDurationMinutes: 120,
    courses: [
      {
        ...COURSE_SOCIAL_NETWORKS,
        position: 2,
        lessonPlanCount: 4,
        currentWorkloadMinutes: 425,
        newWorkloadMinutes: 455,
      },
      {
        ...COURSE_SMARTPHONES,
        position: 4,
        lessonPlanCount: 5,
        currentWorkloadMinutes: 510,
        newWorkloadMinutes: 540,
      },
    ],
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

export const ARCHIVED_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "LESSON_PLAN_ARCHIVED",
  message: "Archived lesson plans are read-only.",
};

export const NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "LESSON_PLAN_NOT_FOUND",
  message: "Lesson plan not found.",
};

export const COURSE_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "COURSE_NOT_FOUND",
  message: "Course not found.",
};

export const COURSE_ARCHIVED_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "COURSE_ARCHIVED",
  message: "Archived courses are read-only.",
};

export const DUPLICATE_LESSON_PLAN_ERROR: ApiErrorOptions = {
  statusCode: 400,
  error: "DUPLICATE_LESSON_PLAN",
  message: "A lesson plan can be in the sequence only once.",
};

/** On the sequence the API answers an archived plan with 400, not with the 409 of the plan routes. */
export const SEQUENCE_PLAN_ARCHIVED_ERROR: ApiErrorOptions = {
  statusCode: 400,
  error: "LESSON_PLAN_ARCHIVED",
  message: "Archived lesson plans cannot enter a sequence.",
};

export const SEQUENCE_PLAN_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 400,
  error: "LESSON_PLAN_NOT_FOUND",
  message: "Lesson plan not found.",
};

function apiErrorResponse({ statusCode, error, message, details }: ApiErrorOptions) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error, ...(details ? { details } : {}) },
    { status: statusCode },
  );
}

interface HandlerOptions<TCall, TResponse = LessonPlanResponseDto> {
  response?: TResponse;
  error?: ApiErrorOptions;
  networkError?: boolean;
  delay?: Promise<void>;
  onCall?: (call: TCall) => void;
}

interface CreateCall {
  body: CreateLessonPlanDto;
}

interface UpdateCall {
  id: string;
  body: UpdateLessonPlanDto;
}

interface ArchiveCall {
  id: string;
  body: ArchiveDto | undefined;
}

interface IdCall {
  id: string;
}

interface ReplaceSequenceCall {
  id: string;
  body: ReplaceCourseLessonPlansDto;
}

interface UsageCall {
  id: string;
  /** `null` when the request does not send `expectedDurationMinutes`. */
  expectedDurationMinutes: number | null;
}

async function readBody<TBody>(request: Request): Promise<TBody | undefined> {
  const text = await request.text();
  return text ? (JSON.parse(text) as TBody) : undefined;
}

export function createLessonPlanHandler({
  response = buildLessonPlan(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<CreateCall> = {}) {
  return http.post("*/lesson-plans", async ({ request }) => {
    onCall?.({ body: (await readBody<CreateLessonPlanDto>(request)) as CreateLessonPlanDto });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response, { status: 201 });
  });
}

export function getLessonPlanHandler({
  response = buildLessonPlanDetail(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall, LessonPlanDetailDto> = {}) {
  return http.get("*/lesson-plans/:id", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function getLessonPlanUsageHandler({
  response = buildLessonPlanUsage(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<UsageCall, LessonPlanUsageResponseDto> = {}) {
  return http.get("*/lesson-plans/:id/usage", async ({ request, params }) => {
    const expectedDuration = new URL(request.url).searchParams.get("expectedDurationMinutes");
    onCall?.({
      id: String(params.id),
      expectedDurationMinutes: expectedDuration === null ? null : Number(expectedDuration),
    });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function updateLessonPlanHandler({
  response = buildLessonPlan(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<UpdateCall> = {}) {
  return http.patch("*/lesson-plans/:id", async ({ request, params }) => {
    onCall?.({
      id: String(params.id),
      body: (await readBody<UpdateLessonPlanDto>(request)) as UpdateLessonPlanDto,
    });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function archiveLessonPlanHandler({
  response = buildArchivedLessonPlan(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ArchiveCall> = {}) {
  return http.patch("*/lesson-plans/:id/archive", async ({ request, params }) => {
    onCall?.({ id: String(params.id), body: await readBody<ArchiveDto>(request) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function unarchiveLessonPlanHandler({
  response = buildLessonPlan(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall> = {}) {
  return http.patch("*/lesson-plans/:id/unarchive", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function listCourseLessonPlansHandler({
  response = buildCourseSequence(),
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

export const COURSE_CREATOR_NAME = "Ana Paula Torres";

/**
 * Response of `GET /courses/:id`: "Redes Sociais com Segurança" as in the Figma. It is active, has
 * the default sequence (7h in four plans), one prerequisite and no course that requires it.
 * `lessonPlanCount` and `plannedWorkloadMinutes` follow `lessonPlans`, as the API derives them, so
 * a test that changes the plans does not have to repeat the sum; an override still wins.
 * The dates are at noon UTC, so they stay on the same day in any time zone of the browser.
 */
export function buildCourseDetail(overrides: Partial<CourseDetailDto> = {}): CourseDetailDto {
  const lessonPlans = overrides.lessonPlans ?? buildCourseSequence().items;

  return {
    id: COURSE_ID,
    name: COURSE_SOCIAL_NETWORKS.courseName,
    category: CourseCategory.intermediate,
    status: CourseStatus.active,
    createdAt: "2024-02-12T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z",
    description: "WhatsApp, Instagram e os golpes mais comuns.",
    objective: "Participar das redes sociais reconhecendo os riscos.",
    createdBy: { id: "01952ef7-0000-7000-8000-000000000002", name: COURSE_CREATOR_NAME },
    lessonPlans,
    lessonPlanCount: lessonPlans.length,
    plannedWorkloadMinutes: lessonPlans.reduce(
      (total, item) => total + item.expectedDurationMinutes,
      0,
    ),
    prerequisites: [
      {
        id: COURSE_SMARTPHONES.courseId,
        name: COURSE_SMARTPHONES.courseName,
        category: CourseCategory.basic,
        status: CourseStatus.active,
      },
    ],
    requiredBy: [],
    ...overrides,
  };
}

export function buildArchivedCourseDetail(
  overrides: Partial<CourseDetailDto> = {},
): CourseDetailDto {
  return buildCourseDetail({ status: CourseStatus.archived, ...overrides });
}

/**
 * `GET /courses/:id`. `response` can be a function of the id in the path, for a test that moves
 * from one course to another and needs each one to answer with its own data.
 */
export function getCourseHandler({
  response = buildCourseDetail(),
  error,
  networkError = false,
  delay,
  onCall,
}: Omit<HandlerOptions<IdCall, CourseDetailDto>, "response"> & {
  response?: CourseDetailDto | ((id: string) => CourseDetailDto);
} = {}) {
  return http.get("*/courses/:id", async ({ params }) => {
    const id = String(params.id);
    onCall?.({ id });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(typeof response === "function" ? response(id) : response);
  });
}

/** What the API knows about each plan: the plans of the default sequence and the mock catalog. */
function defaultSequenceCatalog(): CourseLessonPlanItemResponseDto[] {
  return [...buildCourseSequence().items, ...MOCK_LESSON_PLANS.map((plan) => toSequenceItem(plan))];
}

/**
 * `PUT /courses/:id/lesson-plans`. Without `response` it answers like the API: it looks every id of
 * the body up in `catalog`, numbers the plans in the order received and sums their durations; an
 * unknown id is a 400 `LESSON_PLAN_NOT_FOUND`.
 */
export function replaceCourseLessonPlansHandler({
  response,
  error,
  networkError = false,
  delay,
  onCall,
  catalog = defaultSequenceCatalog(),
}: HandlerOptions<ReplaceSequenceCall, CourseLessonPlansResponseDto> & {
  catalog?: CourseLessonPlanItemResponseDto[];
} = {}) {
  return http.put("*/courses/:id/lesson-plans", async ({ request, params }) => {
    const body = (await readBody<ReplaceCourseLessonPlansDto>(
      request,
    )) as ReplaceCourseLessonPlansDto;
    onCall?.({ id: String(params.id), body });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    if (response) return HttpResponse.json(response);

    const items = body.lessonPlanIds.map((lessonPlanId) =>
      catalog.find((candidate) => candidate.lessonPlanId === lessonPlanId),
    );
    if (items.some((item) => item === undefined)) {
      return apiErrorResponse(SEQUENCE_PLAN_NOT_FOUND_ERROR);
    }
    return HttpResponse.json({
      ...buildCourseSequence(items.filter((item) => item !== undefined)),
      courseId: String(params.id),
    });
  });
}

export const LESSON_PLAN_COPY_ID = "01952ef7-0000-7000-8000-0000000000a2";

/**
 * Response of `POST /lesson-plans/:id/duplicate` for the `buildLessonPlan` plan: the copy has its
 * own id and the title of the original with " (cópia)" after it. It is born active, as the API does,
 * even when the original is archived.
 */
export function buildLessonPlanCopy(
  overrides: Partial<LessonPlanResponseDto> = {},
): LessonPlanResponseDto {
  return buildLessonPlan({
    id: LESSON_PLAN_COPY_ID,
    title: "Teclado, mouse e janelas (cópia)",
    ...overrides,
  });
}

/** Response of `GET /lesson-plans/:id` for the copy: active, in no course and unused. */
export function buildLessonPlanCopyDetail(
  overrides: Partial<LessonPlanDetailDto> = {},
): LessonPlanDetailDto {
  return buildLessonPlanDetail({
    ...buildLessonPlanCopy(),
    status: LessonPlanUsageStatus.unused,
    usedIn: [],
    ...overrides,
  });
}

export function duplicateLessonPlanHandler({
  response = buildLessonPlanCopy(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall> = {}) {
  return http.post("*/lesson-plans/:id/duplicate", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response, { status: 201 });
  });
}

/**
 * `GET /lesson-plans/:id` that answers the plan of the id asked, or a 404 when none of `plans` has
 * it. `getLessonPlanHandler` answers the same body for every id, which cannot tell the original
 * from its copy.
 */
export function getLessonPlansByIdHandler(
  plans: LessonPlanDetailDto[],
  onCall?: (call: IdCall) => void,
) {
  return http.get("*/lesson-plans/:id", ({ params }) => {
    const id = String(params.id);
    onCall?.({ id });

    const plan = plans.find((candidate) => candidate.id === id);
    return plan === undefined ? apiErrorResponse(NOT_FOUND_ERROR) : HttpResponse.json(plan);
  });
}
