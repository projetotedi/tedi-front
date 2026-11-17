import { http, HttpResponse } from "msw";

import type {
  ApiFieldErrorDto,
  CreateHourEntryDto,
  HourEntryResponseDto,
  HoursSummaryResponseDto,
  ListMyHourEntries200,
} from "@api/generated/model";
import { LogMyHoursBody } from "@api/generated/zod/hours/hours";

/*
 * The data of the tests of the entries of hours (GUS-163), the ones of the Figma ("Telas · Conta" and
 * "Fluxo de banco de horas"). The mock of the Figma does not add up between its screens (the tiles
 * do not sum the rows of "Horas por categoria", and the card of the profile skips the 05/03 the
 * statement shows), so each fixture reproduces its own screen, and `SUMMARY_ALL` and `SUMMARY_MONTH`
 * are not reconciled on purpose.
 */

/** Ana Paula Torres, the person signed in. */
export const ANA_ID = "6a1f0c2e-1111-4a11-8a11-111111111111";
/** The coordinator who reviewed the entries. */
export const COORD_ID = "6a1f0c2e-2222-4a22-8a22-222222222222";
/** The director who logs hours on behalf of a member. */
export const DIRECTOR_ID = "6a1f0c2e-3333-4a33-8a33-333333333333";
/** Beatriz Nunes Carvalho, a member. */
export const BEATRIZ_ID = "6a1f0c2e-4444-4a44-8a44-444444444444";
export const BEATRIZ_NAME = "Beatriz Nunes Carvalho";

/** The id of the entry `n` of the fixtures ("e1" to "e11"). */
export function entryId(n: number): string {
  return `0195a000-0000-7000-8000-${`e${n}`.padStart(12, "0")}`;
}

