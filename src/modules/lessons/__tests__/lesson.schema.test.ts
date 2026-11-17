import { describe, expect, it } from "vitest";

import { LessonStatus } from "@api/generated/model";

import {
  cancelLessonFormSchema,
  emptyLessonFormValues,
  LESSON_LIMITS,
  lessonFormSchema,
  NO_LESSON_PLAN,
  rescheduleLessonFormSchema,
  toCancelLessonBody,
  toCreateLessonBody,
  toLessonFormValues,
  toRescheduleFormValues,
  toRescheduleLessonBody,
  toUpdateLessonBody,
  type LessonFormValues,
  type RescheduleLessonFormValues,
} from "../schemas/lesson.schema";
import {
  buildCancelledLesson,
  buildLesson,
  buildStandaloneLesson,
  CLASS_ID,
  LESSON_PLAN_ID,
} from "./handlers";

function validValues(overrides: Partial<LessonFormValues> = {}): LessonFormValues {
  return {
    ...emptyLessonFormValues(),
    title: "Teclado, mouse e janelas",
    date: "2026-03-10",
    startTime: "09:00",
    endTime: "11:00",
    ...overrides,
  };
}

/** The first message the schema gives to a field, or `undefined` when the field is fine. */
function messageOf<TValues extends object>(
  schema: {
    safeParse: (
      values: unknown,
    ) => { success: true } | { success: false; error: { issues: unknown[] } };
  },
  values: TValues,
  field: keyof TValues,
): string | undefined {
  const result = schema.safeParse(values);
  if (result.success) return undefined;

  const issues = result.error.issues as { path: PropertyKey[]; message: string }[];
  return issues.find((issue) => issue.path[0] === field)?.message;
}

