import { GetClassParams } from "@api/generated/zod/classes/classes";

const CLASS_NOT_FOUND = "CLASS_NOT_FOUND";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

/**
 * The id of the route comes from the URL, which can be typed by hand or come from an old link. The
 * contract says a class id is a UUID (`GetClassParams`, generated), so anything else cannot exist
 * and there is nothing to ask the API. The same rule as `isCourseId` in the catalog.
 */
export function isClassId(value: string): boolean {
  return GetClassParams.safeParse({ id: value }).success;
}

/**
 * Whether the error of `GET /classes/:id` is the 404 `CLASS_NOT_FOUND` of the contract. It reads
 * the code with the status, as the other error helpers do: a 404 that does not come from the API
 * (a gateway, a route that is not deployed) says nothing about this class, and the person gets the
 * error with "Tentar de novo" instead.
 */
export function isClassNotFound(error: unknown): boolean {
  const { statusCode, error: code }: ApiErrorShape =
    typeof error === "object" && error !== null ? error : {};

  return statusCode === 404 && code === CLASS_NOT_FOUND;
}
