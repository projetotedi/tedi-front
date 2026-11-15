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