describe("lessonFormSchema", () => {
  it("accepts the values of a valid lesson, with the optional fields empty", () => {
    expect(lessonFormSchema.safeParse(validValues()).success).toBe(true);
  });

  it("starts a new lesson planned, on its own, with every field empty", () => {
    const values = emptyLessonFormValues();

    expect(values.lessonPlanId).toBe(NO_LESSON_PLAN);
    expect(values.status).toBe(LessonStatus.planned);
    expect(values).toMatchObject({
      title: "",
      objective: "",
      date: "",
      location: "",
      startTime: "",
      endTime: "",
      expectedStudents: "",
      expectedMonitors: "",
      subject: "",
      postNotes: "",
    });
  });

  describe("title", () => {
    it.each([
      ["empty", ""],
      ["only spaces", "   "],
    ])("is required (%s)", (_label, title) => {
      expect(messageOf(lessonFormSchema, validValues({ title }), "title")).toBe("titleRequired");
    });

    it("accepts the longest title and refuses one character more", () => {
      const max = LESSON_LIMITS.titleMax;

      expect(messageOf(lessonFormSchema, validValues({ title: "a".repeat(max) }), "title")).toBe(
        undefined,
      );
      expect(
        messageOf(lessonFormSchema, validValues({ title: "a".repeat(max + 1) }), "title"),
      ).toBe("titleTooLong");
      expect(max).toBe(200);
    });
  });

  describe("date and times", () => {
    it("asks for the date", () => {
      expect(messageOf(lessonFormSchema, validValues({ date: "" }), "date")).toBe("dateRequired");
    });

    it("asks for the start and the end time", () => {
      const empty = validValues({ startTime: "", endTime: "" });

      expect(messageOf(lessonFormSchema, empty, "startTime")).toBe("startTimeRequired");
      expect(messageOf(lessonFormSchema, empty, "endTime")).toBe("endTimeRequired");
    });

    it.each([
      ["before the start", "08:59"],
      ["equal to the start", "09:00"],
    ])(
      "refuses an end %s, on the end field (endTime must be after startTime)",
      (_label, endTime) => {
        const values = validValues({ startTime: "09:00", endTime });

        expect(messageOf(lessonFormSchema, values, "endTime")).toBe("invalidTimeRange");
        expect(messageOf(lessonFormSchema, values, "startTime")).toBe(undefined);
      },
    );

    it("accepts an end one minute after the start", () => {
      const values = validValues({ startTime: "09:00", endTime: "09:01" });

      expect(lessonFormSchema.safeParse(values).success).toBe(true);
    });

    it("does not say the range is wrong when a time is missing: the missing one says it", () => {
      const values = validValues({ startTime: "", endTime: "08:00" });

      expect(messageOf(lessonFormSchema, values, "endTime")).toBe(undefined);
      expect(messageOf(lessonFormSchema, values, "startTime")).toBe("startTimeRequired");
    });
  });

  describe("expected students and monitors", () => {
    it.each([
      ["empty (not informed)", ""],
      ["a number", "12"],
      ["zero", "0"],
      ["the maximum", "1000"],
    ])("accepts %s", (_label, expectedStudents) => {
      expect(
        messageOf(lessonFormSchema, validValues({ expectedStudents }), "expectedStudents"),
      ).toBe(undefined);
    });

    it.each([
      ["a negative number", "-1"],
      ["a decimal with a comma", "1,5"],
      ["a decimal with a point", "1.5"],
      ["text", "abc"],
      ["more than the maximum", "1001"],
    ])("refuses %s", (_label, expectedStudents) => {
      expect(
        messageOf(lessonFormSchema, validValues({ expectedStudents }), "expectedStudents"),
      ).toBe("countInvalid");
    });

    it("has its own maximum for the monitors", () => {
      expect(
        messageOf(lessonFormSchema, validValues({ expectedMonitors: "100" }), "expectedMonitors"),
      ).toBe(undefined);
      expect(
        messageOf(lessonFormSchema, validValues({ expectedMonitors: "101" }), "expectedMonitors"),
      ).toBe("countInvalid");
    });
  });

  describe("status", () => {
    it.each([LessonStatus.planned, LessonStatus.confirmed, LessonStatus.done])(
      "accepts %s",
      (status) => {
        expect(lessonFormSchema.safeParse(validValues({ status })).success).toBe(true);
      },
    );

    it("refuses cancelled: the API says 400 to it, and cancelling is its own dialog", () => {
      const values = { ...validValues(), status: LessonStatus.cancelled };

      expect(lessonFormSchema.safeParse(values).success).toBe(false);
    });
  });

  it.each([
    ["objective", "objectiveTooLong", LESSON_LIMITS.objectiveMax],
    ["location", "locationTooLong", LESSON_LIMITS.locationMax],
    ["subject", "subjectTooLong", LESSON_LIMITS.subjectMax],
    ["postNotes", "postNotesTooLong", LESSON_LIMITS.postNotesMax],
  ] as const)("limits the %s to the maximum of the contract", (field, message, max) => {
    expect(messageOf(lessonFormSchema, validValues({ [field]: "a".repeat(max) }), field)).toBe(
      undefined,
    );
    expect(messageOf(lessonFormSchema, validValues({ [field]: "a".repeat(max + 1) }), field)).toBe(
      message,
    );
  });
});

describe("toLessonFormValues", () => {
  it("writes null as an empty field and a number as its text", () => {
    const values = toLessonFormValues(
      buildStandaloneLesson({
        objective: null,
        location: null,
        expectedStudents: 12,
        expectedMonitors: null,
        subject: null,
        postNotes: null,
      }),
    );

    expect(values).toMatchObject({
      lessonPlanId: NO_LESSON_PLAN,
      objective: "",
      location: "",
      expectedStudents: "12",
      expectedMonitors: "",
      subject: "",
      postNotes: "",
    });
  });

  it("keeps the plan, the date and the times of the lesson", () => {
    const values = toLessonFormValues(buildLesson());

    expect(values).toMatchObject({
      lessonPlanId: LESSON_PLAN_ID,
      title: "Teclado, mouse e janelas",
      date: "2026-03-10",
      startTime: "09:00",
      endTime: "11:00",
      status: LessonStatus.planned,
    });
    expect(lessonFormSchema.safeParse(values).success).toBe(true);
  });

  it("falls back to planned for a cancelled lesson, which has no edit form", () => {
    expect(toLessonFormValues(buildCancelledLesson()).status).toBe(LessonStatus.planned);
  });
});

