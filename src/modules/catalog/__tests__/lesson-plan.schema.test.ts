import { describe, expect, it } from "vitest";

import {
  archiveLessonPlanFormSchema,
  buildEmptyFormValues,
  lessonPlanFormSchema,
  toArchiveBody,
  toDurationMinutes,
  toFormValues,
  toLessonPlanBody,
  type LessonPlanFormValues,
} from "../schemas/lesson-plan.schema";
import { buildLessonPlan } from "./handlers";

function validValues(overrides: Partial<LessonPlanFormValues> = {}): LessonPlanFormValues {
  return {
    title: "Teclado, mouse e janelas",
    hours: "1",
    minutes: "30",
    contents: [{ value: "Teclado e mouse" }],
    objective: "",
    materialUrl: "",
    ...overrides,
  };
}

function issuesOf(values: LessonPlanFormValues): Array<{ path: string; message: string }> {
  const result = lessonPlanFormSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

describe("lessonPlanFormSchema", () => {
  it("accepts a complete valid plan", () => {
    expect(
      issuesOf(
        validValues({
          objective: "Aprender a usar o mouse.",
          materialUrl: "https://drive.google.com/file/d/exemplo/view",
        }),
      ),
    ).toEqual([]);
  });

  it("accepts a plan without objective and without material link", () => {
    expect(issuesOf(validValues({ objective: "", materialUrl: "" }))).toEqual([]);
  });

  describe("title", () => {
    it("is required", () => {
      expect(issuesOf(validValues({ title: "" }))).toEqual([
        { path: "title", message: "titleRequired" },
      ]);
    });

    it("is required even when only spaces are typed", () => {
      expect(issuesOf(validValues({ title: "   " }))).toEqual([
        { path: "title", message: "titleRequired" },
      ]);
    });

    it("accepts 200 characters and rejects 201", () => {
      expect(issuesOf(validValues({ title: "a".repeat(200) }))).toEqual([]);
      expect(issuesOf(validValues({ title: "a".repeat(201) }))).toEqual([
        { path: "title", message: "titleTooLong" },
      ]);
    });
  });

  describe("duration", () => {
    it("must be greater than zero", () => {
      expect(issuesOf(validValues({ hours: "0", minutes: "0" }))).toEqual([
        { path: "hours", message: "durationRequired" },
      ]);
    });

    it("must be greater than zero when both fields are blank", () => {
      expect(issuesOf(validValues({ hours: "", minutes: "" }))).toEqual([
        { path: "hours", message: "durationRequired" },
      ]);
    });

    it.each([
      ["only hours", "2", ""],
      ["only minutes", "", "45"],
      ["hours and minutes", "1", "30"],
    ])("accepts %s", (_label, hours, minutes) => {
      expect(issuesOf(validValues({ hours, minutes }))).toEqual([]);
    });

    it("rejects hours that are not whole numbers", () => {
      expect(issuesOf(validValues({ hours: "1,5" }))).toEqual([
        { path: "hours", message: "hoursInvalid" },
      ]);
      expect(issuesOf(validValues({ hours: "-1" }))).toEqual([
        { path: "hours", message: "hoursInvalid" },
      ]);
      expect(issuesOf(validValues({ hours: "abc" }))).toEqual([
        { path: "hours", message: "hoursInvalid" },
      ]);
    });

    it("rejects minutes outside 0 to 59", () => {
      expect(issuesOf(validValues({ minutes: "60" }))).toEqual([
        { path: "minutes", message: "minutesInvalid" },
      ]);
      expect(issuesOf(validValues({ minutes: "x" }))).toEqual([
        { path: "minutes", message: "minutesInvalid" },
      ]);
    });

    it("accepts exactly 24 hours and rejects anything above", () => {
      expect(issuesOf(validValues({ hours: "24", minutes: "0" }))).toEqual([]);
      expect(issuesOf(validValues({ hours: "24", minutes: "1" }))).toEqual([
        { path: "hours", message: "durationTooLong" },
      ]);
      expect(issuesOf(validValues({ hours: "25", minutes: "" }))).toEqual([
        { path: "hours", message: "durationTooLong" },
      ]);
    });

    it("reports a duration error together with the other field errors", () => {
      expect(issuesOf(validValues({ title: "", hours: "0", minutes: "0" }))).toEqual([
        { path: "title", message: "titleRequired" },
        { path: "hours", message: "durationRequired" },
      ]);
    });
  });

  describe("contents", () => {
    it("needs at least one item", () => {
      expect(issuesOf(validValues({ contents: [] }))).toEqual([
        { path: "contents", message: "contentsRequired" },
      ]);
    });

    it("rejects empty items and points to the item", () => {
      expect(issuesOf(validValues({ contents: [{ value: "Teclado" }, { value: "  " }] }))).toEqual([
        { path: "contents.1.value", message: "contentRequired" },
      ]);
    });

    it("accepts 500 characters per item and rejects 501", () => {
      expect(issuesOf(validValues({ contents: [{ value: "a".repeat(500) }] }))).toEqual([]);
      expect(issuesOf(validValues({ contents: [{ value: "a".repeat(501) }] }))).toEqual([
        { path: "contents.0.value", message: "contentTooLong" },
      ]);
    });

    it("accepts 50 items and rejects 51", () => {
      const items = (count: number) => Array.from({ length: count }, () => ({ value: "Item" }));

      expect(issuesOf(validValues({ contents: items(50) }))).toEqual([]);
      expect(issuesOf(validValues({ contents: items(51) }))).toEqual([
        { path: "contents", message: "contentsTooMany" },
      ]);
    });
  });

  describe("objective", () => {
    it("accepts 2000 characters and rejects 2001", () => {
      expect(issuesOf(validValues({ objective: "a".repeat(2000) }))).toEqual([]);
      expect(issuesOf(validValues({ objective: "a".repeat(2001) }))).toEqual([
        { path: "objective", message: "objectiveTooLong" },
      ]);
    });
  });

  describe("material link", () => {
    it.each([
      "https://drive.google.com/file/d/exemplo/view",
      "http://www.exemplo.com.br/aula?id=1",
      "https://exemplo.com",
    ])("accepts %s", (materialUrl) => {
      expect(issuesOf(validValues({ materialUrl }))).toEqual([]);
    });

    it.each([
      "drive.google.com/file",
      "www.exemplo.com",
      "ftp://exemplo.com/arquivo",
      "javascript:alert(1)",
      "https://localhost/aula",
      "https://exemplo.com/um arquivo",
      "texto qualquer",
    ])("rejects %s", (materialUrl) => {
      expect(issuesOf(validValues({ materialUrl }))).toEqual([
        { path: "materialUrl", message: "materialUrlInvalid" },
      ]);
    });

    it("rejects more than 500 characters", () => {
      const materialUrl = `https://exemplo.com/${"a".repeat(481)}`;

      expect(issuesOf(validValues({ materialUrl }))[0]).toEqual({
        path: "materialUrl",
        message: "materialUrlTooLong",
      });
    });
  });
});

describe("toDurationMinutes", () => {
  it.each([
    ["1", "30", 90],
    ["", "45", 45],
    ["2", "", 120],
    ["0", "1", 1],
    ["24", "0", 1440],
  ])("%sh %smin is %i minutes", (hours, minutes, expected) => {
    expect(toDurationMinutes(hours, minutes)).toBe(expected);
  });
});

describe("toLessonPlanBody", () => {
  it("converts the duration to minutes and trims the texts", () => {
    expect(
      toLessonPlanBody(
        validValues({
          title: "  Teclado  ",
          hours: "1",
          minutes: "30",
          contents: [{ value: " Teclado e mouse " }, { value: "Janelas" }],
          objective: " Aprender ",
          materialUrl: " https://exemplo.com/aula ",
        }),
      ),
    ).toEqual({
      title: "Teclado",
      objective: "Aprender",
      expectedDurationMinutes: 90,
      contents: ["Teclado e mouse", "Janelas"],
      materialUrl: "https://exemplo.com/aula",
    });
  });

  it("sends null for the optional fields left empty", () => {
    const body = toLessonPlanBody(validValues({ objective: "  ", materialUrl: "" }));

    expect(body.objective).toBeNull();
    expect(body.materialUrl).toBeNull();
  });

  it("keeps the order of the contents", () => {
    const body = toLessonPlanBody(
      validValues({ contents: [{ value: "C" }, { value: "A" }, { value: "B" }] }),
    );

    expect(body.contents).toEqual(["C", "A", "B"]);
  });
});

describe("toFormValues", () => {
  it("splits the minutes into hours and minutes", () => {
    const values = toFormValues(buildLessonPlan({ expectedDurationMinutes: 135 }));

    expect(values.hours).toBe("2");
    expect(values.minutes).toBe("15");
  });

  it("shows 0 hours for a plan shorter than one hour", () => {
    const values = toFormValues(buildLessonPlan({ expectedDurationMinutes: 45 }));

    expect(values.hours).toBe("0");
    expect(values.minutes).toBe("45");
  });

  it("maps the contents to rows in the same order", () => {
    const values = toFormValues(buildLessonPlan({ contents: ["B", "A"] }));

    expect(values.contents).toEqual([{ value: "B" }, { value: "A" }]);
  });

  it("turns null objective and link into empty fields", () => {
    const values = toFormValues(buildLessonPlan({ objective: null, materialUrl: null }));

    expect(values.objective).toBe("");
    expect(values.materialUrl).toBe("");
  });

  it("round-trips through the form body", () => {
    const plan = buildLessonPlan({ expectedDurationMinutes: 150 });
    const body = toLessonPlanBody(toFormValues(plan));

    expect(body).toEqual({
      title: plan.title,
      objective: plan.objective,
      expectedDurationMinutes: 150,
      contents: plan.contents,
      materialUrl: plan.materialUrl,
    });
  });
});

describe("buildEmptyFormValues", () => {
  it("starts with a single empty content and returns a fresh object each time", () => {
    const first = buildEmptyFormValues();
    const second = buildEmptyFormValues();

    expect(first.contents).toEqual([{ value: "" }]);
    expect(first).not.toBe(second);
    expect(first.contents).not.toBe(second.contents);
  });
});

describe("archiveLessonPlanFormSchema", () => {
  it("accepts an empty reason", () => {
    expect(archiveLessonPlanFormSchema.safeParse({ reason: "" }).success).toBe(true);
  });

  it("accepts 500 characters and rejects 501", () => {
    expect(archiveLessonPlanFormSchema.safeParse({ reason: "a".repeat(500) }).success).toBe(true);

    const result = archiveLessonPlanFormSchema.safeParse({ reason: "a".repeat(501) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("reasonTooLong");
  });
});

describe("toArchiveBody", () => {
  it("sends no body without a reason", () => {
    expect(toArchiveBody({ reason: "   " })).toBeUndefined();
  });

  it("sends the trimmed reason", () => {
    expect(toArchiveBody({ reason: "  Conteúdo revisado.  " })).toEqual({
      reason: "Conteúdo revisado.",
    });
  });
});
