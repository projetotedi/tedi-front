import { ListCourseClassesParams } from "@api/generated/zod/classes/classes";

/**
 * Whether `value` can be the id of a course for the API. The contract says it is a UUID
 * (`ListCourseClassesParams`, generated), so anything else cannot exist and there is nothing to ask
 * the API: the screens that read a course by its id skip the request.
 */
export function isUuid(value: string): boolean {
  return ListCourseClassesParams.safeParse({ id: value }).success;
}
