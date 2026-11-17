import { z } from "zod";

import { ClassStatus } from "@api/generated/model";

/**
 * The form of a class has no level: the level is the category of the course, read from the course
 * (RN-14), so there is nothing to type and nothing to send.
 */
export const classFormSchema = z
  .object({
    courseId: z.string().min(1, "required"),
    code: z.string().trim().min(1, "required"),
    edition: z
      .string()
      .trim()
      .regex(/^\d{4}(?:\.\d+)?$/, "invalidEdition"),
    start: z.string().min(1, "required"),
    end: z.string().min(1, "required"),
    location: z.string(),
    capacity: z.number().int("invalidCapacity").positive("invalidCapacity"),
    status: z.enum(ClassStatus),
  })
  .superRefine((values, context) => {
    if (values.start && values.end && values.end < values.start) {
      context.addIssue({ code: "custom", path: ["end"], message: "invalidPeriod" });
    }
  });

export type ClassFormValues = z.infer<typeof classFormSchema>;
