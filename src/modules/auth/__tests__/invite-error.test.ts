import { describe, expect, it } from "vitest";

import { toAcceptFieldError, toInviteErrorKey } from "../lib/invite-error";

function apiError(statusCode: number, error?: string) {
  return Object.assign(new Error("api error"), { statusCode, error });
}

describe("toInviteErrorKey", () => {
  it("maps 400 INVALID_INVITE (missing, used, revoked or expired link)", () => {
    expect(toInviteErrorKey(apiError(400, "INVALID_INVITE"))).toBe("invalidInvite");
  });

  it("maps 409 RA_ALREADY_IN_USE to raInUse", () => {
    expect(toInviteErrorKey(apiError(409, "RA_ALREADY_IN_USE"))).toBe("raInUse");
  });

  it("maps 409 EMAIL_ALREADY_IN_USE to emailInUse", () => {
    expect(toInviteErrorKey(apiError(409, "EMAIL_ALREADY_IN_USE"))).toBe("emailInUse");
  });

  it("maps a network failure (fetch rejects with a TypeError)", () => {
    expect(toInviteErrorKey(new TypeError("Failed to fetch"))).toBe("network");
  });

  it.each([502, 503, 504])("maps a %i gateway error to network", (statusCode) => {
    expect(toInviteErrorKey(apiError(statusCode))).toBe("network");
  });

  it("maps a gateway error to network even when its error field is not a code of the invite", () => {
    expect(toInviteErrorKey(apiError(502, "Bad Gateway"))).toBe("network");
    expect(toInviteErrorKey(apiError(503, "SERVICE_UNAVAILABLE"))).toBe("network");
    expect(toInviteErrorKey(apiError(504, "GATEWAY_TIMEOUT"))).toBe("network");
  });

  it.each([
    ["INVALID_INVITE", "invalidInvite"],
    ["RA_ALREADY_IN_USE", "raInUse"],
    ["EMAIL_ALREADY_IN_USE", "emailInUse"],
  ])("keeps the known code %s even when the status is a gateway error", (code, expected) => {
    for (const statusCode of [502, 503, 504]) {
      expect(toInviteErrorKey(apiError(statusCode, code))).toBe(expected);
    }
  });

  it.each([500, 501, 505])(
    "keeps a %i as unknown: the API answered, it is not a connection failure",
    (statusCode) => {
      expect(toInviteErrorKey(apiError(statusCode))).toBe("unknown");
    },
  );

  it("does not confuse an invite code with the login codes", () => {
    expect(toInviteErrorKey(apiError(401, "INVALID_CREDENTIALS"))).toBe("unknown");
    expect(toInviteErrorKey(apiError(429, "TOO_MANY_ATTEMPTS"))).toBe("unknown");
  });

  it("maps an error payload without the error code to unknown", () => {
    expect(toInviteErrorKey({ statusCode: 400, message: "Bad request." })).toBe("unknown");
    expect(toInviteErrorKey(apiError(409))).toBe("unknown");
  });

  it("maps a 502 answered with an HTML page (no error code) to network", () => {
    const proxyError = Object.assign(new Error("Bad Gateway"), { statusCode: 502 });

    expect(toInviteErrorKey(proxyError)).toBe("network");
  });

  it.each([
    ["a server error", apiError(500, "Internal Server Error")],
    ["a validation error", apiError(400, "VALIDATION_FAILED")],
    ["an unrelated Error", new Error("boom")],
    ["undefined", undefined],
    ["null", null],
    ["a loose string", "INVALID_INVITE"],
    ["an empty object", {}],
  ])("falls back to unknown for %s", (_label, error) => {
    expect(toInviteErrorKey(error)).toBe("unknown");
  });
});

describe("toAcceptFieldError", () => {
  it("points RA_ALREADY_IN_USE at the RA field", () => {
    expect(toAcceptFieldError("raInUse")).toBe("ra");
  });

  it("points EMAIL_ALREADY_IN_USE at the email field", () => {
    expect(toAcceptFieldError("emailInUse")).toBe("email");
  });

  it.each(["invalidInvite", "network", "unknown"] as const)(
    "does not point %s at any field",
    (key) => {
      expect(toAcceptFieldError(key)).toBeNull();
    },
  );
});
