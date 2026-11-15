import { describe, expect, it } from "vitest";

import {
  ACCOUNT_STATUS_COLOR,
  STUDENT_STATUS_COLOR,
  accountStatusOf,
  studentStatusOf,
} from "../lib/status-colors";

describe("accountStatusOf", () => {
  it("is active while the access is enabled", () => {
    expect(accountStatusOf(true)).toBe("active");
  });

  it("is inactive once the access is revoked", () => {
    expect(accountStatusOf(false)).toBe("inactive");
  });

  it("colors an active account green and an inactive one neutral", () => {
    expect(ACCOUNT_STATUS_COLOR.active).toBe("success");
    expect(ACCOUNT_STATUS_COLOR.inactive).toBe("neutral");
  });
});

describe("studentStatusOf", () => {
  it("is active while the student has no date of archiving", () => {
    expect(studentStatusOf(null)).toBe("active");
  });

  it("is archived once the student has a date of archiving", () => {
    expect(studentStatusOf("2026-10-10T13:00:00.000Z")).toBe("archived");
  });

  it("colors an active student green and an archived one neutral", () => {
    expect(STUDENT_STATUS_COLOR.active).toBe("success");
    expect(STUDENT_STATUS_COLOR.archived).toBe("neutral");
  });
});
