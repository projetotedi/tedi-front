import { http, HttpResponse } from "msw";

import type {
  ApiFieldErrorDto,
  ArchiveDto,
  CreateLessonPlanDto,
  LessonPlanResponseDto,
  MeResponseDto,
  PermissionsDto,
  UpdateLessonPlanDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

function permissionsWith(granted: Partial<PermissionsDto>): PermissionsDto {
  return granted as PermissionsDto;
}

const MANAGER_PERMISSIONS = permissionsWith({ "catalog.view": "all", "lessonPlans.manage": "all" });

const PERMISSIONS_BY_ROLE: Record<Role, PermissionsDto> = {
  [Role.member]: permissionsWith({ "catalog.view": "all", "lessonPlans.manage": "none" }),
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

function apiErrorResponse({ statusCode, error, message, details }: ApiErrorOptions) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error, ...(details ? { details } : {}) },
    { status: statusCode },
  );
}

interface HandlerOptions<TCall> {
  response?: LessonPlanResponseDto;
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
  response = buildLessonPlan(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<IdCall> = {}) {
  return http.get("*/lesson-plans/:id", async ({ params }) => {
    onCall?.({ id: String(params.id) });
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
