import { describe, expect, it } from "vitest";

import { MemberRegistrationStatus, MemberStatus } from "@api/generated/model";

import {
  isActiveApprovedMember,
  isMemberForbidden,
  isMemberId,
  isMemberNotFound,
} from "../lib/member";
import { MEMBER_ID } from "./handlers";

function apiError(statusCode: number, error?: string) {
  return Object.assign(new Error(error ?? String(statusCode)), { statusCode, error });
}

describe("isMemberId", () => {
  it.each([
    ["a UUID v7, which is what the API generates", MEMBER_ID],
    ["a UUID v4", "3b241101-e2bb-4255-8caf-4136c566a962"],
    ["a UUID in upper case", MEMBER_ID.toUpperCase()],
  ])("accepts %s", (_label, id) => {
    expect(isMemberId(id)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["me, the profile of who is signed in", "me"],
    ["a number", "1"],
    ["a UUID with spaces around it", ` ${MEMBER_ID} `],
    ["a UUID followed by a path", `${MEMBER_ID}/hours`],
    ["a UUID with a missing digit", MEMBER_ID.slice(0, -1)],
  ])("rejects %s", (_label, id) => {
    expect(isMemberId(id)).toBe(false);
  });
});

describe("isMemberNotFound", () => {
  it("is true for the 404 MEMBER_NOT_FOUND of the contract", () => {
    expect(isMemberNotFound(apiError(404, "MEMBER_NOT_FOUND"))).toBe(true);
  });

  it.each([
    ["a 404 that is not from the API (no code)", apiError(404)],
    ["a 404 of another resource", apiError(404, "STUDENT_NOT_FOUND")],
    ["the code with another status", apiError(500, "MEMBER_NOT_FOUND")],
    ["400 VALIDATION_FAILED", apiError(400, "VALIDATION_FAILED")],
    ["403 FORBIDDEN_SCOPE", apiError(403, "FORBIDDEN_SCOPE")],
    ["500", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["a request that never got an answer", new TypeError("Failed to fetch")],
    ["a string", "MEMBER_NOT_FOUND"],
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
  ])("is false for %s", (_label, error) => {
    expect(isMemberNotFound(error)).toBe(false);
  });
});

describe("isMemberForbidden", () => {
  it.each([
    ["FORBIDDEN, the profile has no members.view", "FORBIDDEN"],
    ["FORBIDDEN_SCOPE, the member is outside the scope", "FORBIDDEN_SCOPE"],
  ])("is true for the 403 %s", (_label, code) => {
    expect(isMemberForbidden(apiError(403, code))).toBe(true);
  });

  it.each([
    ["a 403 that is not from the API (no code)", apiError(403)],
    ["a 403 with the code of another error", apiError(403, "SELF_ATTENDANCE_NOT_ALLOWED")],
    ["the code with another status", apiError(401, "FORBIDDEN_SCOPE")],
    ["404 MEMBER_NOT_FOUND", apiError(404, "MEMBER_NOT_FOUND")],
    ["500", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["a request that never got an answer", new TypeError("Failed to fetch")],
    ["a string", "FORBIDDEN"],
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
  ])("is false for %s", (_label, error) => {
    expect(isMemberForbidden(error)).toBe(false);
  });
});

describe("isActiveApprovedMember", () => {
  it("is true for an approved registration of someone still in the project", () => {
    expect(
      isActiveApprovedMember({
        status: MemberStatus.active,
        registrationStatus: MemberRegistrationStatus.approved,
      }),
    ).toBe(true);
  });

  it.each([
    ["an inactive member", MemberStatus.inactive, MemberRegistrationStatus.approved],
    [
      "a registration waiting for validation",
      MemberStatus.active,
      MemberRegistrationStatus.pending,
    ],
    ["a refused registration", MemberStatus.active, MemberRegistrationStatus.rejected],
    ["a person with no registration (the seeded coordinator)", MemberStatus.active, null],
  ])("is false for %s", (_label, status, registrationStatus) => {
    expect(isActiveApprovedMember({ status, registrationStatus })).toBe(false);
  });
});
