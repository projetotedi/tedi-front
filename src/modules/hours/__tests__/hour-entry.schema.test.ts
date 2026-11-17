import { describe, expect, it } from "vitest";

import {
  emptyLogHoursFormInput,
  logHoursFormSchema,
  toCreateHourEntryBody,
  type LogHoursFormInput,
} from "../schemas/hour-entry.schema";

const TODAY = "2026-03-16";
const schema = logHoursFormSchema(TODAY);

const FIGMA: LogHoursFormInput = {
  activity: "  Preparação de material da aula 12  ",
  category: "planning",
  date: "2026-03-10",
  hours: "2h30",
  notes: " Revisão do roteiro e ajustes nos slides da aula. ",
};

/** The message of each field the schema refuses, by the name of the field. */
function messagesOf(input: LogHoursFormInput): Record<string, string> {
  const result = schema.safeParse(input);
  if (result.success) return {};

  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe("logHoursFormSchema", () => {
  it("accepts the values of the Figma and sends 150 minutes, the trimmed activity and the notes", () => {
    const result = schema.safeParse(FIGMA);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(toCreateHourEntryBody(result.data)).toEqual({
      activity: "Preparação de material da aula 12",
      category: "planning",
      date: "2026-03-10",
      declaredMinutes: 150,
      notes: "Revisão do roteiro e ajustes nos slides da aula.",
    });
  });

  it("sends blank notes as null", () => {
    const result = schema.safeParse({ ...FIGMA, notes: "   " });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(toCreateHourEntryBody(result.data).notes).toBeNull();
  });

  it("asks for the activity, the category, the date and the hours", () => {
    expect(messagesOf({ ...emptyLogHoursFormInput(TODAY), date: "" })).toEqual({
      activity: "activityRequired",
      category: "categoryRequired",
      date: "dateRequired",
      hours: "hoursRequired",
    });
    expect(messagesOf({ ...FIGMA, activity: "   " })).toEqual({ activity: "activityRequired" });
  });

  it("starts with today in the date and nothing else", () => {
    expect(emptyLogHoursFormInput(TODAY)).toEqual({
      activity: "",
      category: null,
      date: TODAY,
      hours: "",
      notes: "",
    });
  });

  it("refuses an activity over 200 characters and notes over 2000", () => {
    expect(messagesOf({ ...FIGMA, activity: "a".repeat(201), notes: "n".repeat(2001) })).toEqual({
      activity: "activityTooLong",
      notes: "notesTooLong",
    });
    expect(messagesOf({ ...FIGMA, activity: "a".repeat(200), notes: "n".repeat(2000) })).toEqual(
      {},
    );
  });

  it("refuses hours out of the 2h30 format", () => {
    expect(messagesOf({ ...FIGMA, hours: "2:30" })).toEqual({ hours: "hoursFormat" });
    expect(messagesOf({ ...FIGMA, hours: "150" })).toEqual({ hours: "hoursFormat" });
  });

  it("refuses 0h and more than 24h", () => {
    expect(messagesOf({ ...FIGMA, hours: "0h" })).toEqual({ hours: "hoursRange" });
    expect(messagesOf({ ...FIGMA, hours: "24h01" })).toEqual({ hours: "hoursRange" });
    expect(messagesOf({ ...FIGMA, hours: "24h" })).toEqual({});
    expect(messagesOf({ ...FIGMA, hours: "0h01" })).toEqual({});
  });

  it("refuses a date after today and before 2000-01-01, and accepts today", () => {
    expect(messagesOf({ ...FIGMA, date: "2026-03-17" })).toEqual({ date: "dateInFuture" });
    expect(messagesOf({ ...FIGMA, date: "1999-12-31" })).toEqual({ date: "dateTooOld" });
    expect(messagesOf({ ...FIGMA, date: "2026-02-30" })).toEqual({ date: "dateRequired" });
    expect(messagesOf({ ...FIGMA, date: TODAY })).toEqual({});
    expect(messagesOf({ ...FIGMA, date: "2000-01-01" })).toEqual({});
  });

  it("does not take lesson as a category", () => {
    const result = schema.safeParse({ ...FIGMA, category: "lesson" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path[0])).toEqual(["category"]);
  });
});
