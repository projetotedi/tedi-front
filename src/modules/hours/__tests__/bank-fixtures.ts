import {
  HourEntryCategory,
  HourEntryEventType,
  HourEntryOrigin,
  HourEntryStatus,
  type DepartmentResponseDto,
  type HourEntryEventResponseDto,
  type HoursCategoryTotalDto,
  type HoursMemberTotalDto,
  type HoursStatusTotalDto,
  type HoursSummaryResponseDto,
  type MemberHourEntryResponseDto,
  type MemberRefDto,
  type MeResponseDto,
} from "@api/generated/model";
import { buildMeUser } from "@modules/auth/__tests__/handlers";
import { Role } from "@shared/lib/role";

/*
 * The data of the Figma of the bank of hours (ficha §18 and plan §11), March of 2026: twelve members
 * whose declared minutes add up to 18 720 (312h), three pending entries, the coordinator Ana Paula
 * Torres and the director Marcos Lima (Tecnologia). The ids are UUIDs of the shape the generated
 * schemas accept.
 */

const id = (suffix: string) => `0197a000-0000-7000-8000-${suffix.padStart(12, "0")}`;

export const ANA_ID = id("a001");
export const MARCOS_ID = id("a002");
export const BEATRIZ_ID = id("b001");
export const RAFAEL_ID = id("b002");
export const CARLA_ID = id("b003");
export const DIEGO_ID = id("b004");

export const ENTRY_0503_ID = id("503");
export const ENTRY_1203_ID = id("1203");
export const ENTRY_1403_ID = id("1403");
export const ENTRY_0202_ID = id("202");
export const ENTRY_0302_ID = id("302");
export const ENTRY_0303_ID = id("303");
export const OWN_ENTRY_ID = id("a0010316");

export const EVENT_CREATED_ID = id("ee001");
export const EVENT_ADJUSTED_ID = id("ee002");

export const TECNOLOGIA: DepartmentResponseDto = { id: id("d001"), name: "Tecnologia" };
export const COMUNICACAO: DepartmentResponseDto = { id: id("d002"), name: "Comunicação" };
export const PEDAGOGIA: DepartmentResponseDto = { id: id("d003"), name: "Pedagogia" };

export const PERIOD = "2026-03";
export const FROM = "2026-03-01";
export const TO = "2026-03-31";

/** The coordinator of the Figma: she reviews every entry but her own. */
export function coordinator(): MeResponseDto {
  return buildMeUser({ role: Role.coordinator, id: ANA_ID, name: "Ana Paula Torres" });
}

/** The director of Tecnologia: sees her department, exports, and reviews nothing. */
export function director(): MeResponseDto {
  return buildMeUser({ role: Role.director, id: MARCOS_ID, name: "Marcos Lima" });
}

export function member(): MeResponseDto {
  return buildMeUser({ role: Role.member, id: BEATRIZ_ID, name: "Beatriz Nunes" });
}

function ref(
  personId: string,
  name: string,
  department: DepartmentResponseDto | null,
): MemberRefDto {
  return { id: personId, name, department };
}

export const BEATRIZ = ref(BEATRIZ_ID, "Beatriz Nunes", TECNOLOGIA);
export const RAFAEL = ref(RAFAEL_ID, "Rafael Souza", COMUNICACAO);
export const CARLA = ref(CARLA_ID, "Carla Mendes", PEDAGOGIA);
export const DIEGO = ref(DIEGO_ID, "Diego Alves", TECNOLOGIA);

function memberTotal(
  person: MemberRefDto,
  entries: number,
  declaredMinutes: number,
  pendingEntries = 0,
  pendingMinutes = 0,
): HoursMemberTotalDto {
  return {
    personId: person.id,
    member: person,
    entries,
    declaredMinutes,
    bankMinutes: declaredMinutes - pendingMinutes,
    pendingEntries,
    pendingMinutes,
  };
}

/** The twelve members of the period, the pending ones first, as the API sorts them. */
export function buildMembers(): HoursMemberTotalDto[] {
  const others: Array<[string, string, DepartmentResponseDto | null, number, number]> = [
    ["b005", "Eduarda Lima", PEDAGOGIA, 7, 1560],
    ["b006", "Fábio Rocha", COMUNICACAO, 6, 1440],
    ["b007", "Gabriela Dias", TECNOLOGIA, 6, 1380],
    ["b008", "Henrique Melo", PEDAGOGIA, 6, 1320],
    ["b009", "Isabela Costa", COMUNICACAO, 5, 1200],
    ["b010", "João Pedro Alves", PEDAGOGIA, 5, 1140],
    ["b011", "Larissa Gomes", TECNOLOGIA, 5, 1080],
    ["b012", "Mateus Ribeiro", null, 4, 960],
  ];

  return [
    { ...memberTotal(BEATRIZ, 14, 2760, 2, 480), bankMinutes: 2160 },
    { ...memberTotal(RAFAEL, 11, 2280, 1, 240), bankMinutes: 2040 },
    memberTotal(CARLA, 9, 1920),
    memberTotal(DIEGO, 8, 1680),
    ...others.map(([suffix, name, department, entries, declared]) =>
      memberTotal(ref(id(suffix), name, department), entries, declared),
    ),
  ];
}

