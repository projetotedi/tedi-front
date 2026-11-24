import { http, HttpResponse } from "msw";

import {
  HourEntryEventType,
  HourEntryStatus,
  type AdjustHourEntryDto,
  type ApiFieldErrorDto,
  type HourEntryEventResponseDto,
  type HoursMemberTotalDto,
  type HoursSummaryResponseDto,
  type MemberHourEntryResponseDto,
  type RejectHourEntryDto,
  type SetHourCategoryNoteDto,
  type ValidateHourEntriesDto,
} from "@api/generated/model";

import {
  ANA_ID,
  BEATRIZ_ID,
  buildBeatrizSummary,
  buildCreatedEvent,
  buildMembers,
  buildOverviewSummary,
  buildPendingEntries,
  buildReviewedEntries,
  buildTecnologiaSummary,
  DIEGO_ID,
} from "./bank-fixtures";

/*
 * MSW handlers of the bank of hours over a store with state: a review (validate, adjust, reject)
 * takes the entry out of the queue and moves its minutes in the summary of everyone, in the summary
 * of the member and in the list of members, the way the API does, so a screen that reads again shows
 * the new totals. The errors follow the contract (`ApiErrorDto`, the code in `error`).
 */

export interface BankStore {
  summary: HoursSummaryResponseDto;
  members: HoursMemberTotalDto[];
  /** The summary of `GET /members/:id/hours`, by person; a person who is not here answers 404. */
  memberSummaries: Map<string, HoursSummaryResponseDto>;
  /** Every entry, of every status. */
  entries: MemberHourEntryResponseDto[];
  history: Map<string, HourEntryEventResponseDto[]>;
}

export interface BankRequest {
  method: string;
  url: URL;
  body: unknown;
}

export interface BankSpies {
  requests: BankRequest[];
  /** While set, `GET /hour-entries` waits for it before answering (to hold a re-read of the queue). */
  queueGate: Promise<void> | null;
}

export function createBankSpies(): BankSpies {
  return { requests: [], queueGate: null };
}

function summaryFromMember(row: HoursMemberTotalDto): HoursSummaryResponseDto {
  const summary = buildOverviewSummary();
  return {
    ...summary,
    bankMinutes: row.bankMinutes,
    byStatus: summary.byStatus.map((total) => {
      if (total.status === HourEntryStatus.pending) {
        return { ...total, entries: row.pendingEntries, declaredMinutes: row.pendingMinutes };
      }
      if (total.status === HourEntryStatus.approved) {
        return {
          ...total,
          entries: row.entries - row.pendingEntries,
          declaredMinutes: row.bankMinutes,
          validatedMinutes: row.bankMinutes,
        };
      }
      return { ...total, entries: 0, declaredMinutes: 0, validatedMinutes: 0 };
    }),
  };
}

/**
 * The store of March as the coordination sees it (`all`), or as the director of Tecnologia does
 * (`department`: only Beatriz and Diego, and their entries).
 */
export function createBankStore(scope: "all" | "department" = "all"): BankStore {
  const inScope = (personId: string) =>
    scope === "all" || personId === BEATRIZ_ID || personId === DIEGO_ID;
  const members = buildMembers().filter((row) => inScope(row.personId));
  const entries = [...buildPendingEntries(), ...buildReviewedEntries()].filter((entry) =>
    inScope(entry.personId),
  );
  const memberSummaries = new Map(
    members.map((row) => [
      row.personId,
      row.personId === BEATRIZ_ID ? buildBeatrizSummary() : summaryFromMember(row),
    ]),
  );
  const history = new Map(entries.map((entry) => [entry.id, [buildCreatedEvent(entry)]]));

  return {
    summary: scope === "all" ? buildOverviewSummary() : buildTecnologiaSummary(),
    members,
    memberSummaries,
    entries,
    history,
  };
}

/** An error of the API, in the shape of the contract. */
export function apiError(
  statusCode: number,
  error: string,
  details: ApiFieldErrorDto[] = [],
): Response {
  return HttpResponse.json({ statusCode, message: error, error, details }, { status: statusCode });
}

const REVIEWED_AT = {
  [HourEntryStatus.approved]: "2026-03-16T13:00:00.000Z",
  [HourEntryStatus.adjusted]: "2026-03-16T13:15:00.000Z",
  [HourEntryStatus.rejected]: "2026-03-16T13:30:00.000Z",
} as const;

type ReviewedStatus = keyof typeof REVIEWED_AT;

const EVENT_OF = {
  [HourEntryStatus.approved]: HourEntryEventType.approved,
  [HourEntryStatus.adjusted]: HourEntryEventType.adjusted,
  [HourEntryStatus.rejected]: HourEntryEventType.rejected,
} as const;

