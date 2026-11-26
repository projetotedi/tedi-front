import { AccessibilityNeed, type StudentDetailDto } from "@api/generated/model";
import { GetStudentParams } from "@api/generated/zod/people/people";

const STUDENT_NOT_FOUND = "STUDENT_NOT_FOUND";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

/**
 * The id of the route comes from the URL, which can be typed by hand or come from an old link. The
 * contract says the id of a student is a UUID (`GetStudentParams`, generated), so anything else
 * cannot exist and there is nothing to ask the API.
 */
export function isStudentId(value: string): boolean {
  return GetStudentParams.safeParse({ id: value }).success;
}

/**
 * Whether the error of `GET /students/:id` is the 404 `STUDENT_NOT_FOUND` of the contract (an id
 * that does not exist, is malformed or belongs to a person with no student profile). It reads the
 * code together with the status: a 404 that does not come from the API (a gateway, a route that
 * is not deployed) says nothing about this student, and the person gets the error with "Tentar de
 * novo" instead.
 */
export function isStudentNotFound(error: unknown): boolean {
  const { statusCode, error: code }: ApiErrorShape =
    typeof error === "object" && error !== null ? error : {};

  return statusCode === 404 && code === STUDENT_NOT_FOUND;
}

function hasText(value: string | null): boolean {
  return value !== null && value.trim() !== "";
}

type AccessibilityFields = Pick<
  StudentDetailDto,
  "accessibilityNeed" | "classNeeds" | "supportResource"
>;

/**
 * Whether the registration says anything about accessibility: a category other than `none`, or any
 * text in what the person needs in class or in the support resource. When it does not, the table
 * of accessibility needs has no row. A `none` category with text written still has one: dropping
 * it would hide what the coordination typed.
 */
export function hasAccessibilityRecord(student: AccessibilityFields): boolean {
  return (
    student.accessibilityNeed !== AccessibilityNeed.none ||
    hasText(student.classNeeds) ||
    hasText(student.supportResource)
  );
}

const MIN_BIRTH_DATE = "1900-01-01";
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "Today" in America/Sao_Paulo as `YYYY-MM-DD`, the day the API compares the birth date with. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** The rule of the API for a birth date: a real day, from 1900-01-01 up to today. */
export function isValidBirthDate(value: string, now: Date = new Date()): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isReal && value >= MIN_BIRTH_DATE && value <= todayInSaoPaulo(now);
}

/** Whole years between the birth date and today in America/Sao_Paulo, as the API counts them. */
export function ageOn(birthDate: string, now: Date = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = todayInSaoPaulo(now).split("-").map(Number);
  const hadBirthday = todayMonth > month || (todayMonth === month && todayDay >= day);
  return todayYear - year - (hadBirthday ? 0 : 1);
}
