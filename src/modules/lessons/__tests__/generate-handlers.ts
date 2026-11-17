import { http, HttpResponse } from "msw";

import {
  LessonStatus,
  Weekday,
  type ClassLessonPreviewItemResponseDto,
  type ClassLessonsPreviewResponseDto,
  type GenerateClassLessonsDto,
  type GeneratedClassLessonsResponseDto,
  type LessonListItemResponseDto,
  type LessonResponseDto,
  type ListLessons200,
  type MeResponseDto,
  type SkippedLessonPlanResponseDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { buildMeUser, CLASS_ID, COURSE_NAME, type ApiErrorOptions } from "./handlers";

/*
 * Fixtures and MSW handlers of "Gerar aulas da turma" (GUS-157): the preview, the generation and
 * the list of the lessons of a class. The session and the ids shared with the other lesson
 * screens live in `./handlers` and are re-exported here, so a test of these screens imports from
 * one place.
 */
export { buildMeUser, CLASS_ID, COURSE_NAME, meHandler, type ApiErrorOptions } from "./handlers";

/**
 * The same user without `lessons.view` nor `lessons.manage`: no card "Aulas da turma" and no
 * button "Gerar aulas". (The one of `./handlers` only takes `lessons.view` away.)
 */
export function buildMeUserWithoutLessons(role: Role = Role.coordinator): MeResponseDto {
  const user = buildMeUser(role);
  return {
    ...user,
    permissions: { ...user.permissions, "lessons.view": "none", "lessons.manage": "none" },
  };
}

/** The period of the class of the Figma: it ends on a Friday, so a fourth Tuesday is outside. */
export const CLASS_START_DATE = "2026-04-07";
export const CLASS_END_DATE = "2026-04-24";

/** The lesson plans of the sequence of the course, in order. The Figma shows the first four. */
export const PLAN_FIXTURES = [
  { id: "01952ef7-0000-7000-8000-0000000000b1", title: "Conhecendo o computador", minutes: 90 },
  { id: "01952ef7-0000-7000-8000-0000000000b2", title: "Teclado, mouse e janelas", minutes: 90 },
  { id: "01952ef7-0000-7000-8000-0000000000b3", title: "Navegando na internet", minutes: 60 },
  { id: "01952ef7-0000-7000-8000-0000000000b4", title: "Segurança e privacidade", minutes: 120 },
] as const;

type PlanFixture = (typeof PLAN_FIXTURES)[number];

const WEEKDAY_NUMBER: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** `YYYY-MM-DD` plus `days` on the calendar. UTC, so the time zone of the machine never moves the day. */
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** What the API does: the first lesson is the first `weekday` on or after `firstDate`. */
function firstLessonDate(firstDate: string, weekday: Weekday): string {
  const [year, month, day] = firstDate.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(firstDate, (WEEKDAY_NUMBER[weekday] - current + 7) % 7);
}

function minutesBetween(start: string, end: string): number {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  return toMinutes(end) - toMinutes(start);
}

/** The body the Figma shows: Tuesdays, 09:00 to 11:00, from the first day of the class. */
export const FIGMA_BODY: GenerateClassLessonsDto = {
  weekday: Weekday.tuesday,
  startTime: "09:00",
  endTime: "11:00",
  firstDate: CLASS_START_DATE,
  location: "Laboratório 2 — Bloco B",
};

export function buildPreviewItem(
  overrides: Partial<ClassLessonPreviewItemResponseDto> = {},
): ClassLessonPreviewItemResponseDto {
  return {
    date: CLASS_START_DATE,
    expectedDurationMinutes: PLAN_FIXTURES[0].minutes,
    lessonPlanId: PLAN_FIXTURES[0].id,
    outsideClassPeriod: false,
    sequenceOrder: 1,
    title: PLAN_FIXTURES[0].title,
    ...overrides,
  };
}

interface PreviewOptions {
  /** The lesson plans of the sequence that originate a lesson, in order. Three by default. */
  plans?: readonly PlanFixture[];
  classStartDate?: string;
  classEndDate?: string;
  skippedLessonPlans?: SkippedLessonPlanResponseDto[];
}

/**
 * The answer of `POST /classes/:id/lessons/preview` for `body`, computed as the API does: one
 * lesson per plan, the first on the first weekday on or after `firstDate` and each next one a week
 * later, marked `outsideClassPeriod` when it falls before the start or after the end of the class.
 * It follows the body, so a test that changes the weekday gets other dates without a new fixture.
 */
export function buildPreviewFor(
  body: GenerateClassLessonsDto,
  {
    plans = PLAN_FIXTURES.slice(0, 3),
    classStartDate = CLASS_START_DATE,
    classEndDate = CLASS_END_DATE,
    skippedLessonPlans = [],
  }: PreviewOptions = {},
): ClassLessonsPreviewResponseDto {
  const first = firstLessonDate(body.firstDate, body.weekday);
  const items = plans.map((plan, index) => {
    const date = addDays(first, index * 7);
    return buildPreviewItem({
      date,
      expectedDurationMinutes: plan.minutes,
      lessonPlanId: plan.id,
      outsideClassPeriod: date < classStartDate || date > classEndDate,
      sequenceOrder: index + 1,
      title: plan.title,
    });
  });

  return {
    classId: CLASS_ID,
    classStartDate,
    classEndDate,
    weekday: body.weekday,
    startTime: body.startTime,
    endTime: body.endTime,
    durationMinutes: minutesBetween(body.startTime, body.endTime),
    location: body.location?.trim() ? body.location.trim() : null,
    items,
    lessonCount: items.length,
    outsideClassPeriodCount: items.filter((item) => item.outsideClassPeriod).length,
    skippedLessonPlans,
  };
}

/**
 * A preview with three lessons, all inside the period (Tuesdays from 07/04/2026). `lessonCount` and
 * `outsideClassPeriodCount` follow the items, as the API derives them, unless an override says
 * otherwise.
 */
export function buildPreview(
  overrides: Partial<ClassLessonsPreviewResponseDto> = {},
): ClassLessonsPreviewResponseDto {
  const base = buildPreviewFor(FIGMA_BODY);
  const items = overrides.items ?? base.items;

  return {
    ...base,
    items,
    lessonCount: items.length,
    outsideClassPeriodCount: items.filter((item) => item.outsideClassPeriod).length,
    ...overrides,
  };
}

/** The preview of the Figma: four lessons, the fourth on 28/04/2026, after the end of the class. */
export function buildOutsidePreview(
  overrides: Partial<ClassLessonsPreviewResponseDto> = {},
): ClassLessonsPreviewResponseDto {
  return {
    ...buildPreviewFor(FIGMA_BODY, { plans: PLAN_FIXTURES }),
    ...overrides,
  };
}

export function buildSkippedPlan(
  overrides: Partial<SkippedLessonPlanResponseDto> = {},
): SkippedLessonPlanResponseDto {
  return {
    archivedAt: "2026-03-01T12:00:00.000Z",
    lessonPlanId: "01952ef7-0000-7000-8000-0000000000b9",
    sequenceOrder: 2,
    title: "Redes sociais antigas",
    ...overrides,
  };
}

/** A lesson as the API answers it after generating (`LessonResponseDto`), the number `index` of the series. */
export function buildLesson(
  index = 0,
  overrides: Partial<LessonResponseDto> = {},
): LessonResponseDto {
  const plan = PLAN_FIXTURES[index % PLAN_FIXTURES.length];
  const number = String(index + 1).padStart(2, "0");

  return {
    id: `01952ef7-0000-7000-8000-0000000003${number}`,
    title: plan.title,
    objective: `Objetivo da aula ${plan.title}.`,
    belowExpectedMonitors: false,
    attendance: { pending: false, students: { signed: 0, total: 0 } },
    coverage: {
      teacher: { confirmed: 0, expected: 1 },
      monitors: { confirmed: 0, expected: null },
    },
    subject: null,
    date: addDays(CLASS_START_DATE, index * 7),
    startTime: "09:00",
    endTime: "11:00",
    durationMinutes: 120,
    location: "Laboratório 2 — Bloco B",
    status: LessonStatus.planned,
    sequenceOrder: index + 1,
    class: {
      id: CLASS_ID,
      code: "INFO-A",
      name: "Informática Básica — Turma A",
      startDate: CLASS_START_DATE,
      endDate: CLASS_END_DATE,
      archivedAt: null,
    },
    course: { id: "01952ef7-0000-7000-8000-0000000000c1", name: COURSE_NAME },
    edition: { id: "01952ef7-0000-7000-8000-0000000000e1", name: "2026.1" },
    lessonPlan: { id: plan.id, title: plan.title, archivedAt: null },
    expectedStudents: null,
    expectedMonitors: null,
    originalDate: null,
    rescheduleReason: null,
    rescheduleNote: null,
    postNotes: null,
    cancelReason: null,
    cancelledAt: null,
    cancelledById: null,
    createdAt: "2026-04-01T12:00:00.000Z",
    createdById: "01952ef7-0000-7000-8000-000000000001",
    updatedAt: "2026-04-01T12:00:00.000Z",
    ...overrides,
  };
}

/** The answer of `POST /classes/:id/lessons/generate`: `count` planned lessons, a week apart. */
export function buildGeneratedLessons(count: number): GeneratedClassLessonsResponseDto {
  return {
    classId: CLASS_ID,
    lessons: Array.from({ length: count }, (_, index) => buildLesson(index)),
  };
}

/** An item of `GET /lessons`: the lesson number `index` of the series, planned, with no teacher. */
export function buildLessonListItem(
  index = 0,
  overrides: Partial<LessonListItemResponseDto> = {},
): LessonListItemResponseDto {
  const plan = PLAN_FIXTURES[index % PLAN_FIXTURES.length];
  const number = String(index + 1).padStart(2, "0");

  return {
    id: `01952ef7-0000-7000-8000-0000000003${number}`,
    title: plan.title,
    date: addDays(CLASS_START_DATE, index * 7),
    startTime: "09:00",
    endTime: "11:00",
    status: LessonStatus.planned,
    teacher: null,
    belowExpectedMonitors: false,
    attendancePending: false,
    class: { id: CLASS_ID, code: "INFO-A", name: "Informática Básica — Turma A", colorIndex: 0 },
    ...overrides,
  };
}

/** The answer of `GET /lessons`: `total` can be more than the items of the page. */
export function buildLessonsPage(
  items: LessonListItemResponseDto[] = [],
  total: number = items.length,
  limit = 5,
): ListLessons200 {
  return { data: items, total, page: 1, limit };
}

export const LESSONS_ALREADY_GENERATED_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "LESSONS_ALREADY_GENERATED",
  message: "The lessons of this class were already generated.",
};

