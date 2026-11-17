import { describe, expect, it } from "vitest";

import { AssignmentRole } from "@api/generated/model";

import {
  APPLY_NOTE_MAX,
  applyToLessonFormSchema,
  emptyApplyToLessonFormInput,
  toApplyToLessonBody,
} from "../schemas/apply-to-lesson.schema";

function issuesOf(input: unknown) {
  const result = applyToLessonFormSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

describe("applyToLessonFormSchema", () => {
  it("takes the limit of the note from the contract: 500", () => {
    expect(APPLY_NOTE_MAX).toBe(500);
  });

  it("starts with no role and no note", () => {
    expect(emptyApplyToLessonFormInput()).toEqual({ role: null, note: "" });
  });

  it("refuses a missing role with roleRequired, on the role", () => {
    expect(issuesOf({ role: null, note: "" })).toEqual([{ path: "role", message: "roleRequired" }]);
  });

  it("refuses a role that is not one of the contract", () => {
    expect(issuesOf({ role: "student", note: "" })).toHaveLength(1);
    expect(issuesOf({ role: "", note: "" })).toHaveLength(1);
  });

  it.each([AssignmentRole.monitor, AssignmentRole.teacher])("lets the role %s through", (role) => {
    const result = applyToLessonFormSchema.safeParse({ role, note: "" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ role, note: "" });
  });

  it("accepts a note of exactly 500 characters", () => {
    expect(issuesOf({ role: "monitor", note: "a".repeat(500) })).toEqual([]);
  });

  it("refuses a note of 501 characters with noteTooLong, on the note", () => {
    expect(issuesOf({ role: "monitor", note: "a".repeat(501) })).toEqual([
      { path: "note", message: "noteTooLong" },
    ]);
  });

  it("counts the note without the spaces around it, the way it is sent", () => {
    expect(issuesOf({ role: "monitor", note: ` ${"a".repeat(500)} ` })).toEqual([]);
    expect(issuesOf({ role: "monitor", note: ` ${"a".repeat(501)} ` })).toEqual([
      { path: "note", message: "noteTooLong" },
    ]);
  });

  it("reports the role and the note together when both are wrong", () => {
    expect(issuesOf({ role: null, note: "a".repeat(501) }).map((issue) => issue.path)).toEqual([
      "role",
      "note",
    ]);
  });
});

describe("toApplyToLessonBody", () => {
  it("sends a blank note as null", () => {
    expect(toApplyToLessonBody({ role: "monitor", note: "" })).toEqual({
      role: "monitor",
      note: null,
    });
    expect(toApplyToLessonBody({ role: "monitor", note: "   " })).toEqual({
      role: "monitor",
      note: null,
    });
  });

  it("sends the note without the spaces around it", () => {
    expect(toApplyToLessonBody({ role: "teacher", note: "  Posso chegar mais cedo.  " })).toEqual({
      role: "teacher",
      note: "Posso chegar mais cedo.",
    });
  });

  it("passes the role along", () => {
    expect(toApplyToLessonBody({ role: "teacher", note: "" }).role).toBe("teacher");
    expect(toApplyToLessonBody({ role: "monitor", note: "" }).role).toBe("monitor");
  });

  it("is what the schema outputs for what the person typed", () => {
    const parsed = applyToLessonFormSchema.parse({ role: "monitor", note: "  oi  " });

    expect(toApplyToLessonBody(parsed)).toEqual({ role: "monitor", note: "oi" });
  });
});
