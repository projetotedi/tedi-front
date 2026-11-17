import { z } from "zod";

import { Weekday, type GenerateClassLessonsDto } from "@api/generated/model";
import {
  generateClassLessonsBodyEndTimeRegExp,
  generateClassLessonsBodyLocationMax,
  generateClassLessonsBodyStartTimeRegExp,
} from "@api/generated/zod/lessons/lessons";

export const GENERATE_LESSONS_LIMITS = {
  locationMax: generateClassLessonsBodyLocationMax,
} as const;

/**
 * What the fields of "Gerar aulas da turma" hold: the weekday starts empty (the person chooses
 * it), the times and the date are the text of the inputs and the location is free text.
 */
export interface GenerateLessonsFormInput {
  weekday: Weekday | "";
  startTime: string;
  endTime: string;
  firstDate: string;
  location: string;
}

/**
 * The form is not the DTO (`GenerateClassLessonsBody`): the weekday is empty until it is chosen, a
 * blank location is `null` in the body and the end of the lesson has to come after its start. So
 * the form has its own schema, which still takes the pattern of the times and the limit of the
 * location from the generated one, so the front and the API do not drift apart. The messages are
 * keys of `generate.fieldErrors`. Whether the lessons fit the period of the class, and whether
 * they were already generated, is the API's to say.
 */
export const generateLessonsFormSchema = z
  .object({
    // `""` is the empty field: it is accepted as input and refused by the enum on the way out.
    weekday: z.union([z.enum(Weekday), z.literal("")]).pipe(z.enum(Weekday, "weekdayRequired")),
    startTime: z.string().regex(generateClassLessonsBodyStartTimeRegExp, "startTimeInvalid"),
    endTime: z.string().regex(generateClassLessonsBodyEndTimeRegExp, "endTimeInvalid"),
    firstDate: z.iso.date("firstDateInvalid"),
    location: z.string().trim().max(GENERATE_LESSONS_LIMITS.locationMax, "locationTooLong"),
  })
  .superRefine((values, context) => {
    const hasBothTimes =
      generateClassLessonsBodyStartTimeRegExp.test(values.startTime) &&
      generateClassLessonsBodyEndTimeRegExp.test(values.endTime);

    // `HH:mm` in 24 hours sorts as text, and a lesson does not cross midnight (INVALID_TIME_RANGE).
    if (hasBothTimes && values.endTime <= values.startTime) {
      context.addIssue({ code: "custom", path: ["endTime"], message: "endTimeBeforeStart" });
    }
  });

export type GenerateLessonsFormValues = z.output<typeof generateLessonsFormSchema>;

/** The body of generate (and of the preview): a blank location is not informed, so `null`. */
export function toGenerateClassLessonsBody(
  values: GenerateLessonsFormValues,
): GenerateClassLessonsDto {
  return {
    weekday: values.weekday,
    startTime: values.startTime,
    endTime: values.endTime,
    firstDate: values.firstDate,
    location: values.location === "" ? null : values.location,
  };
}

/**
 * The body of the preview, or `null` while a field is missing or invalid, so the screen never asks
 * the API about half a form. It is the same body that Gerar aulas sends.
 */
export function toPreviewBody(input: GenerateLessonsFormInput): GenerateClassLessonsDto | null {
  const result = generateLessonsFormSchema.safeParse(input);

  return result.success ? toGenerateClassLessonsBody(result.data) : null;
}