function statusTotal(
  status: HourEntryStatus,
  entries: number,
  declaredMinutes: number,
  validatedMinutes: number,
): HoursStatusTotalDto {
  return { status, entries, declaredMinutes, validatedMinutes };
}

function categoryTotal(
  category: HourEntryCategory,
  entries: number,
  declaredMinutes: number,
  pendingMinutes: number,
  bankMinutes: number,
  note: string | null = null,
): HoursCategoryTotalDto {
  return { category, entries, declaredMinutes, pendingMinutes, bankMinutes, note };
}

/** The totals of everyone in March: 312h, 276h, 12h and 24h. */
export function buildOverviewSummary(): HoursSummaryResponseDto {
  return {
    from: FROM,
    to: TO,
    bankMinutes: 16560,
    byStatus: [
      statusTotal(HourEntryStatus.pending, 3, 720, 0),
      statusTotal(HourEntryStatus.approved, 61, 15720, 15720),
      statusTotal(HourEntryStatus.adjusted, 4, 1200, 840),
      statusTotal(HourEntryStatus.rejected, 3, 1080, 0),
    ],
    byCategory: [
      categoryTotal(HourEntryCategory.lesson, 40, 9600, 0, 9600),
      categoryTotal(HourEntryCategory.planning, 12, 4320, 480, 3360),
      categoryTotal(HourEntryCategory.event, 6, 1920, 240, 1440),
      categoryTotal(HourEntryCategory.management, 6, 1440, 0, 1200),
      categoryTotal(HourEntryCategory.meeting, 4, 720, 0, 600),
      categoryTotal(HourEntryCategory.support, 2, 480, 0, 240),
      categoryTotal(HourEntryCategory.other, 1, 240, 0, 120),
    ],
  };
}

/** The totals of Beatriz Nunes in March: 46h, 36h, 8h and 2h. */
export function buildBeatrizSummary(): HoursSummaryResponseDto {
  return {
    from: FROM,
    to: TO,
    bankMinutes: 2160,
    byStatus: [
      statusTotal(HourEntryStatus.pending, 2, 480, 0),
      statusTotal(HourEntryStatus.approved, 11, 2160, 2160),
      statusTotal(HourEntryStatus.adjusted, 0, 0, 0),
      statusTotal(HourEntryStatus.rejected, 1, 120, 0),
    ],
    byCategory: [
      categoryTotal(HourEntryCategory.lesson, 7, 1680, 0, 1680),
      categoryTotal(
        HourEntryCategory.planning,
        2,
        480,
        480,
        0,
        "Aguardando validação da coordenação.",
      ),
      categoryTotal(HourEntryCategory.event, 1, 240, 0, 240),
      categoryTotal(HourEntryCategory.management, 1, 240, 0, 240),
      categoryTotal(HourEntryCategory.meeting, 0, 0, 0, 0),
      categoryTotal(HourEntryCategory.support, 0, 0, 0, 0),
      categoryTotal(HourEntryCategory.other, 1, 120, 0, 0),
    ],
  };
}

/** The totals of Tecnologia, all the director sees: 74h, 64h, 8h and 2h. */
export function buildTecnologiaSummary(): HoursSummaryResponseDto {
  return {
    from: FROM,
    to: TO,
    bankMinutes: 3840,
    byStatus: [
      statusTotal(HourEntryStatus.pending, 2, 480, 0),
      statusTotal(HourEntryStatus.approved, 19, 3840, 3840),
      statusTotal(HourEntryStatus.adjusted, 0, 0, 0),
      statusTotal(HourEntryStatus.rejected, 1, 120, 0),
    ],
    byCategory: [
      categoryTotal(HourEntryCategory.lesson, 15, 3360, 0, 3360),
      categoryTotal(HourEntryCategory.planning, 2, 480, 480, 0),
      categoryTotal(HourEntryCategory.event, 1, 240, 0, 240),
      categoryTotal(HourEntryCategory.management, 1, 240, 0, 240),
      categoryTotal(HourEntryCategory.meeting, 0, 0, 0, 0),
      categoryTotal(HourEntryCategory.support, 0, 0, 0, 0),
      categoryTotal(HourEntryCategory.other, 1, 120, 0, 0),
    ],
  };
}

