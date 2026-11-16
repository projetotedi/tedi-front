import { describe, expect, it } from "vitest";

import { ClassStatus } from "@api/generated/model";

import { CLASS_STATUS_TONE } from "../lib/class-status";

describe("CLASS_STATUS_TONE", () => {
  it("has a tone for every status of the contract", () => {
    expect(Object.keys(CLASS_STATUS_TONE).sort()).toEqual(Object.values(ClassStatus).sort());
  });

  it("is blue when planned, green when in progress, grey when completed and red when cancelled", () => {
    expect(CLASS_STATUS_TONE).toEqual({
      planned: "info",
      in_progress: "success",
      completed: "neutral",
      cancelled: "danger",
    });
  });
});
