import { describe, expect, it } from "vitest";

import { toRequestErrorKey } from "../lib/request-error";

function apiError(statusCode: number, error?: string) {
  return Object.assign(new Error("api error"), { statusCode, error });
}

describe("toRequestErrorKey", () => {
  it("maps a network failure (fetch rejects with a TypeError)", () => {
    expect(toRequestErrorKey(new TypeError("Failed to fetch"))).toBe("network");
  });

  it.each([502, 503, 504])("maps a %i gateway error to network", (statusCode) => {
    expect(toRequestErrorKey(apiError(statusCode))).toBe("network");
  });

  it("maps a common 500 to unknown: the API answered, it is not a connection failure", () => {
    expect(toRequestErrorKey(apiError(500))).toBe("unknown");
  });

  it.each([
    ["an unrelated Error", new Error("boom")],
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
  ])("falls back to unknown for %s", (_label, error) => {
    expect(toRequestErrorKey(error)).toBe("unknown");
  });
});