function moveInSummary(
  summary: HoursSummaryResponseDto,
  entry: MemberHourEntryResponseDto,
  status: ReviewedStatus,
  validatedMinutes: number,
): void {
  summary.bankMinutes += validatedMinutes;
  for (const total of summary.byStatus) {
    if (total.status === HourEntryStatus.pending) {
      total.entries -= 1;
      total.declaredMinutes -= entry.declaredMinutes;
    }
    if (total.status === status) {
      total.entries += 1;
      total.declaredMinutes += entry.declaredMinutes;
      total.validatedMinutes += validatedMinutes;
    }
  }
  for (const total of summary.byCategory) {
    if (total.category === entry.category) {
      total.pendingMinutes -= entry.declaredMinutes;
      total.bankMinutes += validatedMinutes;
    }
  }
}

/** What the API does on a review: the entry leaves the queue and its minutes move. */
export function applyReview(
  store: BankStore,
  entry: MemberHourEntryResponseDto,
  status: ReviewedStatus,
  validatedMinutes: number,
  note: string | null,
): MemberHourEntryResponseDto {
  const reviewed: MemberHourEntryResponseDto = {
    ...entry,
    status,
    validatedMinutes,
    reviewNote: note,
    reviewedAt: REVIEWED_AT[status],
    reviewedById: ANA_ID,
    updatedAt: REVIEWED_AT[status],
  };
  store.entries = store.entries.map((item) => (item.id === entry.id ? reviewed : item));

  moveInSummary(store.summary, entry, status, validatedMinutes);
  const memberSummary = store.memberSummaries.get(entry.personId);
  if (memberSummary !== undefined) moveInSummary(memberSummary, entry, status, validatedMinutes);

  store.members = store.members.map((row) =>
    row.personId === entry.personId
      ? {
          ...row,
          pendingEntries: row.pendingEntries - 1,
          pendingMinutes: row.pendingMinutes - entry.declaredMinutes,
          bankMinutes: row.bankMinutes + validatedMinutes,
        }
      : row,
  );

  const events = store.history.get(entry.id) ?? [];
  store.history.set(entry.id, [
    ...events,
    {
      id: `${entry.id.slice(0, -3)}e${String(events.length + 1).padStart(2, "0")}`,
      hourEntryId: entry.id,
      type: EVENT_OF[status],
      actor: { id: ANA_ID, name: "Ana Paula Torres" },
      createdAt: REVIEWED_AT[status],
      fromMinutes: entry.declaredMinutes,
      toMinutes: validatedMinutes,
      fromStatus: HourEntryStatus.pending,
      toStatus: status,
      note,
    },
  ]);

  return reviewed;
}

