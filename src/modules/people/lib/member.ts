import { GetMemberParams } from "@api/generated/zod/people/people";

const MEMBER_NOT_FOUND = "MEMBER_NOT_FOUND";
const FORBIDDEN_CODES: readonly unknown[] = ["FORBIDDEN", "FORBIDDEN_SCOPE"];

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

function readApiError(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? error : {};
}

/**
 * The id of the route comes from the URL, which can be typed by hand or come from an old link. The
 * contract says the id of a member is a UUID (`GetMemberParams`, generated), so anything else
 * cannot exist and there is nothing to ask the API. `me` is not one either: the profile of the
 * person who is signed in lives at `/profile`.
 */
export function isMemberId(value: string): boolean {
  return GetMemberParams.safeParse({ id: value }).success;
}

/**
 * Whether the error of `GET /members/:id` is the 404 `MEMBER_NOT_FOUND` of the contract (an id that
 * does not exist). It reads the code together with the status: a 404 that does not come from the
 * API (a gateway, a route that is not deployed) says nothing about this member, and the person
 * gets the error with "Tentar de novo" instead.
 */
export function isMemberNotFound(error: unknown): boolean {
  const { statusCode, error: code } = readApiError(error);

  return statusCode === 404 && code === MEMBER_NOT_FOUND;
}

/**
 * Whether the error of `GET /members/:id` is the 403 of the contract: `FORBIDDEN` (the profile has
 * no `members.view`) or `FORBIDDEN_SCOPE` (it has, but the member is outside its scope, e.g. a
 * director opening a member of another department). A 403 with no code did not come from the API.
 */
export function isMemberForbidden(error: unknown): boolean {
  const { statusCode, error: code } = readApiError(error);

  return statusCode === 403 && FORBIDDEN_CODES.includes(code);
}
