import type { HourEntryResponseDto, HoursSummaryResponseDto } from "@api/generated/model";

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
