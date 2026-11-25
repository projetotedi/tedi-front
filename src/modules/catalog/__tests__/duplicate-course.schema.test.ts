import { describe, expect, it } from "vitest";

import { DuplicateCourseBody } from "@api/generated/zod/catalog/catalog";

import {
  DUPLICATE_COURSE_LIMITS,
  duplicateCourseFormSchema,
  toDuplicateCourseBody,
  type DuplicateCourseFormValues,
} from "../schemas/duplicate-course.schema";

function issuesOf(values: DuplicateCourseFormValues): Array<{ path: string; message: string }> {
  const result = duplicateCourseFormSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

describe("duplicateCourseFormSchema", () => {
  it("accepts a name", () => {
    expect(issuesOf({ name: "Redes Sociais com Segurança (cópia)" })).toEqual([]);
  });

  it("requires the name", () => {
    expect(issuesOf({ name: "" })).toEqual([{ path: "name", message: "nameRequired" }]);
  });

  it("requires the name even when only spaces are typed", () => {
    expect(issuesOf({ name: "   " })).toEqual([{ path: "name", message: "nameRequired" }]);
  });

  it("measures the name without the spaces around it", () => {
    const name = "a".repeat(DUPLICATE_COURSE_LIMITS.nameMax);

    expect(issuesOf({ name: `  ${name}  ` })).toEqual([]);
  });

  it("takes the limit of the name from the contract: 200 characters are accepted and 201 are not", () => {
    expect(DUPLICATE_COURSE_LIMITS.nameMax).toBe(200);
    expect(issuesOf({ name: "a".repeat(200) })).toEqual([]);
    expect(issuesOf({ name: "a".repeat(201) })).toEqual([{ path: "name", message: "nameTooLong" }]);
  });

  it("returns the trimmed name as the parsed value", () => {
    const result = duplicateCourseFormSchema.safeParse({ name: "  Informática Básica (cópia) " });

    expect(result.success && result.data).toEqual({ name: "Informática Básica (cópia)" });
  });
});

describe("toDuplicateCourseBody", () => {
  it("sends the name trimmed and nothing else", () => {
    expect(toDuplicateCourseBody({ name: "  Informática Básica (cópia)  " })).toEqual({
      name: "Informática Básica (cópia)",
    });
  });

  it.each([
    [200, true],
    [201, false],
  ])(
    "agrees with the generated contract schema on a name of %s characters (accepted: %s)",
    (length, isAccepted) => {
      const values = { name: "a".repeat(length) };

      expect(duplicateCourseFormSchema.safeParse(values).success).toBe(isAccepted);
      expect(DuplicateCourseBody.safeParse(toDuplicateCourseBody(values)).success).toBe(isAccepted);
    },
  );
});