/** An entry of the queue, pending and logged by the person herself, unless the test says otherwise. */
export function buildEntry(
  overrides: Partial<MemberHourEntryResponseDto> & Pick<MemberHourEntryResponseDto, "id">,
): MemberHourEntryResponseDto {
  const personId = overrides.personId ?? BEATRIZ_ID;
  const createdAt = overrides.createdAt ?? "2026-03-05T22:10:00.000Z";

  return {
    personId,
    member: BEATRIZ,
    date: "2026-03-05",
    activity: "Planejamento de aula — WhatsApp",
    category: HourEntryCategory.planning,
    declaredMinutes: 240,
    origin: HourEntryOrigin.manual,
    createdById: personId,
    createdAt,
    updatedAt: createdAt,
    status: HourEntryStatus.pending,
    validatedMinutes: null,
    reviewNote: null,
    reviewedAt: null,
    reviewedById: null,
    notes: null,
    classId: null,
    lessonId: null,
    ...overrides,
  };
}

/** The three pending entries of March, as the Figma lists them. */
export function buildPendingEntries(): MemberHourEntryResponseDto[] {
  return [
    buildEntry({ id: ENTRY_0503_ID }),
    buildEntry({
      id: ENTRY_1203_ID,
      personId: RAFAEL_ID,
      member: RAFAEL,
      date: "2026-03-12",
      activity: "Feira de tecnologia (evento externo)",
      category: HourEntryCategory.event,
      createdAt: "2026-03-12T20:00:00.000Z",
    }),
    buildEntry({
      id: ENTRY_1403_ID,
      date: "2026-03-14",
      activity: "Planejamento de conteúdo do bimestre",
      createdAt: "2026-03-14T21:42:00.000Z",
    }),
  ];
}

/** The oldest entry of each other status, which the options of the Período read. */
export function buildReviewedEntries(): MemberHourEntryResponseDto[] {
  return [
    buildEntry({
      id: ENTRY_0202_ID,
      date: "2026-02-02",
      activity: "Aula de lógica",
      category: HourEntryCategory.lesson,
      origin: HourEntryOrigin.attendance,
      createdAt: "2026-02-02T15:00:00.000Z",
      status: HourEntryStatus.approved,
      validatedMinutes: 240,
      reviewedAt: "2026-02-03T12:00:00.000Z",
      reviewedById: ANA_ID,
    }),
    buildEntry({
      id: ENTRY_0302_ID,
      personId: CARLA_ID,
      member: CARLA,
      date: "2026-03-02",
      activity: "Reunião pedagógica",
      category: HourEntryCategory.meeting,
      createdAt: "2026-03-02T18:00:00.000Z",
      status: HourEntryStatus.adjusted,
      validatedMinutes: 180,
      reviewNote: "Reunião de 3h.",
      reviewedAt: "2026-03-03T12:00:00.000Z",
      reviewedById: ANA_ID,
    }),
    buildEntry({
      id: ENTRY_0303_ID,
      personId: DIEGO_ID,
      member: DIEGO,
      date: "2026-03-03",
      activity: "Apoio no laboratório",
      category: HourEntryCategory.support,
      createdAt: "2026-03-03T18:00:00.000Z",
      status: HourEntryStatus.rejected,
      validatedMinutes: 0,
      reviewNote: "Sem comprovação.",
      reviewedAt: "2026-03-04T12:00:00.000Z",
      reviewedById: ANA_ID,
    }),
  ];
}

/** A pending entry of the coordinator herself: she cannot review it (SELF_REVIEW_NOT_ALLOWED). */
export function buildOwnEntry(): MemberHourEntryResponseDto {
  return buildEntry({
    id: OWN_ENTRY_ID,
    personId: ANA_ID,
    member: ref(ANA_ID, "Ana Paula Torres", null),
    date: "2026-03-16",
    activity: "Reunião com a direção",
    category: HourEntryCategory.management,
    declaredMinutes: 120,
    createdAt: "2026-03-16T12:00:00.000Z",
  });
}

/** The history of e-1403 before any review: Beatriz logged it. */
export function buildCreatedEvent(entry: MemberHourEntryResponseDto): HourEntryEventResponseDto {
  return {
    id: EVENT_CREATED_ID,
    hourEntryId: entry.id,
    type: HourEntryEventType.created,
    actor: entry.member === null ? null : { id: entry.member.id, name: entry.member.name },
    createdAt: entry.createdAt,
    fromMinutes: null,
    toMinutes: entry.declaredMinutes,
    fromStatus: null,
    toStatus: HourEntryStatus.pending,
    note: null,
  };
}