describe("toCreateLessonBody", () => {
  it("sends the plan with the position it has in the sequence", () => {
    const body = toCreateLessonBody(
      validValues({ lessonPlanId: LESSON_PLAN_ID, title: "  Teclado  ", objective: "Objetivo" }),
      { classId: CLASS_ID, sequenceOrder: 3 },
    );

    expect(body).toEqual({
      classId: CLASS_ID,
      lessonPlanId: LESSON_PLAN_ID,
      sequenceOrder: 3,
      title: "Teclado",
      objective: "Objetivo",
      date: "2026-03-10",
      location: null,
      startTime: "09:00",
      endTime: "11:00",
      expectedStudents: null,
      expectedMonitors: null,
      subject: null,
    });
  });

  it("sends a lesson on its own without a plan and without a position", () => {
    const body = toCreateLessonBody(validValues({ lessonPlanId: NO_LESSON_PLAN }), {
      classId: CLASS_ID,
      sequenceOrder: 3,
    });

    expect(body.lessonPlanId).toBeNull();
    expect(body).not.toHaveProperty("sequenceOrder");
  });

  it("turns blank texts into null and the counts into numbers", () => {
    const body = toCreateLessonBody(
      validValues({
        objective: "   ",
        location: "  Laboratório 2  ",
        subject: "",
        expectedStudents: " 12 ",
        expectedMonitors: "0",
      }),
      { classId: CLASS_ID, sequenceOrder: null },
    );

    expect(body).toMatchObject({
      objective: null,
      location: "Laboratório 2",
      subject: null,
      expectedStudents: 12,
      expectedMonitors: 0,
    });
  });

  it("never sends the status nor the post-lesson notes, which are not in the DTO", () => {
    const body = toCreateLessonBody(
      validValues({ status: LessonStatus.done, postNotes: "Correu bem." }),
      { classId: CLASS_ID, sequenceOrder: null },
    );

    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("postNotes");
  });
});

describe("toUpdateLessonBody", () => {
  it("sends only what the edit form can change, never the date, the times, the class nor the plan", () => {
    const body = toUpdateLessonBody(
      validValues({
        lessonPlanId: LESSON_PLAN_ID,
        title: "  Novo título ",
        objective: "Novo objetivo",
        location: "Sala 3",
        subject: "Mouse",
        expectedStudents: "20",
        expectedMonitors: "",
        status: LessonStatus.confirmed,
        postNotes: "Faltaram dois alunos.",
      }),
    );

    expect(body).toEqual({
      title: "Novo título",
      objective: "Novo objetivo",
      location: "Sala 3",
      subject: "Mouse",
      expectedStudents: 20,
      expectedMonitors: null,
      status: LessonStatus.confirmed,
      postNotes: "Faltaram dois alunos.",
    });
    for (const locked of [
      "date",
      "startTime",
      "endTime",
      "classId",
      "lessonPlanId",
      "sequenceOrder",
    ]) {
      expect(body).not.toHaveProperty(locked);
    }
  });

  it("clears a field the person emptied, with null", () => {
    const body = toUpdateLessonBody(validValues({ objective: "", location: " ", postNotes: "" }));

    expect(body).toMatchObject({ objective: null, location: null, postNotes: null });
  });
});

