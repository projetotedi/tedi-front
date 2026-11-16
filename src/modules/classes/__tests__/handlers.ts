import { http, HttpResponse } from "msw";

import {
  ClassStatus,
  CourseCategory,
  CourseStatus,
  type CourseClassItemResponseDto,
  type CourseDetailDto,
  type ListCourseClasses200,
  type MeResponseDto,
  type PermissionsDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

function permissionsWith(granted: Partial<PermissionsDto>): PermissionsDto {
  return granted as PermissionsDto;
}

const VIEWER_PERMISSIONS = permissionsWith({
  "catalog.view": "all",
  "classes.view": "all",
  "classes.manage": "none",
});

const MANAGER_PERMISSIONS = permissionsWith({
  "catalog.view": "all",
  "classes.view": "all",
  "classes.manage": "all",
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

/** The same user without `classes.view`, the permission of everything the classes module shows. */
export function buildMeUserWithoutClasses(role: Role = Role.coordinator): MeResponseDto {
  const user = buildMeUser(role);
  return { ...user, permissions: { ...user.permissions, "classes.view": "none" } };
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

export const COURSE_ID = "01952ef7-0000-7000-8000-0000000000c1";
export const CLASS_ID = "01952ef7-0000-7000-8000-0000000000d1";
export const EDITION_ID = "01952ef7-0000-7000-8000-0000000000e1";

export interface ApiErrorOptions {
  statusCode: number;
  error: string;
  message?: string;
}

export const COURSE_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "COURSE_NOT_FOUND",
  message: "Course not found.",
};

function apiErrorResponse({ statusCode, error, message }: ApiErrorOptions) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error },
    { status: statusCode },
  );
}

interface HandlerOptions<TCall, TResponse> {
  response?: TResponse;
  error?: ApiErrorOptions;
  networkError?: boolean;
  /** Holds the answer until the test resolves it, to look at the loading state. */
  delay?: Promise<void>;
  onCall?: (call: TCall) => void;
}

/** An item of `GET /courses/:id/classes`: "Turma 2026.1", in progress with 12 of 15 seats taken. */
export function buildCourseClassItem(
  overrides: Partial<CourseClassItemResponseDto> = {},
): CourseClassItemResponseDto {
  return {
    id: CLASS_ID,
    code: "TUR-2026.1",
    name: "Turma 2026.1",
    edition: { id: EDITION_ID, name: "2026.1" },
    startDate: "2026-03-03",
    endDate: "2026-05-27",
    capacity: 15,
    enrolledCount: 12,
    status: ClassStatus.in_progress,
    ...overrides,
  };
}

/** The answer of `GET /courses/:id/classes`: `total` can be more than the items of the page. */
export function buildCourseClassesPage(
  items: CourseClassItemResponseDto[] = [buildCourseClassItem()],
  total: number = items.length,
): ListCourseClasses200 {
  return { data: items, total, page: 1, limit: 5 };
}

export interface ListCourseClassesCall {
  id: string;
  /** `null` when the request does not send the parameter. */
  page: number | null;
  limit: number | null;
  status: string | null;
}

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function listCourseClassesHandler({
  response = buildCourseClassesPage(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ListCourseClassesCall, ListCourseClasses200> = {}) {
  return http.get("*/courses/:id/classes", async ({ request, params }) => {
    const query = new URL(request.url).searchParams;
    onCall?.({
      id: String(params.id),
      page: numberOrNull(query.get("page")),
      limit: numberOrNull(query.get("limit")),
      status: query.get("status"),
    });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export const PREREQUISITE_COURSE = {
  id: "01952ef7-0000-7000-8000-0000000000c2",
  name: "Smartphones no dia a dia",
} as const;

/**
 * Response of `GET /courses/:id`: "Informática Básica", basic, active, with 6 lesson plans and no
 * prerequisite. The lesson plans themselves are not needed by this module, only how many there are.
 */
export function buildCourseDetail(overrides: Partial<CourseDetailDto> = {}): CourseDetailDto {
  return {
    id: COURSE_ID,
    name: "Informática Básica",
    category: CourseCategory.basic,
    status: CourseStatus.active,
    createdAt: "2024-02-12T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z",
    description: "O computador do zero: ligar, navegar e se proteger.",
    objective: "Usar o computador com autonomia.",
    createdBy: { id: "01952ef7-0000-7000-8000-000000000002", name: "Ana Paula Torres" },
    lessonPlans: [],
    lessonPlanCount: 6,
    plannedWorkloadMinutes: 540,
    prerequisites: [],
    requiredBy: [],
    ...overrides,
  };
}

export interface CourseCall {
  id: string;
}

export function getCourseHandler({
  response = buildCourseDetail(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<CourseCall, CourseDetailDto> = {}) {
  return http.get("*/courses/:id", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}