function sortMembers(members: HoursMemberTotalDto[]): HoursMemberTotalDto[] {
  return [...members].sort(
    (a, b) =>
      b.pendingMinutes - a.pendingMinutes ||
      b.declaredMinutes - a.declaredMinutes ||
      a.personId.localeCompare(b.personId),
  );
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

function paginate<T>(items: T[], url: URL): { page: number; limit: number; data: T[] } {
  const page = Number(url.searchParams.get("page") ?? 1);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  return { page, limit, data: items.slice((page - 1) * limit, page * limit) };
}

function pendingOf(store: BankStore, id: string): MemberHourEntryResponseDto | undefined {
  return store.entries.find((entry) => entry.id === id && entry.status === HourEntryStatus.pending);
}

/** The handlers of every route of the screens, over `store`; `spies` keeps what was asked. */
export function bankHandlers(store: BankStore, spies: BankSpies = createBankSpies()) {
  async function record(request: Request): Promise<URL> {
    const url = new URL(request.url);
    const body = request.method === "GET" ? undefined : await request.clone().json();
    spies.requests.push({ method: request.method, url, body });
    return url;
  }

  return [
    http.get("*/hours/overview", async ({ request }) => {
      const url = await record(request);
      const search = url.searchParams.get("search");
      const members = sortMembers(store.members).filter(
        (row) => search === null || normalize(row.member?.name ?? "").includes(normalize(search)),
      );
      return HttpResponse.json({
        summary: store.summary,
        members: { ...paginate(members, url), total: members.length },
      });
    }),

    http.get("*/members/:id/hours", async ({ request, params }) => {
      const url = await record(request);
      const personId = String(params.id);
      const summary = store.memberSummaries.get(personId);
      const row = store.members.find((item) => item.personId === personId);
      if (summary === undefined || row === undefined || row.member === null) {
        return apiError(404, "MEMBER_NOT_FOUND");
      }
      const entries = store.entries.filter((entry) => entry.personId === personId);
      return HttpResponse.json({
        member: row.member,
        summary,
        entries: { ...paginate(entries, url), total: entries.length },
      });
    }),

    http.put("*/members/:id/hours/notes", async ({ request, params }) => {
      await record(request);
      const personId = String(params.id);
      const body = (await request.json()) as SetHourCategoryNoteDto;
      const total = store.memberSummaries
        .get(personId)
        ?.byCategory.find((item) => item.category === body.category);
      if (total === undefined) return apiError(404, "MEMBER_NOT_FOUND");
      total.note = body.note;
      return HttpResponse.json({
        personId,
        category: body.category,
        note: body.note,
        updatedById: ANA_ID,
        updatedAt: "2026-03-16T13:00:00.000Z",
      });
    }),

    http.get("*/hour-entries", async ({ request }) => {
      const url = await record(request);
      if (spies.queueGate !== null) await spies.queueGate;
      const status = url.searchParams.get("status") ?? HourEntryStatus.pending;
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const personId = url.searchParams.get("personId");
      const entries = store.entries
        .filter(
          (entry) =>
            entry.status === status &&
            (from === null || entry.date >= from) &&
            (to === null || entry.date <= to) &&
            (personId === null || entry.personId === personId),
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      return HttpResponse.json({ ...paginate(entries, url), total: entries.length });
    }),

    http.patch("*/hour-entries/validate", async ({ request }) => {
      await record(request);
      const { ids } = (await request.json()) as ValidateHourEntriesDto;
      const missing = ids.findIndex((entryId) => !store.entries.some((e) => e.id === entryId));
      if (missing !== -1) {
        return apiError(400, "HOUR_ENTRY_NOT_FOUND", [
          { field: `ids.${missing}`, message: "not found" },
        ]);
      }
      const notPending = ids.findIndex((entryId) => pendingOf(store, entryId) === undefined);
      if (notPending !== -1) {
        return apiError(409, "ENTRY_NOT_PENDING", [
          { field: `ids.${notPending}`, message: "not pending" },
        ]);
      }
      const entries = ids.flatMap((entryId) => pendingOf(store, entryId) ?? []);
      if (entries.some((entry) => entry.personId === ANA_ID)) {
        return apiError(409, "SELF_REVIEW_NOT_ALLOWED");
      }
      const reviewed = entries.map((entry) =>
        applyReview(store, entry, HourEntryStatus.approved, entry.declaredMinutes, null),
      );
      return HttpResponse.json(reviewed.map(({ member: _member, ...rest }) => rest));
    }),

    http.patch("*/hour-entries/:id/adjust", async ({ request, params }) => {
      await record(request);
      const body = (await request.json()) as AdjustHourEntryDto;
      const entry = pendingOf(store, String(params.id));
      if (entry === undefined) return apiError(409, "ENTRY_NOT_PENDING");
      if (body.validatedMinutes === entry.declaredMinutes) {
        return apiError(400, "ADJUSTED_MINUTES_UNCHANGED");
      }
      const reviewed = applyReview(
        store,
        entry,
        HourEntryStatus.adjusted,
        body.validatedMinutes,
        body.justification,
      );
      const { member: _member, ...response } = reviewed;
      return HttpResponse.json(response);
    }),

    http.patch("*/hour-entries/:id/reject", async ({ request, params }) => {
      await record(request);
      const body = (await request.json()) as RejectHourEntryDto;
      const entry = pendingOf(store, String(params.id));
      if (entry === undefined) return apiError(409, "ENTRY_NOT_PENDING");
      const reviewed = applyReview(store, entry, HourEntryStatus.rejected, 0, body.reason);
      const { member: _member, ...response } = reviewed;
      return HttpResponse.json(response);
    }),

    http.get("*/hour-entries/:id/history", async ({ request, params }) => {
      await record(request);
      const events = store.history.get(String(params.id));
      if (events === undefined) return apiError(404, "HOUR_ENTRY_NOT_FOUND");
      return HttpResponse.json(events);
    }),

    http.get("*/hours/export", async ({ request }) => {
      const url = await record(request);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      return new HttpResponse(
        `﻿data;membro;atividade;horas\r\n2026-03-05;Beatriz Nunes;Planejamento;4h\r\n`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="hours_${from}_${to}.csv"`,
          },
        },
      );
    }),
  ];
}

/** The requests of one method and path, in order; `path` is the end of the path ("/hours/overview"). */
export function requestsTo(spies: BankSpies, method: string, path: string): BankRequest[] {
  return spies.requests.filter(
    (request) => request.method === method && request.url.pathname.endsWith(path),
  );
}

/** The requests of the queue itself, without the probes of the Período (which ask a `status`). */
export function queueRequests(spies: BankSpies): BankRequest[] {
  return requestsTo(spies, "GET", "/hour-entries").filter(
    (request) => !request.url.searchParams.has("status"),
  );
}
