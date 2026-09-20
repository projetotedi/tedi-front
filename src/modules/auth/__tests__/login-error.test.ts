import { describe, expect, it } from "vitest";

import { toLoginErrorKey } from "../lib/login-error";

function apiError(statusCode: number, error?: string) {
  return Object.assign(new Error("api error"), { statusCode, error });
}

describe("toLoginErrorKey", () => {
  it("maps INVALID_CREDENTIALS", () => {
    expect(toLoginErrorKey(apiError(401, "INVALID_CREDENTIALS"))).toBe("invalidCredentials");
  });

  it("maps ACCESS_DISABLED, which is also a 401, by its code and not by its status", () => {
    expect(toLoginErrorKey(apiError(401, "ACCESS_DISABLED"))).toBe("accessDisabled");
  });

  it("maps 429", () => {
    expect(toLoginErrorKey(apiError(429, "TOO_MANY_ATTEMPTS"))).toBe("tooManyAttempts");
  });

  it("maps a 429 without the TOO_MANY_ATTEMPTS code", () => {
    expect(toLoginErrorKey(apiError(429, "Too Many Requests"))).toBe("tooManyAttempts");
    expect(toLoginErrorKey(apiError(429))).toBe("tooManyAttempts");
  });

  it("maps the TOO_MANY_ATTEMPTS code whatever the status", () => {
    expect(toLoginErrorKey(apiError(403, "TOO_MANY_ATTEMPTS"))).toBe("tooManyAttempts");
  });

  it("prefers the rate-limit message over the credentials one", () => {
    expect(toLoginErrorKey(apiError(429, "INVALID_CREDENTIALS"))).toBe("tooManyAttempts");
  });

  it("maps a network failure (fetch rejects with a TypeError)", () => {
    expect(toLoginErrorKey(new TypeError("Failed to fetch"))).toBe("network");
  });

  it.each([502, 503, 504])("maps a %i gateway error to network", (statusCode) => {
    expect(toLoginErrorKey(apiError(statusCode))).toBe("network");
  });

  it("maps a gateway error to network even when its error field is not a code of the login", () => {
    expect(toLoginErrorKey(apiError(502, "Bad Gateway"))).toBe("network");
    expect(toLoginErrorKey(apiError(503, "SERVICE_UNAVAILABLE"))).toBe("network");
    expect(toLoginErrorKey(apiError(504, "GATEWAY_TIMEOUT"))).toBe("network");
  });

  it.each([
    ["INVALID_CREDENTIALS", "invalidCredentials"],
    ["ACCESS_DISABLED", "accessDisabled"],
    ["TOO_MANY_ATTEMPTS", "tooManyAttempts"],
  ])("keeps the known code %s even when the status is a gateway error", (code, expected) => {
    for (const statusCode of [502, 503, 504]) {
      expect(toLoginErrorKey(apiError(statusCode, code))).toBe(expected);
    }
  });

  it.each([500, 501, 505])(
    "keeps a %i as unknown: the API answered, it is not a connection failure",
    (statusCode) => {
      expect(toLoginErrorKey(apiError(statusCode))).toBe("unknown");
    },
  );

  it.each([
    ["a server error", apiError(500, "Internal Server Error")],
    ["a validation error", apiError(400, "Bad Request")],
    ["a 401 without a known code", apiError(401)],
    ["an unrelated Error", new Error("boom")],
    ["undefined", undefined],
    ["null", null],
    ["a loose string", "INVALID_CREDENTIALS"],
    ["an empty object", {}],
  ])("falls back to unknown for %s", (_label, error) => {
    expect(toLoginErrorKey(error)).toBe("unknown");
  });
});
