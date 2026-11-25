import { describe, expect, it } from "vitest";

import { AssignmentRole, AssignmentStatus } from "@api/generated/model";
import { CreateAssignmentBody } from "@api/generated/zod/assignments/assignments";

import {
  emptyNewAssignmentValues,
  newAssignmentFormSchema,
  toCreateAssignmentBody,
  type NewAssignmentFormInput,
} from "../schemas/new-assignment.schema";
import { CLASS_ID, LESSON_ID, MEMBER_ID } from "./handlers";

const VALID: NewAssignmentFormInput = {
  personId: MEMBER_ID,
  classId: CLASS_ID,
  lessonId: LESSON_ID,
  role: AssignmentRole.teacher,
  status: AssignmentStatus.confirmed,
};

/** The messages of the issues of a parse, by field: what the form shows under each one. */
function messagesOf(input: unknown): Record<string, string[]> {
  const result = newAssignmentFormSchema.safeParse(input);
  if (result.success) return {};

  const messages: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    messages[field] = [...(messages[field] ?? []), issue.message];
  }
  return messages;
}

describe("emptyNewAssignmentValues", () => {
  it("starts with nothing chosen but the status, which is confirmed and shown (F5)", () => {
    expect(emptyNewAssignmentValues()).toEqual({
      personId: "",
      classId: "",
      lessonId: "",
      role: "",
      status: AssignmentStatus.confirmed,
    });
  });

  it("starts with the member of the screen that opened the form", () => {
    expect(emptyNewAssignmentValues({ memberId: MEMBER_ID })).toMatchObject({
      personId: MEMBER_ID,
      classId: "",
      lessonId: "",
      role: "",
    });
  });

  it("starts with the class and the lesson of the screen that opened the form", () => {
    expect(
      emptyNewAssignmentValues({ memberId: MEMBER_ID, classId: CLASS_ID, lessonId: LESSON_ID }),
    ).toEqual({ ...VALID, role: "" });
  });
});

describe("newAssignmentFormSchema", () => {
  it("accepts a member, a class, a lesson, a role and a status", () => {
    expect(newAssignmentFormSchema.parse(VALID)).toEqual(VALID);
  });

  it.each([AssignmentRole.teacher, AssignmentRole.monitor])("accepts the role %s", (role) => {
    expect(newAssignmentFormSchema.safeParse({ ...VALID, role }).success).toBe(true);
  });

  it.each([AssignmentStatus.confirmed, AssignmentStatus.pending])(
    "accepts the status %s",
    (status) => {
      expect(newAssignmentFormSchema.safeParse({ ...VALID, status }).success).toBe(true);
    },
  );

  it("asks for what the person has not chosen, with the message required on each field", () => {
    expect(messagesOf(emptyNewAssignmentValues())).toEqual({
      personId: ["required"],
      classId: ["required"],
      lessonId: ["required"],
      role: ["required"],
    });
  });

  it("asks only for the role when the screen decided the member, the class and the lesson", () => {
    const opened = emptyNewAssignmentValues({
      memberId: MEMBER_ID,
      classId: CLASS_ID,
      lessonId: LESSON_ID,
    });

    expect(messagesOf(opened)).toEqual({ role: ["required"] });
  });

  it("refuses a member that is not a UUID, with the rule of the generated schema", () => {
    const messages = messagesOf({ ...VALID, personId: "beatriz" });

    expect(Object.keys(messages)).toEqual(["personId"]);
    expect(messages.personId).not.toContain("required");
  });

  it.each([AssignmentStatus.declined, AssignmentStatus.cancelled])(
    "refuses the status %s: it only exists as the decision about an assignment that exists",
    (status) => {
      expect(newAssignmentFormSchema.safeParse({ ...VALID, status }).success).toBe(false);
    },
  );

  it("refuses a role that does not exist", () => {
    expect(messagesOf({ ...VALID, role: "student" })).toHaveProperty("role");
  });
});

describe("toCreateAssignmentBody", () => {
  it("is the member, the role and the status, and nothing else", () => {
    const values = newAssignmentFormSchema.parse({
      ...VALID,
      role: AssignmentRole.monitor,
      status: AssignmentStatus.pending,
    });

    expect(toCreateAssignmentBody(values)).toEqual({
      personId: MEMBER_ID,
      role: AssignmentRole.monitor,
      status: AssignmentStatus.pending,
    });
  });

  it("has no note, and none of the ids that only choose the URL", () => {
    const body = toCreateAssignmentBody(newAssignmentFormSchema.parse(VALID));

    expect(Object.keys(body).sort()).toEqual(["personId", "role", "status"]);
  });

  it("is a body the schema of the API accepts", () => {
    const body = toCreateAssignmentBody(newAssignmentFormSchema.parse(VALID));

    expect(CreateAssignmentBody.safeParse(body).success).toBe(true);
  });
});
