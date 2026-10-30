import { describe, expect, it } from "vitest";

import { toAccessActionErrorKey, toInviteActionErrorKey } from "../lib/access-action-error";

function apiError(statusCode: number, error: string) {
  return { statusCode, error, message: error };
}

describe("toAccessActionErrorKey", () => {
  it("409 LAST_COORDINATOR -> lastCoordinator", () => {
    expect(toAccessActionErrorKey(apiError(409, "LAST_COORDINATOR"))).toBe("lastCoordinator");
  });

  it("403 OWN_ACCOUNT -> ownAccount", () => {
    expect(toAccessActionErrorKey(apiError(403, "OWN_ACCOUNT"))).toBe("ownAccount");
  });

  it("404 NOT_FOUND -> notFound", () => {
    expect(toAccessActionErrorKey(apiError(404, "NOT_FOUND"))).toBe("notFound");
  });

  it("409 INVITE_ALREADY_USED -> inviteGone", () => {
    expect(toAccessActionErrorKey(apiError(409, "INVITE_ALREADY_USED"))).toBe("inviteGone");
  });

  it("409 INVITE_ALREADY_REVOKED -> inviteGone", () => {
    expect(toAccessActionErrorKey(apiError(409, "INVITE_ALREADY_REVOKED"))).toBe("inviteGone");
  });

  it("a fetch failure (TypeError) -> network", () => {
    expect(toAccessActionErrorKey(new TypeError("Failed to fetch"))).toBe("network");
  });

  it.each([502, 503, 504])("gateway status %i -> network", (statusCode) => {
    expect(toAccessActionErrorKey(apiError(statusCode, "BAD_GATEWAY"))).toBe("network");
  });

  it("any other error -> unknown", () => {
    expect(toAccessActionErrorKey(apiError(500, "INTERNAL_SERVER_ERROR"))).toBe("unknown");
    expect(toAccessActionErrorKey(apiError(400, "INVALID_ROLE"))).toBe("unknown");
    expect(toAccessActionErrorKey(new Error("boom"))).toBe("unknown");
    expect(toAccessActionErrorKey(null)).toBe("unknown");
    expect(toAccessActionErrorKey(undefined)).toBe("unknown");
  });

  it("reads the code, not the human message", () => {
    expect(
      toAccessActionErrorKey({
        statusCode: 409,
        error: "SOMETHING_ELSE",
        message: "LAST_COORDINATOR",
      }),
    ).toBe("unknown");
  });
});

describe("toInviteActionErrorKey", () => {
  it("a 404 means the invite is gone, not that the access is", () => {
    expect(toInviteActionErrorKey(apiError(404, "NOT_FOUND"))).toBe("inviteGone");
  });

  it("keeps the other mappings", () => {
    expect(toInviteActionErrorKey(apiError(409, "INVITE_ALREADY_USED"))).toBe("inviteGone");
    expect(toInviteActionErrorKey(apiError(409, "INVITE_ALREADY_REVOKED"))).toBe("inviteGone");
    expect(toInviteActionErrorKey(new TypeError("Failed to fetch"))).toBe("network");
    expect(toInviteActionErrorKey(apiError(500, "INTERNAL_SERVER_ERROR"))).toBe("unknown");
  });
});
