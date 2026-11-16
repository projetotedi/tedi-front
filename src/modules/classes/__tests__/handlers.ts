import { http, HttpResponse } from "msw";

import {
  ClassStatus,
  CourseCategory,
  CourseStatus,
  type ClassDetailCourseResponseDto,
  type ClassDetailDto,
  type ClassDetailSummaryResponseDto,
  type ClassEnrollmentPreviewItemResponseDto,
  type MeResponseDto,
  type PermissionsDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

function permissionsWith(granted: Partial<PermissionsDto>): PermissionsDto {
  return granted as PermissionsDto;
}

// The matrix of the back (docs/PERMISSIONS.md): everybody sees classes and the catalog, and only
// the director and the coordination manage enrollments.
const MANAGER_PERMISSIONS = permissionsWith({
  "classes.view": "all",
  "catalog.view": "all",
  "enrollments.manage": "all",
});

const PERMISSIONS_BY_ROLE: Record<Role, PermissionsDto> = {
  [Role.member]: permissionsWith({
    "classes.view": "all",
    "catalog.view": "all",
    "enrollments.manage": "none",
  }),
  [Role.director]: MANAGER_PERMISSIONS,
  [Role.coordinator]: MANAGER_PERMISSIONS,
  [Role.superadmin]: MANAGER_PERMISSIONS,
};

export function buildMeUser(role: Role = Role.coordinator): MeResponseDto {
  return {
    id: "01999a3e-0000-7000-8000-000000000001",
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

export const CLASS_ID = "01999a3e-7c1b-7000-8000-0000000000c1";
export const COURSE_ID = "01999a3e-7c1b-7000-8000-000000000001";
export const CLASS_NAME = "Informática Básica — Turma A";
export const COURSE_NAME = "Informática Básica";

/** The students of the preview of the Figma, the earliest enrollment first. */
export const STUDENT_NAMES = [
  "Maria das Dores Silva",
  "José Carlos Pereira",
  "Ana Lúcia Souza",
  "Antônio Ferreira Lima",
  "Helena Barbosa Costa",
  "Francisco de Assis Rocha",
  "Terezinha Moreira",
] as const;

/**
 * An item of `enrollmentsPreview`: the student number `index` (from 0) of `STUDENT_NAMES`,
 * enrolled one day after the one before. The dates are at noon UTC, so they stay on the same day
 * in Brazil, the time zone the suite runs in (see `setupClassesTestServer`).
 */
export function buildEnrollment(
  index: number,
  overrides: Partial<ClassEnrollmentPreviewItemResponseDto> = {},
): ClassEnrollmentPreviewItemResponseDto {
  const number = String(index + 1).padStart(2, "0");

  return {
    id: `01999a3e-7c1b-7000-8000-0000000001${number}`,
    student: {
      id: `01999a3e-7c1b-7000-8000-0000000002${number}`,
      name: STUDENT_NAMES[index % STUDENT_NAMES.length],
    },
    enrolledAt: `2026-02-${String(20 + index).padStart(2, "0")}T12:00:00.000Z`,
    ...overrides,
  };
}

export function buildClassCourse(
  overrides: Partial<ClassDetailCourseResponseDto> = {},
): ClassDetailCourseResponseDto {
  return {
    id: COURSE_ID,
    name: COURSE_NAME,
    category: CourseCategory.basic,
    status: CourseStatus.active,
    lessonPlanCount: 4,
    plannedWorkloadMinutes: 450,
    ...overrides,
  };
}

/**
 * The numbers of the card Resumo: 12 of 15 seats, and no lessons or attendance yet, which is what
 * the API answers until the lessons module exists. `occupancyRate` follows the two counts, rounded
 * to two decimals as the API does, unless an override says otherwise.
 */
export function buildClassSummary(
  overrides: Partial<ClassDetailSummaryResponseDto> = {},
): ClassDetailSummaryResponseDto {
  const enrolledCount = overrides.enrolledCount ?? 12;
  const capacity = overrides.capacity ?? 15;

  return {
    enrolledCount,
    capacity,
    occupancyRate: Math.round((enrolledCount * 100) / capacity) / 100,
    lessonsDone: null,
    lessonsTotal: null,
    averageAttendance: null,
    ...overrides,
  };
}

/**
 * Response of `GET /classes/:id`: "Informática Básica — Turma A" as in the Figma. It is in
 * progress, basic (the level of its course), has 12 of 15 seats taken, the preview with the first
 * five students and no lessons or attendance yet. `enrollmentsTotal` and `summary` follow the
 * number of enrolled students (`enrollmentsTotal`, else `summary.enrolledCount`, else 12) and the
 * capacity, as the API derives them, so a test that changes one does not repeat the rest; an
 * override still wins. The dates are at noon UTC, so they stay on the same day in Brazil, the time
 * zone the suite runs in (see `setupClassesTestServer`).
 */
export function buildClassDetail(overrides: Partial<ClassDetailDto> = {}): ClassDetailDto {
  const capacity = overrides.capacity ?? overrides.summary?.capacity ?? 15;
  const enrolledCount = overrides.enrollmentsTotal ?? overrides.summary?.enrolledCount ?? 12;

  return {
    id: CLASS_ID,
    code: "INFO-A",
    name: CLASS_NAME,
    edition: { id: "01999a3e-7c1b-7000-8000-0000000000e1", name: "2026.1" },
    startDate: "2026-03-03",
    endDate: "2026-06-27",
    location: "Laboratório 3, bloco B",
    capacity,
    status: ClassStatus.in_progress,
    archivedAt: null,
    createdAt: "2026-02-12T12:00:00.000Z",
    createdBy: { id: "01999a3e-0000-7000-8000-0000000000aa", name: "Carla Menezes" },
    course: buildClassCourse(),
    summary: buildClassSummary({ enrolledCount, capacity }),
    enrollmentsPreview: Array.from({ length: Math.min(enrolledCount, 5) }, (_, index) =>
      buildEnrollment(index),
    ),
    enrollmentsTotal: enrolledCount,
    ...overrides,
  };
}

export function buildArchivedClassDetail(overrides: Partial<ClassDetailDto> = {}): ClassDetailDto {
  return buildClassDetail({ archivedAt: "2026-10-10T13:00:00.000Z", ...overrides });
}

export interface ApiErrorOptions {
  statusCode: number;
  error: string;
  message?: string;
}

export const CLASS_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "CLASS_NOT_FOUND",
  message: "Class not found.",
};

function apiErrorResponse({ statusCode, error, message }: ApiErrorOptions) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error },
    { status: statusCode },
  );
}

interface IdCall {
  id: string;
}

interface GetClassHandlerOptions {
  response?: ClassDetailDto;
  error?: ApiErrorOptions;
  networkError?: boolean;
  /** The answer waits for this promise, so a test can look at the screen while it is on its way. */
  delay?: Promise<void>;
  onCall?: (call: IdCall) => void;
}

export function getClassHandler({
  response = buildClassDetail(),
  error,
  networkError = false,
  delay,
  onCall,
}: GetClassHandlerOptions = {}) {
  return http.get("*/classes/:id", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}
