import { z } from "zod";

import type { CreateHourEntryDto } from "@api/generated/model";
import {
  logMyHoursBodyActivityMax,
  logMyHoursBodyDeclaredMinutesMax,
  logMyHoursBodyNotesMax,
} from "@api/generated/zod/hours/hours";

import { isCalendarDate } from "../lib/entry-format";
import { LOGGABLE_CATEGORIES, type LoggableCategory } from "../lib/entry-labels";
import { parseHoursInput } from "../lib/hours-input";

/** The first day the API takes (the description of `date` in the contract, which has no `minimum` for dates). */
export const HOUR_ENTRY_MIN_DATE = "2000-01-01";

/**
 * The form of "Lançar horas". It is not the DTO (`LogMyHoursBody`): the hours are typed as text in
 * the format of the TEDI ("2h30") and sent as minutes; the category starts with no choice (`null`)
 * and never offers `lesson`, which the API refuses (RN-03); the date is the text of the native
 * field, which is `""` while it is not a whole day, so a date that is not one reads as "Informe a
 * data.". The limits come from the contract (the same for logging for oneself and for a member), so
 * the front and the API do not drift apart. `today` is the last day accepted: the API refuses a day
 * after today with 400 `HOUR_ENTRY_DATE_IN_FUTURE`. The messages are keys of `logHours.fieldErrors`.
 */
export function logHoursFormSchema(today: string) {
  return z.object({
    activity: z
      .string()
      .trim()
      .min(1, "activityRequired")
      .max(logMyHoursBodyActivityMax, "activityTooLong"),
    category: z
      .enum(LOGGABLE_CATEGORIES)
      .nullable()
      .refine((category): category is LoggableCategory => category !== null, "categoryRequired"),
    // One message at a time: a date that is missing is not also "before 2000".
    date: z.string().superRefine((value, ctx) => {
      if (!isCalendarDate(value)) {
        ctx.addIssue({ code: "custom", message: "dateRequired" });
        return;
      }
      if (value < HOUR_ENTRY_MIN_DATE) {
        ctx.addIssue({ code: "custom", message: "dateTooOld" });
        return;
      }
      if (value > today) ctx.addIssue({ code: "custom", message: "dateInFuture" });
    }),
    hours: z.string().transform((value, ctx) => {
      const text = value.trim();
      if (text === "") {
        ctx.addIssue({ code: "custom", message: "hoursRequired" });
        return z.NEVER;
      }
      const minutes = parseHoursInput(text);
      if (minutes === null) {
        ctx.addIssue({ code: "custom", message: "hoursFormat" });
        return z.NEVER;
      }
      if (minutes < 1 || minutes > logMyHoursBodyDeclaredMinutesMax) {
        ctx.addIssue({ code: "custom", message: "hoursRange" });
        return z.NEVER;
      }
      return minutes;
    }),
    notes: z.string().trim().max(logMyHoursBodyNotesMax, "notesTooLong"),
  });
}

export type LogHoursFormInput = z.input<ReturnType<typeof logHoursFormSchema>>;
export type LogHoursFormValues = z.output<ReturnType<typeof logHoursFormSchema>>;

/** What the form starts with: today in Data and everything else empty. */
export function emptyLogHoursFormInput(today: string): LogHoursFormInput {
  return { activity: "", category: null, date: today, hours: "", notes: "" };
}

/** The body of `POST /me/hour-entries` and of `POST /members/:id/hour-entries`: blank notes are none, so `null`. */
export function toCreateHourEntryBody(values: LogHoursFormValues): CreateHourEntryDto {
  return {
    activity: values.activity,
    category: values.category,
    date: values.date,
    declaredMinutes: values.hours,
    notes: values.notes === "" ? null : values.notes,
  };
}
