import { describe, expect, it } from "vitest";

import { ClassStatus } from "@api/generated/model";

import { CLASS_STATUS_LABEL_KEYS, classStatusTone } from "../lib/class-status";

describe("CLASS_STATUS_LABEL_KEYS", () => {
  it("has a label key for every status of the contract", () => {
    expect(Object.keys(CLASS_STATUS_LABEL_KEYS).sort()).toEqual(Object.values(ClassStatus).sort());
  });

  it("points the status of the API (in_progress) to the key of the locale (inProgress)", () => {
    expect(CLASS_STATUS_LABEL_KEYS[ClassStatus.in_progress]).toBe("inProgress");
    expect(CLASS_STATUS_LABEL_KEYS[ClassStatus.planned]).toBe("planned");
  });
});

describe("classStatusTone", () => {
  it.each([
    [ClassStatus.planned, "warning"],
    [ClassStatus.in_progress, "info"],
    [ClassStatus.completed, "neutral"],
    [ClassStatus.cancelled, "danger"],
  ] as const)("%s is a %s tag", (status, tone) => {
    expect(classStatusTone(status)).toBe(tone);
  });
});
