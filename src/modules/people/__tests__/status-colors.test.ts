import { describe, expect, it } from "vitest";

import { accountStatusOf } from "../lib/status-colors";

describe("accountStatusOf", () => {
  it("is active while the access is enabled", () => {
    expect(accountStatusOf(true)).toBe("active");
  });

  it("is inactive once the access is revoked", () => {
    expect(accountStatusOf(false)).toBe("inactive");
  });
});
