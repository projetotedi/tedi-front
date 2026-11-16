import { describe, expect, it } from "vitest";

import { Weekday } from "@api/generated/model";

import {
  GENERATE_LESSONS_LIMITS,
  generateLessonsFormSchema,
  toGenerateClassLessonsBody,
  toPreviewBody,
  type GenerateLessonsFormInput,
} from "../schemas/generate-lessons.schema";

const VALID: GenerateLessonsFormInput = {
  weekday: Weekday.tuesday,
  startTime: "09:00",
  endTime: "11:00",
  firstDate: "2026-04-07",
  location: "Laboratório 2 — Bloco B",
};

/** The messages (keys of `generate.fieldErrors`) of a form, by the field they are on. */
function errorsOf(input: GenerateLessonsFormInput): Record<string, string> {
  const result = generateLessonsFormSchema.safeParse(input);
  if (result.success) return {};

  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("generateLessonsFormSchema", () => {
  it("accepts the form of the Figma", () => {
    expect(generateLessonsFormSchema.safeParse(VALID).success).toBe(true);
  });

  it("accepts every day of the week", () => {
    for (const weekday of Object.values(Weekday)) {
      expect(generateLessonsFormSchema.safeParse({ ...VALID, weekday }).success).toBe(true);
    }
  });

  it("asks for the weekday while it is empty, which is how the field starts", () => {
    expect(errorsOf({ ...VALID, weekday: "" })).toEqual({ weekday: "weekdayRequired" });
  });

  it.each([
    ["an empty time", ""],
    ["a time with seconds", "09:00:00"],
    ["an hour of 24 or more", "24:00"],
    ["minutes of 60 or more", "09:60"],
    ["a time without the zero", "9:00"],
    ["a word", "morning"],
  ])("refuses %s as the start time", (_label, startTime) => {
    expect(errorsOf({ ...VALID, startTime, endTime: "23:59" })).toEqual({
      startTime: "startTimeInvalid",
    });
  });

  it.each([
    ["an empty time", ""],
    ["a time with seconds", "11:00:00"],
    ["an hour of 24 or more", "24:00"],
    ["a word", "noon"],
  ])("refuses %s as the end time", (_label, endTime) => {
    expect(errorsOf({ ...VALID, endTime })).toEqual({ endTime: "endTimeInvalid" });
  });

  it("accepts the whole day, from 00:00 to 23:59", () => {
    expect(
      generateLessonsFormSchema.safeParse({ ...VALID, startTime: "00:00", endTime: "23:59" })
        .success,
    ).toBe(true);
  });

  it("refuses an end time equal to the start time: a lesson has some length", () => {
    expect(errorsOf({ ...VALID, startTime: "09:00", endTime: "09:00" })).toEqual({
      endTime: "endTimeBeforeStart",
    });
  });

  it("refuses an end time before the start time, on the end time field", () => {
    expect(errorsOf({ ...VALID, startTime: "11:00", endTime: "09:00" })).toEqual({
      endTime: "endTimeBeforeStart",
    });
  });

  it("does not compare the times while one of them is not a time yet", () => {
    expect(errorsOf({ ...VALID, startTime: "09:00", endTime: "" })).toEqual({
      endTime: "endTimeInvalid",
    });
    expect(errorsOf({ ...VALID, startTime: "", endTime: "09:00" })).toEqual({
      startTime: "startTimeInvalid",
    });
  });

  it.each([
    ["an empty date", ""],
    ["a date in the wrong order", "07/04/2026"],
    ["a day that does not exist", "2026-02-31"],
    ["an instant", "2026-04-07T09:00:00Z"],
  ])("refuses %s as the first date", (_label, firstDate) => {
    expect(errorsOf({ ...VALID, firstDate })).toEqual({ firstDate: "firstDateInvalid" });
  });

  it("takes the limit of the location from the contract: 200 characters", () => {
    expect(GENERATE_LESSONS_LIMITS.locationMax).toBe(200);
  });

  it("accepts a location of exactly 200 characters, and an empty one", () => {
    const exact = "a".repeat(GENERATE_LESSONS_LIMITS.locationMax);

    expect(generateLessonsFormSchema.safeParse({ ...VALID, location: exact }).success).toBe(true);
    expect(generateLessonsFormSchema.safeParse({ ...VALID, location: "" }).success).toBe(true);
  });

  it("refuses a location of 201 characters", () => {
    const tooLong = "a".repeat(GENERATE_LESSONS_LIMITS.locationMax + 1);

    expect(errorsOf({ ...VALID, location: tooLong })).toEqual({ location: "locationTooLong" });
  });

  it("counts the location without the spaces around it", () => {
    const padded = ` ${"a".repeat(GENERATE_LESSONS_LIMITS.locationMax)} `;

    expect(generateLessonsFormSchema.safeParse({ ...VALID, location: padded }).success).toBe(true);
  });

  it("reports every field that is wrong at once", () => {
    expect(
      errorsOf({ weekday: "", startTime: "", endTime: "", firstDate: "", location: "" }),
    ).toEqual({
      weekday: "weekdayRequired",
      startTime: "startTimeInvalid",
      endTime: "endTimeInvalid",
      firstDate: "firstDateInvalid",
    });
  });
});

describe("toGenerateClassLessonsBody", () => {
  it("sends the five fields of the contract and nothing else", () => {
    const values = generateLessonsFormSchema.parse(VALID);

    expect(toGenerateClassLessonsBody(values)).toEqual({
      weekday: "tuesday",
      startTime: "09:00",
      endTime: "11:00",
      firstDate: "2026-04-07",
      location: "Laboratório 2 — Bloco B",
    });
  });

  it("sends a blank location as null, which the API reads as not informed", () => {
    const values = generateLessonsFormSchema.parse({ ...VALID, location: "   " });

    expect(toGenerateClassLessonsBody(values).location).toBeNull();
  });

  it("sends the location without the spaces around it", () => {
    const values = generateLessonsFormSchema.parse({ ...VALID, location: "  Sala 3  " });

    expect(toGenerateClassLessonsBody(values).location).toBe("Sala 3");
  });
});

describe("toPreviewBody", () => {
  it("is the same body that Gerar aulas sends", () => {
    const values = generateLessonsFormSchema.parse(VALID);

    expect(toPreviewBody(VALID)).toEqual(toGenerateClassLessonsBody(values));
  });

  it("is null with the weekday still empty: nothing is asked about half a form", () => {
    expect(toPreviewBody({ ...VALID, weekday: "" })).toBeNull();
  });

  it.each([
    ["the start time", { startTime: "" }],
    ["the end time", { endTime: "" }],
    ["the first date", { firstDate: "" }],
  ])("is null while %s is missing", (_label, missing) => {
    expect(toPreviewBody({ ...VALID, ...missing })).toBeNull();
  });

  it("is null while the end time is not after the start time", () => {
    expect(toPreviewBody({ ...VALID, startTime: "11:00", endTime: "10:00" })).toBeNull();
  });

  it("is null while the location is too long", () => {
    expect(toPreviewBody({ ...VALID, location: "a".repeat(201) })).toBeNull();
  });

  it("carries a blank location as null, and the optional field alone does not hold the preview", () => {
    expect(toPreviewBody({ ...VALID, location: "" })).toEqual({
      weekday: "tuesday",
      startTime: "09:00",
      endTime: "11:00",
      firstDate: "2026-04-07",
      location: null,
    });
  });
});
