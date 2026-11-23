/**
 * Formatação só para exibir o cadastro que o membro enviou: CPF e telefone chegam só com dígitos e
 * as datas chegam em ISO. Data de calendário ("2004-05-22") nunca passa por `new Date("YYYY-MM-DD")`:
 * o JavaScript a lê como UTC meia-noite e o fuso do navegador a empurraria para o dia anterior.
 */

/** Fuso do back para "hoje" e para o horário que a coordenação enxerga. */
export const APP_TIME_ZONE = "America/Sao_Paulo";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ONLY_DIGITS = /^\d+$/;
const CPF_DIGITS = 11;
const BRAZIL_COUNTRY_CODE = "55";
/** DDD + 8 dígitos (fixo) ou DDD + 9 dígitos (celular). */
const LANDLINE_DIGITS = 10;
const MOBILE_DIGITS = 11;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function parseIsoDate(value: string): CalendarDate | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function isValidInstant(instant: Date): boolean {
  return !Number.isNaN(instant.getTime());
}

/**
 * Dia do calendário de `instant` em `APP_TIME_ZONE`, como YYYY-MM-DD (que ordena como texto). O
 * formatador nasce a cada chamada, e não ao importar o módulo: um ambiente sem o fuso derrubaria
 * a tela inteira em vez de só esta data.
 */
function calendarDateInAppTimeZone(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** "Hoje" em `APP_TIME_ZONE`, como YYYY-MM-DD. `now` existe para os testes. */
export function todayInAppTimeZone(now: Date = new Date()): string {
  return calendarDateInAppTimeZone(now);
}

/**
 * Dia do calendário, em `APP_TIME_ZONE`, de um instante ISO ("2026-09-19T02:00:00.000Z" ainda é
 * 18/09 em São Paulo). `null` quando o texto não é uma data.
 */
export function toAppCalendarDate(isoDateTime: string): string | null {
  const instant = new Date(isoDateTime);
  return isValidInstant(instant) ? calendarDateInAppTimeZone(instant) : null;
}

/** Se o texto é uma data de calendário que existe: recusa 2026-02-30, que `Date.UTC` empurraria para março. */
export function isCalendarDate(value: string): boolean {
  const date = parseIsoDate(value);
  if (!date) return false;

  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return (
    instant.getUTCFullYear() === date.year &&
    instant.getUTCMonth() === date.month - 1 &&
    instant.getUTCDate() === date.day
  );
}

/** "2004-05-22" como a data local ("22/05/2004"). O que não é YYYY-MM-DD volta como veio. */
export function formatCalendarDate(isoDate: string, locale: string): string {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;

  // UTC dos dois lados: nenhum fuso entra na conta de uma data que não tem hora.
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instant);
}

/** Quando o membro enviou o cadastro, na hora de `APP_TIME_ZONE` ("18/09/2026, 14:32"). */
export function formatSubmittedAt(isoDateTime: string, locale: string): string {
  const instant = new Date(isoDateTime);
  if (!isValidInstant(instant)) return isoDateTime;

  const date = new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instant);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
  // Montado à mão: o separador entre data e hora varia com a versão do ICU.
  return `${date}, ${time}`;
}

/**
 * Idade completa em `today` (as duas datas em YYYY-MM-DD). `null` quando alguma não é data ou
 * quando a data de nascimento está no futuro.
 */
export function ageOn(birthDate: string, today: string): number | null {
  const birth = parseIsoDate(birthDate);
  const now = parseIsoDate(today);
  if (!birth || !now) return null;

  const hadBirthday =
    now.month > birth.month || (now.month === birth.month && now.day >= birth.day);
  const age = now.year - birth.year - (hadBirthday ? 0 : 1);
  return age >= 0 ? age : null;
}

/** 11 dígitos como 000.000.000-00. O que não tem 11 dígitos volta como veio. */
export function formatCpfForDisplay(cpf: string): string {
  if (cpf.length !== CPF_DIGITS || !ONLY_DIGITS.test(cpf)) return cpf;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

/**
 * (00) 0000-0000 ou (00) 00000-0000. Com 12 ou 13 dígitos e começando por 55, tira o DDI do
 * Brasil (sem o DDI o número nacional nunca passa de 11 dígitos, então o "55" de 12 dígitos não
 * é o DDD de Santa Maria). O que não cabe nesses formatos volta como veio.
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!ONLY_DIGITS.test(phone)) return phone;

  const hasCountryCode =
    phone.startsWith(BRAZIL_COUNTRY_CODE) &&
    (phone.length === LANDLINE_DIGITS + BRAZIL_COUNTRY_CODE.length ||
      phone.length === MOBILE_DIGITS + BRAZIL_COUNTRY_CODE.length);
  const national = hasCountryCode ? phone.slice(BRAZIL_COUNTRY_CODE.length) : phone;
  if (national.length !== LANDLINE_DIGITS && national.length !== MOBILE_DIGITS) return phone;

  const areaCode = national.slice(0, 2);
  const subscriber = national.slice(2);
  const split = national.length === MOBILE_DIGITS ? 5 : 4;
  return `(${areaCode}) ${subscriber.slice(0, split)}-${subscriber.slice(split)}`;
}
