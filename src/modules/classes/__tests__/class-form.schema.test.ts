import { describe, expect, it } from "vitest";

import { ClassStatus } from "@api/generated/model";

import {
  classFormSchema,
  emptyClassFormValues,
  toClassFormValues,
  toCreateClassBody,
  toUpdateClassBody,
  type ClassFormValues,
} from "../schemas/class-form.schema";
import { buildClassDetail, COURSE_ID } from "./handlers";

const VALID: ClassFormValues = {
  courseId: COURSE_ID,
  code: " INFO-B ",
  edition: "2026.2",
  start: "2026-03-03",
  end: "2026-06-27",
  location: "",
  capacity: "20",
  status: ClassStatus.planned,
};

const messages = (values: ClassFormValues) =>
  classFormSchema.safeParse(values).error?.issues.map((issue) => [issue.path[0], issue.message]) ??
  [];

describe("class-form.schema", () => {
  it("accepts a class as the API takes it", () => {
    expect(messages(VALID)).toEqual([]);
  });

  it.each([
    [{ edition: "2026" }, "edition", "invalidEdition"],
    [{ edition: "2026.0" }, "edition", "invalidEdition"],
    [{ capacity: "0" }, "capacity", "invalidCapacity"],
    [{ capacity: "dez" }, "capacity", "invalidCapacity"],
    [{ capacity: "1001" }, "capacity", "capacityTooHigh"],
    [{ end: "2026-03-02" }, "end", "invalidPeriod"],
    [{ code: "   " }, "code", "required"],
  ])("refuses %o on %s", (change, field, message) => {
    expect(messages({ ...VALID, ...change })).toContainEqual([field, message]);
  });

  it("starts a new class planned, with the course given", () => {
    expect(emptyClassFormValues(COURSE_ID)).toMatchObject({
      courseId: COURSE_ID,
      status: ClassStatus.planned,
      capacity: "",
    });
  });

  it("builds the body of createClass, without an empty location", () => {
    expect(toCreateClassBody(VALID)).toEqual({
      courseId: COURSE_ID,
      code: "INFO-B",
      editionName: "2026.2",
      startDate: "2026-03-03",
      endDate: "2026-06-27",
      capacity: 20,
      status: ClassStatus.planned,
    });
  });

  it("sends in updateClass only what changed", () => {
    const initial = toClassFormValues(buildClassDetail());

    expect(toUpdateClassBody(initial, initial)).toEqual({});
    expect(
      toUpdateClassBody({ ...initial, edition: "2026.2", location: "  ", capacity: "16" }, initial),
    ).toEqual({ editionName: "2026.2", location: null, capacity: 16 });
  });
});
