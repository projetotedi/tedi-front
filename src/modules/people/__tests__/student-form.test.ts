import { describe, expect, it } from "vitest";

import { maskPhone } from "../lib/format";
import { ageOn, isValidBirthDate } from "../lib/student";
import { toStudentActionError } from "../lib/student-errors";
import {
  emptyStudentFormValues,
  studentFormSchema,
  toStudentFormValues,
  toUpdateStudentBody,
} from "../schemas/student.schema";
import { buildStudentDetail } from "./handlers";

const NOON_UTC = new Date("2026-11-26T15:00:00.000Z");

describe("maskPhone", () => {
  it.each([
    ["", ""],
    ["1", "(1"],
    ["119", "(11) 9"],
    ["1133334444", "(11) 3333-4444"],
    ["11988881234", "(11) 98888-1234"],
    ["(11) 98888-1234", "(11) 98888-1234"],
    ["5511988881234", "5511988881234"],
    ["55119888812349999", "5511988881234"],
  ])("masks %s as %s", (input, output) => {
    expect(maskPhone(input)).toBe(output);
  });
});

describe("birth date", () => {
  it("takes a real day from 1900-01-01 up to today", () => {
    expect(isValidBirthDate("1959-03-14", NOON_UTC)).toBe(true);
    expect(isValidBirthDate("1899-12-31", NOON_UTC)).toBe(false);
    expect(isValidBirthDate("2023-02-31", NOON_UTC)).toBe(false);
    expect(isValidBirthDate("2026-11-27", NOON_UTC)).toBe(false);
  });

  it("counts the whole years", () => {
    expect(ageOn("1959-03-14", NOON_UTC)).toBe(67);
    expect(ageOn("1959-11-26", NOON_UTC)).toBe(67);
    expect(ageOn("1959-11-27", NOON_UTC)).toBe(66);
  });
});

describe("studentFormSchema", () => {
  it("refuses a phone that is not 10 to 13 digits and a malformed e-mail", () => {
    const result = studentFormSchema.safeParse({
      ...emptyStudentFormValues(),
      name: "Maria",
      birthDate: "1959-03-14",
      phone: "(11) 9888",
      email: "maria@",
    });

    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => [issue.path[0], issue.message]);
    expect(messages).toEqual([
      ["phone", "phoneInvalid"],
      ["email", "emailInvalid"],
    ]);
  });
});

describe("toUpdateStudentBody", () => {
  it("sends only what changed, a cleared field as null and a phone in digits", () => {
    const initial = toStudentFormValues(buildStudentDetail());
    const body = toUpdateStudentBody(
      { ...initial, email: "", hasComputer: "yes", emergencyContactPhone: "(11) 3333-4444" },
      initial,
    );

    expect(body).toEqual({ email: null, hasComputer: true, emergencyContactPhone: "1133334444" });
  });
});

describe("toStudentActionError", () => {
  it("puts the e-mail taken on the field", () => {
    expect(toStudentActionError({ statusCode: 409, error: "EMAIL_ALREADY_IN_USE" })).toEqual({
      kind: "fields",
      fields: [{ name: "email", message: "emailInUse" }],
    });
  });

  it("maps the 400 of a field", () => {
    expect(
      toStudentActionError({
        statusCode: 400,
        error: "VALIDATION_FAILED",
        details: [{ field: "phone", message: "x" }],
      }),
    ).toEqual({ kind: "fields", fields: [{ name: "phone", message: "phoneInvalid" }] });
  });

  it.each([
    [{ statusCode: 409, error: "STUDENT_ARCHIVED" }, "archived"],
    [{ statusCode: 409, error: "STUDENT_HAS_ACTIVE_ENROLLMENTS" }, "hasActiveEnrollments"],
    [{ statusCode: 404, error: "STUDENT_NOT_FOUND" }, "notFound"],
    [{ statusCode: 503 }, "network"],
    [new TypeError("fetch failed"), "network"],
    [{ statusCode: 500 }, "unknown"],
  ])("maps %o to %s", (error, kind) => {
    expect(toStudentActionError(error)).toEqual({ kind });
  });
});