describe("cancelLessonFormSchema", () => {
  it.each([
    ["empty", ""],
    ["blank", "   "],
  ])("asks for the reason (%s)", (_label, reason) => {
    expect(messageOf(cancelLessonFormSchema, { reason }, "reason")).toBe("reasonRequired");
  });

  it("limits the reason to the maximum of the contract", () => {
    const max = LESSON_LIMITS.cancelReasonMax;

    expect(messageOf(cancelLessonFormSchema, { reason: "a".repeat(max) }, "reason")).toBe(
      undefined,
    );
    expect(messageOf(cancelLessonFormSchema, { reason: "a".repeat(max + 1) }, "reason")).toBe(
      "reasonTooLong",
    );
  });

  it("sends the reason trimmed", () => {
    expect(toCancelLessonBody({ reason: "  Feriado municipal.  " })).toEqual({
      reason: "Feriado municipal.",
    });
  });
});

describe("rescheduleLessonFormSchema", () => {
  function rescheduleValues(
    overrides: Partial<RescheduleLessonFormValues> = {},
  ): RescheduleLessonFormValues {
    return { ...toRescheduleFormValues(buildLesson()), date: "2026-03-17", ...overrides };
  }

  it("opens with the date empty and the times and the place of the lesson", () => {
    expect(toRescheduleFormValues(buildLesson())).toEqual({
      date: "",
      startTime: "09:00",
      endTime: "11:00",
      location: "Laboratório 2 — Bloco B",
      reason: "",
      note: "",
    });
    expect(toRescheduleFormValues(buildLesson({ location: null })).location).toBe("");
  });

  it("accepts a new date with the times of the lesson", () => {
    expect(rescheduleLessonFormSchema.safeParse(rescheduleValues()).success).toBe(true);
  });

  it("asks for the new date", () => {
    expect(messageOf(rescheduleLessonFormSchema, rescheduleValues({ date: "" }), "date")).toBe(
      "dateRequired",
    );
  });

  it.each([
    ["before the start", "08:00"],
    ["equal to the start", "09:00"],
  ])("refuses an end %s", (_label, endTime) => {
    expect(messageOf(rescheduleLessonFormSchema, rescheduleValues({ endTime }), "endTime")).toBe(
      "invalidTimeRange",
    );
  });

  it("asks for both times", () => {
    const values = rescheduleValues({ startTime: "", endTime: "" });

    expect(messageOf(rescheduleLessonFormSchema, values, "startTime")).toBe("startTimeRequired");
    expect(messageOf(rescheduleLessonFormSchema, values, "endTime")).toBe("endTimeRequired");
  });

  it.each([
    ["location", "locationTooLong", LESSON_LIMITS.locationMax],
    ["reason", "reasonTooLong", LESSON_LIMITS.rescheduleReasonMax],
    ["note", "noteTooLong", LESSON_LIMITS.noteMax],
  ] as const)("limits the %s to the maximum of the contract", (field, message, max) => {
    expect(
      messageOf(rescheduleLessonFormSchema, rescheduleValues({ [field]: "a".repeat(max) }), field),
    ).toBe(undefined);
    expect(
      messageOf(
        rescheduleLessonFormSchema,
        rescheduleValues({ [field]: "a".repeat(max + 1) }),
        field,
      ),
    ).toBe(message);
  });

  it("sends an emptied place as null, which clears it", () => {
    const body = toRescheduleLessonBody(rescheduleValues({ location: "" }));

    expect(body.location).toBeNull();
  });

  it("sends the reason and the note trimmed, and null when they are blank", () => {
    expect(
      toRescheduleLessonBody(rescheduleValues({ reason: " Sala indisponível ", note: " Prova " })),
    ).toEqual({
      date: "2026-03-17",
      startTime: "09:00",
      endTime: "11:00",
      location: "Laboratório 2 — Bloco B",
      reason: "Sala indisponível",
      note: "Prova",
    });
    expect(toRescheduleLessonBody(rescheduleValues({ reason: "  ", note: "" }))).toMatchObject({
      reason: null,
      note: null,
    });
  });
});
