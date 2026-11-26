import { http, HttpResponse } from "msw";

import {
  AssignmentRole,
  AssignmentSource,
  AssignmentStatus,
  LessonStatus,
  type ApiFieldErrorDto,
  type ApplyToLessonDto,
  type AssignmentLessonResponseDto,
  type LessonAssignmentResponseDto,
  type LessonCoverageDto,
  type MeResponseDto,
  type MyAssignmentResponseDto,
  type MyAssignmentsResponseDto,
  type MyAssignmentsTotalsDto,
  type OpenLessonResponseDto,
  type PendingApplicationGroupResponseDto,
  type PendingApplicationsResponseDto,
  type PermissionsDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

function permissionsWith(granted: Partial<PermissionsDto>): PermissionsDto {
  return granted as PermissionsDto;
}

// The matrix of the back (docs/PERMISSIONS.md): everybody sees the lessons and manages their own
// assignments (applies, sees their agenda), and only the director and the coordination review the
// applications of the others.
const MEMBER_PERMISSIONS = permissionsWith({
  "lessons.view": "all",
  "assignments.manageOwn": "own",
  "assignments.review": "none",
});

const REVIEWER_PERMISSIONS = permissionsWith({
  "lessons.view": "all",
  "assignments.manageOwn": "own",
  "assignments.review": "all",
});

const PERMISSIONS_BY_ROLE: Record<Role, PermissionsDto> = {
  [Role.member]: MEMBER_PERMISSIONS,
  [Role.director]: REVIEWER_PERMISSIONS,
  [Role.coordinator]: REVIEWER_PERMISSIONS,
  [Role.superadmin]: REVIEWER_PERMISSIONS,
};

/** The person of the session: the applicant of `POST /lessons/:id/applications`. */
export const SESSION_PERSON_ID = "01952ef7-0000-7000-8000-000000000001";
export const SESSION_PERSON_NAME = "Beatriz Nunes";

export function buildMeUser(role: Role = Role.member): MeResponseDto {
  return {
    id: SESSION_PERSON_ID,
    name: SESSION_PERSON_NAME,
    ra: null,
    email: null,
    role,
    permissions: PERMISSIONS_BY_ROLE[role],
    mustChangePassword: false,
  };
}

/** The same user without `assignments.manageOwn`, the permission of the route and of the menu item. */
export function buildMeUserWithoutManageOwn(role: Role = Role.member): MeResponseDto {
  const user = buildMeUser(role);
  return { ...user, permissions: { ...user.permissions, "assignments.manageOwn": "none" } };
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

const CLASS_INFO_A = { id: "01952ef7-0000-7000-8000-0000000000d1", code: "INFO-A" };
const CLASS_REDES_C = { id: "01952ef7-0000-7000-8000-0000000000d2", code: "REDES-C" };
const CLASS_SMART_B = { id: "01952ef7-0000-7000-8000-0000000000d3", code: "SMART-B" };

interface LessonFixture {
  title: string;
  sequenceOrder: number | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  class: { id: string; code: string; name: string };
}

/** The lessons of the Figma, by position: 0 to 2 are the member's own, 3 to 5 have a vacancy. */
const LESSON_FIXTURES: LessonFixture[] = [
  {
    title: "Arquivos e pastas",
    sequenceOrder: 3,
    date: "2026-03-17",
    startTime: "09:00",
    endTime: "11:00",
    location: "Laboratório 2",
    class: { ...CLASS_INFO_A, name: "Informática Básica — A" },
  },
  {
    title: "Privacidade no Facebook",
    sequenceOrder: 4,
    date: "2026-03-19",
    startTime: "14:00",
    endTime: "16:00",
    location: "Sala 3",
    class: { ...CLASS_REDES_C, name: "Redes Sociais — C" },
  },
  {
    title: "Chamadas de vídeo",
    sequenceOrder: 5,
    date: "2026-03-26",
    startTime: "14:00",
    endTime: "16:00",
    location: null,
    class: { ...CLASS_SMART_B, name: "Smartphones no dia a dia — B" },
  },
  {
    title: "E-mail do zero",
    sequenceOrder: 5,
    date: "2026-03-31",
    startTime: "09:00",
    endTime: "11:00",
    location: "Laboratório 2",
    class: { ...CLASS_INFO_A, name: "Informática Básica — A" },
  },
  {
    title: "Golpes e segurança",
    sequenceOrder: 6,
    date: "2026-04-02",
    startTime: "14:00",
    endTime: "16:00",
    location: null,
    class: { ...CLASS_REDES_C, name: "Redes Sociais — C" },
  },
  {
    title: "Compras on-line",
    sequenceOrder: 6,
    date: "2026-04-07",
    startTime: "09:00",
    endTime: "11:00",
    location: "Laboratório 2",
    class: { ...CLASS_INFO_A, name: "Informática Básica — A" },
  },
];

export const LESSON_IDS = LESSON_FIXTURES.map(
  (_lesson, index) => `01952ef7-0000-7000-8000-0000000000f${index + 1}`,
);

/** A lesson of an assignment (the reference `lesson` of `MyAssignment`, `OpenLesson` and the queue). */
export function buildAssignmentLesson(
  index = 0,
  overrides: Partial<AssignmentLessonResponseDto> = {},
): AssignmentLessonResponseDto {
  const { class: lessonClass, ...fixture } = LESSON_FIXTURES[index];
  return {
    id: LESSON_IDS[index],
    ...fixture,
    class: lessonClass,
    status: LessonStatus.planned,
    ...overrides,
  };
}

interface CoverageOverrides {
  teacher?: Partial<LessonCoverageDto["teacher"]>;
  monitors?: Partial<LessonCoverageDto["monitors"]>;
}

/** By default "Professor(a) 0 de 1 · Monitores 2 de 3", the vacancies of the Figma. */
export function buildCoverage({ teacher, monitors }: CoverageOverrides = {}): LessonCoverageDto {
  return {
    teacher: { confirmed: 0, expected: 1, ...teacher },
    monitors: { confirmed: 2, expected: 3, ...monitors },
  };
}

export function buildMyAssignment(
  index = 0,
  overrides: Partial<MyAssignmentResponseDto> = {},
): MyAssignmentResponseDto {
  return {
    id: `01952ef7-0000-7000-8000-0000000000b${index + 1}`,
    lesson: buildAssignmentLesson(index),
    role: AssignmentRole.monitor,
    source: AssignmentSource.application,
    status: AssignmentStatus.confirmed,
    ...overrides,
  };
}

/** The agenda of the Figma: two confirmed lessons and one waiting for confirmation. */
export function buildDefaultMyAssignments(): MyAssignmentResponseDto[] {
  return [
    buildMyAssignment(0, { role: AssignmentRole.teacher }),
    buildMyAssignment(1),
    buildMyAssignment(2, { status: AssignmentStatus.pending }),
  ];
}

/**
 * Response of `GET /me/assignments`. The totals follow the rules of the API: `confirmed` and
 * `pending` count the items of that status (a declined or a cancelled one is in no total),
 * `upcoming` is both of them, and `openLessons` is the number of the lessons with a vacancy, which
 * the items do not say (3 in the Figma, unless the test gives it).
 */
export function buildMyAssignments(
  items: MyAssignmentResponseDto[] = buildDefaultMyAssignments(),
  totals: Partial<MyAssignmentsTotalsDto> = {},
): MyAssignmentsResponseDto {
  const confirmed = items.filter((item) => item.status === AssignmentStatus.confirmed).length;
  const pending = items.filter((item) => item.status === AssignmentStatus.pending).length;

  return {
    from: "2026-03-16",
    to: "2026-04-12",
    items,
    totals: { confirmed, pending, upcoming: confirmed + pending, openLessons: 3, ...totals },
  };
}

export function buildOpenLesson(
  index = 3,
  overrides: Partial<OpenLessonResponseDto> = {},
): OpenLessonResponseDto {
  return {
    lesson: buildAssignmentLesson(index),
    coverage: buildCoverage(),
    openRoles: [AssignmentRole.teacher, AssignmentRole.monitor],
    ...overrides,
  };
}

/** The lessons with a vacancy of the Figma: 31/03 (both roles), 02/04 (monitors only) and 07/04. */
export function buildDefaultOpenLessons(): OpenLessonResponseDto[] {
  return [
    buildOpenLesson(3),
    buildOpenLesson(4, {
      coverage: buildCoverage({
        teacher: { confirmed: 1 },
        monitors: { confirmed: 0, expected: 2 },
      }),
      openRoles: [AssignmentRole.monitor],
    }),
    buildOpenLesson(5, {
      coverage: buildCoverage({ teacher: { confirmed: 1 }, monitors: { confirmed: 1 } }),
      openRoles: [AssignmentRole.monitor],
    }),
  ];
}

export const APPLICATION_IDS = {
  beatriz: "01952ef7-0000-7000-8000-0000000000a1",
  diego: "01952ef7-0000-7000-8000-0000000000a2",
  carla: "01952ef7-0000-7000-8000-0000000000a3",
} as const;

export const PEOPLE = {
  beatriz: { id: "01952ef7-0000-7000-8000-0000000000e1", name: "Beatriz Nunes" },
  diego: { id: "01952ef7-0000-7000-8000-0000000000e2", name: "Diego Almeida" },
  carla: { id: "01952ef7-0000-7000-8000-0000000000e3", name: "Carla Menezes" },
} as const;

/** A pending application: Beatriz, monitor, in "E-mail do zero", sent on 20/03 with a note. */
export function buildApplication(
  overrides: Partial<LessonAssignmentResponseDto> = {},
): LessonAssignmentResponseDto {
  return {
    id: APPLICATION_IDS.beatriz,
    lessonId: LESSON_IDS[3],
    person: PEOPLE.beatriz,
    role: AssignmentRole.monitor,
    source: AssignmentSource.application,
    status: AssignmentStatus.pending,
    note: "Posso chegar 15 min antes para ligar os computadores.",
    createdAt: "2026-03-20T15:00:00.000Z",
    createdById: PEOPLE.beatriz.id,
    updatedAt: "2026-03-20T15:00:00.000Z",
    reviewedAt: null,
    reviewedById: null,
    cancelledAt: null,
    cancelledById: null,
    ...overrides,
  };
}

/** Diego, teacher, in "E-mail do zero", sent on 19/03 without a note. */
export function buildDiegoApplication(
  overrides: Partial<LessonAssignmentResponseDto> = {},
): LessonAssignmentResponseDto {
  return buildApplication({
    id: APPLICATION_IDS.diego,
    person: PEOPLE.diego,
    role: AssignmentRole.teacher,
    note: null,
    createdAt: "2026-03-19T15:00:00.000Z",
    createdById: PEOPLE.diego.id,
    ...overrides,
  });
}

/** Carla, monitor, in "Golpes e segurança", sent on 21/03 without a note. */
export function buildCarlaApplication(
  overrides: Partial<LessonAssignmentResponseDto> = {},
): LessonAssignmentResponseDto {
  return buildApplication({
    id: APPLICATION_IDS.carla,
    lessonId: LESSON_IDS[4],
    person: PEOPLE.carla,
    note: null,
    createdAt: "2026-03-21T15:00:00.000Z",
    createdById: PEOPLE.carla.id,
    ...overrides,
  });
}

export function buildPendingGroup(
  lessonIndex: number,
  applications: LessonAssignmentResponseDto[],
  overrides: Partial<Omit<PendingApplicationGroupResponseDto, "applications">> = {},
): PendingApplicationGroupResponseDto {
  return {
    lesson: buildAssignmentLesson(lessonIndex),
    coverage: buildCoverage(),
    applications,
    ...overrides,
  };
}

/** Response of `GET /applications?status=pending`: the `total` is the number of applications. */
export function buildPendingApplications(
  groups: PendingApplicationGroupResponseDto[] = buildDefaultPendingGroups(),
): PendingApplicationsResponseDto {
  return {
    lessons: groups,
    total: groups.reduce((total, group) => total + group.applications.length, 0),
  };
}

/** The queue of the Figma: two applications in "E-mail do zero" and one in "Golpes e segurança". */
export function buildDefaultPendingGroups(): PendingApplicationGroupResponseDto[] {
  return [
    buildPendingGroup(3, [buildApplication(), buildDiegoApplication()]),
    buildPendingGroup(4, [buildCarlaApplication()], {
      coverage: buildCoverage({
        teacher: { confirmed: 1 },
        monitors: { confirmed: 0, expected: 2 },
      }),
    }),
  ];
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

export const ROLE_FULL_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "ROLE_FULL",
  message: "There is no open place for this role.",
};

export const ALREADY_APPLIED_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "ALREADY_APPLIED",
  message: "The member already holds a place in the lesson.",
};

export const LESSON_IN_PAST_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "LESSON_IN_PAST",
  message: "The lesson no longer takes applications.",
};