export const COURSE_WITHOUT_SEQUENCE_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "COURSE_WITHOUT_SEQUENCE",
  message: "The course has no active lesson plan.",
};

export const LESSONS_OUTSIDE_CLASS_PERIOD_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "LESSONS_OUTSIDE_CLASS_PERIOD",
  message: "A lesson would fall outside the period of the class.",
};

export const CLASS_ARCHIVED_ERROR: ApiErrorOptions = {
  statusCode: 409,
  error: "CLASS_ARCHIVED",
  message: "The class is archived.",
};

export const CLASS_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "CLASS_NOT_FOUND",
  message: "Class not found.",
};

export const INVALID_TIME_RANGE_ERROR: ApiErrorOptions = {
  statusCode: 400,
  error: "INVALID_TIME_RANGE",
  message: "endTime must be after startTime.",
};

function apiErrorResponse({ statusCode, error, message }: ApiErrorOptions) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error },
    { status: statusCode },
  );
}

async function readBody<TBody>(request: Request): Promise<TBody | undefined> {
  const text = await request.text();
  return text ? (JSON.parse(text) as TBody) : undefined;
}

interface HandlerOptions<TCall, TResponse> {
  /** The answer, or a function of the call, for a test that wants the answer to follow the body. */
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

export interface ClassBodyCall {
  id: string;
  body: GenerateClassLessonsDto;
}

/** `POST /classes/:id/lessons/preview`. By default it answers as the API does for the body it gets. */
export function previewClassLessonsHandler({
  response = (call: ClassBodyCall) => buildPreviewFor(call.body),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ClassBodyCall, ClassLessonsPreviewResponseDto> = {}) {
  return http.post("*/classes/:id/lessons/preview", async ({ request, params }) => {
    const call: ClassBodyCall = {
      id: String(params.id),
      body: (await readBody<GenerateClassLessonsDto>(request)) as GenerateClassLessonsDto,
    };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call));
  });
}

/** `POST /classes/:id/lessons/generate`: 201 with the lessons created. */
export function generateClassLessonsHandler({
  response = (call: ClassBodyCall) => buildGeneratedLessons(buildPreviewFor(call.body).lessonCount),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ClassBodyCall, GeneratedClassLessonsResponseDto> = {}) {
  return http.post("*/classes/:id/lessons/generate", async ({ request, params }) => {
    const call: ClassBodyCall = {
      id: String(params.id),
      body: (await readBody<GenerateClassLessonsDto>(request)) as GenerateClassLessonsDto,
    };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call), { status: 201 });
  });
}

export interface ListLessonsCall {
  /** `null` when the request does not send the parameter. */
  classId: string | null;
  page: number | null;
  limit: number | null;
}

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/** `GET /lessons`. */
export function listLessonsHandler({
  response = buildLessonsPage(),
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<ListLessonsCall, ListLessons200> = {}) {
  return http.get("*/lessons", async ({ request }) => {
    const query = new URL(request.url).searchParams;
    const call: ListLessonsCall = {
      classId: query.get("classId"),
      page: numberOrNull(query.get("page")),
      limit: numberOrNull(query.get("limit")),
    };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(resolveResponse(response, call));
  });
}