/** A summary with every status and every category of the contract at zero, as the API answers for a person with no entries. */
export function buildSummary(
  overrides: Partial<HoursSummaryResponseDto> = {},
): HoursSummaryResponseDto {
  return {
    from: null,
    to: null,
    bankMinutes: 0,
    byStatus: [
      { status: "pending", entries: 0, declaredMinutes: 0, validatedMinutes: 0 },
      { status: "approved", entries: 0, declaredMinutes: 0, validatedMinutes: 0 },
      { status: "adjusted", entries: 0, declaredMinutes: 0, validatedMinutes: 0 },
      { status: "rejected", entries: 0, declaredMinutes: 0, validatedMinutes: 0 },
    ],
    byCategory: [
      { category: "lesson", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
      { category: "planning", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
      { category: "event", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
      { category: "management", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
      { category: "meeting", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
      { category: "support", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
      { category: "other", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
    ],
    ...overrides,
  };
}

/** `GET /me/hours/summary` with no period: the tiles of the Figma, 58h, 48h, 8h and 2h. */
export const SUMMARY_ALL: HoursSummaryResponseDto = buildSummary({
  bankMinutes: 2880,
  byStatus: [
    { status: "pending", entries: 2, declaredMinutes: 480, validatedMinutes: 0 },
    { status: "approved", entries: 24, declaredMinutes: 2760, validatedMinutes: 2760 },
    { status: "adjusted", entries: 1, declaredMinutes: 180, validatedMinutes: 120 },
    { status: "rejected", entries: 1, declaredMinutes: 60, validatedMinutes: 0 },
  ],
  byCategory: [
    {
      category: "lesson",
      entries: 14,
      declaredMinutes: 1680,
      bankMinutes: 1680,
      pendingMinutes: 0,
    },
    {
      category: "planning",
      entries: 3,
      declaredMinutes: 660,
      bankMinutes: 120,
      pendingMinutes: 480,
    },
    { category: "event", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
    {
      category: "management",
      entries: 10,
      declaredMinutes: 1080,
      bankMinutes: 1080,
      pendingMinutes: 0,
    },
    { category: "meeting", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
    { category: "support", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
    { category: "other", entries: 1, declaredMinutes: 60, bankMinutes: 0, pendingMinutes: 0 },
  ],
});

/** `GET /me/hours/summary?from=2026-03-01&to=2026-03-31`: Aula 28h, Gestão 20h, Planejamento 8h and Evento 2h. */
export const SUMMARY_MONTH: HoursSummaryResponseDto = buildSummary({
  from: "2026-03-01",
  to: "2026-03-31",
  bankMinutes: 3000,
  byStatus: [
    { status: "pending", entries: 2, declaredMinutes: 480, validatedMinutes: 0 },
    { status: "approved", entries: 24, declaredMinutes: 2880, validatedMinutes: 2880 },
    { status: "adjusted", entries: 1, declaredMinutes: 240, validatedMinutes: 120 },
    { status: "rejected", entries: 0, declaredMinutes: 0, validatedMinutes: 0 },
  ],
  byCategory: [
    {
      category: "lesson",
      entries: 14,
      declaredMinutes: 1680,
      bankMinutes: 1680,
      pendingMinutes: 0,
    },
    { category: "planning", entries: 2, declaredMinutes: 480, bankMinutes: 0, pendingMinutes: 480 },
    { category: "event", entries: 1, declaredMinutes: 240, bankMinutes: 120, pendingMinutes: 0 },
    {
      category: "management",
      entries: 10,
      declaredMinutes: 1200,
      bankMinutes: 1200,
      pendingMinutes: 0,
    },
    { category: "meeting", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
    { category: "support", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
    { category: "other", entries: 0, declaredMinutes: 0, bankMinutes: 0, pendingMinutes: 0 },
  ],
});

const REVIEWED = { reviewedAt: "2026-03-16T13:00:00.000Z", reviewedById: COORD_ID } as const;

/** An entry of Ana, logged by herself and still pending. */
export function buildEntry(overrides: Partial<HourEntryResponseDto> = {}): HourEntryResponseDto {
  return {
    id: entryId(4),
    personId: ANA_ID,
    createdById: ANA_ID,
    origin: "manual",
    classId: null,
    lessonId: null,
    notes: null,
    reviewNote: null,
    reviewedAt: null,
    reviewedById: null,
    createdAt: "2026-03-14T12:00:00.000Z",
    updatedAt: "2026-03-14T12:00:00.000Z",
    date: "2026-03-08",
    activity: "Feira de tecnologia (evento externo)",
    category: "event",
    declaredMinutes: 240,
    validatedMinutes: null,
    status: "pending",
    ...overrides,
  };
}

/** The statement of the Figma, the newest day first. The 15/02 is "Outros" here: a manual entry cannot be a lesson. */
export const STATEMENT: HourEntryResponseDto[] = [
  buildEntry({
    ...REVIEWED,
    id: entryId(1),
    date: "2026-03-14",
    activity: "Reunião de coordenação",
    category: "management",
    declaredMinutes: 120,
    validatedMinutes: 120,
    status: "approved",
  }),
  buildEntry({
    ...REVIEWED,
    id: entryId(2),
    date: "2026-03-12",
    activity: "Planejamento de conteúdo do bimestre",
    category: "planning",
    declaredMinutes: 180,
    validatedMinutes: 120,
    status: "adjusted",
    reviewNote: "Feito em dupla: cada pessoa registra 2h.",
  }),
  buildEntry({
    ...REVIEWED,
    id: entryId(3),
    date: "2026-03-10",
    activity: "Aula — Teclado, mouse e janelas (INFO-A)",
    category: "lesson",
    declaredMinutes: 120,
    validatedMinutes: 120,
    status: "approved",
    origin: "attendance",
    classId: "0195a000-0000-7000-8000-0000000000c1",
    lessonId: "0195a000-0000-7000-8000-0000000000f1",
  }),
  buildEntry({ id: entryId(4) }),
  buildEntry({
    ...REVIEWED,
    id: entryId(5),
    date: "2026-03-05",
    activity: "Atendimento a membro novo",
    category: "support",
    declaredMinutes: 60,
    validatedMinutes: 60,
    status: "approved",
  }),
  buildEntry({
    ...REVIEWED,
    id: entryId(6),
    date: "2026-02-28",
    activity: "Material de apoio sem comprovação",
    category: "other",
    declaredMinutes: 120,
    validatedMinutes: 0,
    status: "rejected",
    reviewNote: "Sem link do material. Lance de novo com o link.",
  }),
  buildEntry({
    ...REVIEWED,
    id: entryId(7),
    date: "2026-02-20",
    activity: "Planejamento do calendário do bimestre",
    category: "planning",
    declaredMinutes: 90,
    validatedMinutes: 90,
    status: "approved",
  }),
  buildEntry({
    id: entryId(8),
    date: "2026-02-15",
    activity: "Cobertura de aula substituta",
    category: "other",
    declaredMinutes: 100,
  }),
];

/** The entry of `STATEMENT` whose id is `entryId(n)`. */
export function statementEntry(n: number): HourEntryResponseDto {
  const entry = STATEMENT.find((item) => item.id === entryId(n));
  if (entry === undefined) throw new Error(`No entry e${n} in the statement`);
  return entry;
}

/** A lesson hour the attendance created that is still pending: never removable. */
export const ATTENDANCE_PENDING: HourEntryResponseDto = buildEntry({
  ...statementEntry(3),
  id: entryId(9),
  status: "pending",
  validatedMinutes: null,
  reviewedAt: null,
  reviewedById: null,
});

/** The card of the profile as the Figma draws it: e1, e2, e3, e4 and e6 (it skips the 05/03). */
export const RECENT_ENTRIES: HourEntryResponseDto[] = [1, 2, 3, 4, 6].map(statementEntry);

/*
 * The handlers MSW, written by hand over the contract. The paths have a wildcard prefix because
 * `http-client.ts` prefixes the URL with `VITE_API_URL` at runtime: the test does not need to know it.
 */

/** The `ApiErrorDto` an error handler answers with, and its status. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message?: string;
  details?: ApiFieldErrorDto[];
}

interface HandlerOptions<TCall> {
  /** Answers with the `ApiErrorDto` shape and its status. */
  error?: ApiErrorBody;
  /** Answers with a failed connection (`fetch` rejects with a `TypeError`). */
  networkError?: boolean;
  /** Holds the response until the promise settles. */
  delay?: Promise<void>;
  onCall?: (call: TCall) => void;
}

function apiErrorResponse(error: ApiErrorBody) {
  return HttpResponse.json(
    { message: error.message ?? error.error, ...error },
    { status: error.statusCode },
  );
}

/** What a `POST` of an entry sent: the member of the path (`null` for `/me`) and the body, as JSON. */
export interface LogCall {
  memberId: string | null;
  body: unknown;
}

/** The entry the API creates for a body: pending, waiting for validation. */
export function createdEntry(
  body: CreateHourEntryDto,
  overrides: Partial<HourEntryResponseDto> = {},
): HourEntryResponseDto {
  return buildEntry({
    id: entryId(10),
    date: body.date,
    activity: body.activity,
    category: body.category,
    declaredMinutes: body.declaredMinutes,
    notes: body.notes ?? null,
    createdAt: "2026-03-16T15:00:00.000Z",
    updatedAt: "2026-03-16T15:00:00.000Z",
    ...overrides,
  });
}

interface LogHandlerOptions extends HandlerOptions<LogCall> {
  /** What else the API does when it creates the entry (the in-memory store of the profile). */
  onCreated?: (entry: HourEntryResponseDto) => void;
}

/** `POST /me/hour-entries`: Ana logs her own hours. */
export function logMyHoursHandler({
  error,
  networkError = false,
  delay,
  onCall,
  onCreated,
}: LogHandlerOptions = {}) {
  return http.post("*/me/hour-entries", async ({ request }) => {
    const json: unknown = await request.json();
    onCall?.({ memberId: null, body: json });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    const entry = createdEntry(LogMyHoursBody.parse(json));
    onCreated?.(entry);
    return HttpResponse.json(entry, { status: 201 });
  });
}

/** `POST /members/:id/hour-entries`: the director logs hours on behalf of a member. */
export function logHoursForMemberHandler({
  error,
  networkError = false,
  delay,
  onCall,
}: HandlerOptions<LogCall> = {}) {
  return http.post("*/members/:id/hour-entries", async ({ request, params }) => {
    const json: unknown = await request.json();
    const memberId = String(params.id);
    onCall?.({ memberId, body: json });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(
      createdEntry(LogMyHoursBody.parse(json), {
        id: entryId(11),
        personId: memberId,
        createdById: DIRECTOR_ID,
        origin: "on_behalf",
      }),
      { status: 201 },
    );
  });
}

/** The period a summary was asked for: `null` when it was not sent. */
export interface SummaryCall {
  from: string | null;
  to: string | null;
}

interface SummaryHandlerOptions extends HandlerOptions<SummaryCall> {
  /** The answer with no period (the tiles). */
  all?: HoursSummaryResponseDto;
  /** The answer for a period (the month of "Horas por categoria"), whatever the month. */
  month?: HoursSummaryResponseDto;
}

/**
 * `GET /me/hours/summary`: `all` with no period, `month` with one. Any month answers `month`, so a
 * test that does not freeze the date still sees the rows of the Figma.
 */
export function myHoursSummaryHandler({
  all = SUMMARY_ALL,
  month = SUMMARY_MONTH,
  error,
  networkError = false,
  delay,
  onCall,
}: SummaryHandlerOptions = {}) {
  return http.get("*/me/hours/summary", async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const call = { from: params.get("from"), to: params.get("to") };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    if (call.from === null && call.to === null) return HttpResponse.json(all);
    return HttpResponse.json({ ...month, from: call.from, to: call.to });
  });
}

/** The page asked for, as it went in the URL (`null` when it was not sent). */
export interface ListCall {
  page: string | null;
  limit: string | null;
}

/** A page of `entries`, as the API pages them (20 by default). */
export function pageOf(
  entries: readonly HourEntryResponseDto[],
  call: ListCall,
): ListMyHourEntries200 {
  const page = call.page === null ? 1 : Number(call.page);
  const limit = call.limit === null ? 20 : Number(call.limit);
  return {
    data: entries.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total: entries.length,
  };
}

/**
 * The answer of the Figma: the card of the profile (`limit=5`) shows e1, e2, e3, e4 and e6, out of 8;
 * the statement pages the 8 of `STATEMENT`.
 */
export function figmaEntriesPage(call: ListCall): ListMyHourEntries200 {
  if (call.limit === "5" && call.page === null) {
    return { data: RECENT_ENTRIES, page: 1, limit: 5, total: STATEMENT.length };
  }
  return pageOf(STATEMENT, call);
}

interface EntriesHandlerOptions extends HandlerOptions<ListCall> {
  /** What a page is: the Figma by default. */
  response?: (call: ListCall) => ListMyHourEntries200;
}

/** `GET /me/hour-entries`. */
export function myHourEntriesHandler({
  response = figmaEntriesPage,
  error,
  networkError = false,
  delay,
  onCall,
}: EntriesHandlerOptions = {}) {
  return http.get("*/me/hour-entries", async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const call = { page: params.get("page"), limit: params.get("limit") };
    onCall?.(call);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response(call));
  });
}

/** The summary with a pending entry more (`sign` 1) or less (`sign` -1). */
function withPendingEntry(
  summary: HoursSummaryResponseDto,
  entry: HourEntryResponseDto,
  sign: 1 | -1,
): HoursSummaryResponseDto {
  const minutes = sign * entry.declaredMinutes;
  return {
    ...summary,
    byStatus: summary.byStatus.map((item) =>
      item.status === "pending"
        ? { ...item, entries: item.entries + sign, declaredMinutes: item.declaredMinutes + minutes }
        : item,
    ),
    byCategory: summary.byCategory.map((item) =>
      item.category === entry.category
        ? {
            ...item,
            entries: item.entries + sign,
            declaredMinutes: item.declaredMinutes + minutes,
            pendingMinutes: item.pendingMinutes + minutes,
          }
        : item,
    ),
  };
}

/** Newest day first, and the latest created first within a day: the order of the API. */
function byNewestDay(first: HourEntryResponseDto, second: HourEntryResponseDto): number {
  return second.date.localeCompare(first.date) || second.createdAt.localeCompare(first.createdAt);
}

/**
 * The hours of Ana kept in memory, as the API would: logging an entry puts it in her entries (in
 * the order of the API) and in her summaries (the whole period, and March when it is in March). It
 * starts as the Figma: the tiles of `SUMMARY_ALL`, the month of `SUMMARY_MONTH` and the 8 entries of
 * `STATEMENT`. Its `handlers` answer the screens of the profile from it.
 */
export function createHoursStore() {
  const state = {
    entries: [...STATEMENT],
    all: SUMMARY_ALL,
    month: SUMMARY_MONTH,
  };

  function add(entry: HourEntryResponseDto) {
    state.entries = [...state.entries, entry].sort(byNewestDay);
    state.all = withPendingEntry(state.all, entry, 1);
    if (entry.date.startsWith("2026-03")) state.month = withPendingEntry(state.month, entry, 1);
  }

  return {
    get entries(): readonly HourEntryResponseDto[] {
      return state.entries;
    },
    handlers: [
      http.get("*/me/hours/summary", ({ request }) => {
        const params = new URL(request.url).searchParams;
        const from = params.get("from");
        const to = params.get("to");
        if (from === null && to === null) return HttpResponse.json(state.all);
        return HttpResponse.json({ ...state.month, from, to });
      }),
      http.get("*/me/hour-entries", ({ request }) => {
        const params = new URL(request.url).searchParams;
        return HttpResponse.json(
          pageOf(state.entries, { page: params.get("page"), limit: params.get("limit") }),
        );
      }),
      logMyHoursHandler({ onCreated: add }),
    ],
  };
}