export const LESSON_CANCELLED_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "LESSON_CANCELLED",
  message: "A cancelled lesson cannot receive assignments.",
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

export const APPLICATION_NOT_PENDING_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "APPLICATION_NOT_PENDING",
  message: "The application is not pending.",
};

export const APPLICATION_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "APPLICATION_NOT_FOUND",
  message: "Application not found.",
};

function apiErrorResponse({ statusCode, error, message, details }: ApiErrorOptions) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error, ...(details ? { details } : {}) },
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

/** What a list request carried: the period the screen never sends, and the filter of the queue. */
export interface PeriodCall {
  from: string | null;
  to: string | null;
}

export interface PendingApplicationsCall {
  status: string | null;
}

export interface ApplyToLessonCall {
  id: string;
  body: ApplyToLessonDto;
}

export interface ReviewApplicationCall {
  id: string;
}

async function readBody<TBody>(request: Request): Promise<TBody> {
  return (await request.json()) as TBody;
}

function periodOf(request: Request): PeriodCall {
  const { searchParams } = new URL(request.url);
  return { from: searchParams.get("from"), to: searchParams.get("to") };
}

export function listMyAssignmentsHandler({
  response = buildMyAssignments(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<PeriodCall, MyAssignmentsResponseDto> = {}) {
  return http.get("*/me/assignments", async ({ request }) => {
    onCall?.(periodOf(request));
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function listOpenLessonsHandler({
  response = buildDefaultOpenLessons(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<PeriodCall, OpenLessonResponseDto[]> = {}) {
  return http.get("*/me/open-lessons", async ({ request }) => {
    onCall?.(periodOf(request));
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function applyToLessonHandler({
  response = buildApplication({ id: "01952ef7-0000-7000-8000-0000000000a9" }),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ApplyToLessonCall, LessonAssignmentResponseDto> = {}) {
  return http.post("*/lessons/:id/applications", async ({ request, params }) => {
    onCall?.({ id: String(params.id), body: await readBody<ApplyToLessonDto>(request) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response, { status: 201 });
  });
}

export function listPendingApplicationsHandler({
  response = buildPendingApplications(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<PendingApplicationsCall, PendingApplicationsResponseDto> = {}) {
  return http.get("*/applications", async ({ request }) => {
    onCall?.({ status: new URL(request.url).searchParams.get("status") });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function approveApplicationHandler({
  response = buildApplication({
    status: AssignmentStatus.confirmed,
    reviewedAt: "2026-03-22T15:00:00.000Z",
    reviewedById: SESSION_PERSON_ID,
  }),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ReviewApplicationCall, LessonAssignmentResponseDto> = {}) {
  return http.patch("*/applications/:id/approve", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

export function rejectApplicationHandler({
  response = buildApplication({
    status: AssignmentStatus.declined,
    reviewedAt: "2026-03-22T15:00:00.000Z",
    reviewedById: SESSION_PERSON_ID,
  }),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ReviewApplicationCall, LessonAssignmentResponseDto> = {}) {
  return http.patch("*/applications/:id/reject", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response);
  });
}

interface BackendSeed {
  mine?: MyAssignmentResponseDto[];
  open?: OpenLessonResponseDto[];
  groups?: PendingApplicationGroupResponseDto[];
}

function byDay(a: MyAssignmentResponseDto, b: MyAssignmentResponseDto): number {
  return (
    a.lesson.date.localeCompare(b.lesson.date) ||
    a.lesson.startTime.localeCompare(b.lesson.startTime) ||
    a.lesson.id.localeCompare(b.lesson.id)
  );
}

/**
 * A backend of a few lines that remembers what happened, so a test can follow a whole flow instead
 * of the answer of one request:
 *
 * - `POST /lessons/:id/applications` moves the lesson from "with a vacancy" to the agenda of the
 *   member as `pending` (the totals follow), and queues the application for whoever reviews;
 * - `PATCH /applications/:id/approve` takes the application out of its group (the group goes when it
 *   is empty), counts one more confirmed in the role of the coverage of the lesson, and the `total`
 *   of the queue goes down;
 * - `PATCH /applications/:id/reject` takes the application out of the queue and nothing else changes.
 *
 * The seed is the Figma, unless the test says otherwise. Every read answers with the state of that
 * moment, as the API does.
 */
export function createApplicationsBackend(seed: BackendSeed = {}) {
  const state = {
    mine: [...(seed.mine ?? buildDefaultMyAssignments())],
    open: [...(seed.open ?? buildDefaultOpenLessons())],
    groups: structuredClone(seed.groups ?? buildDefaultPendingGroups()),
  };
  const calls = {
    applied: [] as ApplyToLessonCall[],
    approved: [] as string[],
    rejected: [] as string[],
  };

  function takeFromQueue(applicationId: string) {
    for (const group of state.groups) {
      const application = group.applications.find((candidate) => candidate.id === applicationId);
      if (application) {
        group.applications = group.applications.filter((candidate) => candidate !== application);
        state.groups = state.groups.filter((candidate) => candidate.applications.length > 0);
        return { application, group };
      }
    }
    return null;
  }

  const handlers = [
    http.get("*/me/assignments", () =>
      HttpResponse.json(buildMyAssignments(state.mine, { openLessons: state.open.length })),
    ),
    http.get("*/me/open-lessons", () => HttpResponse.json(state.open)),
    http.post("*/lessons/:id/applications", async ({ request, params }) => {
      const id = String(params.id);
      const body = await readBody<ApplyToLessonDto>(request);
      calls.applied.push({ id, body });

      const openLesson = state.open.find((candidate) => candidate.lesson.id === id);
      if (!openLesson) return apiErrorResponse(LESSON_NOT_FOUND_ERROR);

      const application = buildApplication({
        id: `01952ef7-0000-7000-8000-${String(100 + calls.applied.length).padStart(12, "0")}`,
        lessonId: id,
        person: { id: SESSION_PERSON_ID, name: SESSION_PERSON_NAME },
        createdById: SESSION_PERSON_ID,
        role: body.role,
        note: body.note ?? null,
      });
      state.open = state.open.filter((candidate) => candidate !== openLesson);
      state.mine = [
        ...state.mine,
        {
          id: application.id,
          lesson: openLesson.lesson,
          role: body.role,
          source: AssignmentSource.application,
          status: AssignmentStatus.pending,
        },
      ].sort(byDay);
      const group = state.groups.find((candidate) => candidate.lesson.id === id);
      if (group) group.applications.push(application);
      else {
        state.groups.push({
          lesson: openLesson.lesson,
          coverage: openLesson.coverage,
          applications: [application],
        });
      }
      return HttpResponse.json(application, { status: 201 });
    }),
    http.get("*/applications", () => HttpResponse.json(buildPendingApplications(state.groups))),
    http.patch("*/applications/:id/approve", ({ params }) => {
      const id = String(params.id);
      calls.approved.push(id);

      const taken = takeFromQueue(id);
      if (!taken) return apiErrorResponse(APPLICATION_NOT_FOUND_ERROR);

      const { application, group } = taken;
      const part = application.role === AssignmentRole.teacher ? "teacher" : "monitors";
      group.coverage = {
        ...group.coverage,
        [part]: { ...group.coverage[part], confirmed: group.coverage[part].confirmed + 1 },
      };
      // The group of a lesson that is empty now left the queue, and the coverage went with it.
      return HttpResponse.json({
        ...application,
        status: AssignmentStatus.confirmed,
        reviewedAt: "2026-03-22T15:00:00.000Z",
        reviewedById: SESSION_PERSON_ID,
      });
    }),
    http.patch("*/applications/:id/reject", ({ params }) => {
      const id = String(params.id);
      calls.rejected.push(id);

      const taken = takeFromQueue(id);
      if (!taken) return apiErrorResponse(APPLICATION_NOT_FOUND_ERROR);

      return HttpResponse.json({
        ...taken.application,
        status: AssignmentStatus.declined,
        reviewedAt: "2026-03-22T15:00:00.000Z",
        reviewedById: SESSION_PERSON_ID,
      });
    }),
  ];

  return { handlers, state, calls };
}
