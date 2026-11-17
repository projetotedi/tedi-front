import { describe, expect, it } from "vitest";

import { CourseCategory } from "@api/generated/model";

import { toCourseFormError } from "../lib/course-errors";
import {
  courseFormSchema,
  emptyCourseFormValues,
  toCourseFormValues,
  toCreateCourseBody,
  toUpdateCourseBody,
  type CourseFormValues,
} from "../schemas/course.schema";
import { buildCourseDetail } from "./handlers";

const filled = (overrides: Partial<CourseFormValues> = {}): CourseFormValues => ({
  name: "Curso",
  category: CourseCategory.basic,
  prerequisiteIds: [],
  description: "Descrição.",
  objective: "",
  ...overrides,
});

const messagesOf = (values: CourseFormValues) => {
  const result = courseFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message).sort();
};

describe("courseFormSchema", () => {
  it("asks for the name, the category and the description", () => {
    expect(messagesOf(emptyCourseFormValues())).toEqual([
      "categoryRequired",
      "descriptionRequired",
      "nameRequired",
    ]);
  });

  it("counts a blank name as missing and checks the limits of the contract", () => {
    expect(messagesOf(filled({ name: "   " }))).toEqual(["nameRequired"]);
    expect(messagesOf(filled({ name: "x".repeat(201) }))).toEqual(["nameTooLong"]);
    expect(messagesOf(filled({ objective: "x".repeat(2001) }))).toEqual(["objectiveTooLong"]);
    expect(
      messagesOf(filled({ prerequisiteIds: Array.from({ length: 21 }, (_, i) => String(i)) })),
    ).toEqual(["prerequisitesTooMany"]);
  });
});

describe("toCreateCourseBody", () => {
  it("trims, leaves a blank objective out and always sends the prerequisites", () => {
    expect(toCreateCourseBody(filled({ name: "  Curso  ", objective: "  " }))).toEqual({
      name: "Curso",
      category: CourseCategory.basic,
      description: "Descrição.",
      prerequisiteIds: [],
    });
  });
});

describe("toUpdateCourseBody", () => {
  const initial = toCourseFormValues(buildCourseDetail());

  it("sends nothing when nothing changed, prerequisites in another order included", () => {
    expect(toUpdateCourseBody({ ...initial, name: ` ${initial.name} ` }, initial)).toEqual({});
  });

  it("sends only the fields that changed, and a cleared objective as null", () => {
    expect(
      toUpdateCourseBody({ ...initial, category: CourseCategory.advanced, objective: "" }, initial),
    ).toEqual({ category: CourseCategory.advanced, objective: null });
  });

  it("sends the whole set of prerequisites when it changed, [] to clear", () => {
    expect(toUpdateCourseBody({ ...initial, prerequisiteIds: [] }, initial)).toEqual({
      prerequisiteIds: [],
    });
  });
});

describe("toCourseFormError", () => {
  it.each([
    [{ statusCode: 409, error: "COURSE_NAME_TAKEN" }, "name", "nameTaken"],
    [{ statusCode: 400, error: "PREREQUISITE_CYCLE" }, "prerequisiteIds", "prerequisiteCycle"],
    [
      { statusCode: 400, error: "PREREQUISITE_NOT_FOUND" },
      "prerequisiteIds",
      "prerequisiteNotFound",
    ],
    [
      { statusCode: 400, error: "PREREQUISITE_ARCHIVED" },
      "prerequisiteIds",
      "prerequisiteArchived",
    ],
  ])("puts %j on the field", (error, name, message) => {
    expect(toCourseFormError(error)).toEqual({ kind: "fields", fields: [{ name, message }] });
  });

  it("maps a validation detail to its field and anything else to an alert", () => {
    expect(
      toCourseFormError({
        statusCode: 400,
        error: "VALIDATION_FAILED",
        details: [{ field: "description", message: "too long" }],
      }),
    ).toEqual({ kind: "fields", fields: [{ name: "description", message: "serverInvalid" }] });
    expect(toCourseFormError({ statusCode: 409, error: "COURSE_ARCHIVED" })).toEqual({
      kind: "archived",
    });
    expect(toCourseFormError({ statusCode: 404, error: "COURSE_NOT_FOUND" })).toEqual({
      kind: "notFound",
    });
    expect(toCourseFormError({ statusCode: 500, error: "INTERNAL_SERVER_ERROR" })).toEqual({
      kind: "unknown",
    });
  });
});
