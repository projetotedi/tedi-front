import { z } from "zod";

import {
  correctStudentAttendanceBodyReasonMax,
  justifyAbsenceBodyNoteMax,
} from "@api/generated/zod/attendance/attendance";

import { RollCallStatus } from "../lib/roll-call";

const status = z.enum([RollCallStatus.present, RollCallStatus.absent], "statusRequired");

export const justifyAbsenceFormSchema = z.object({
  reason: z.string().trim().min(1, "reasonRequired").max(justifyAbsenceBodyNoteMax, "tooLong"),
});

export const correctStudentFormSchema = z.object({
  status,
  reason: z
    .string()
    .trim()
    .min(1, "correctionReasonRequired")
    .max(correctStudentAttendanceBodyReasonMax, "tooLong"),
});

export type JustifyAbsenceForm = z.output<typeof justifyAbsenceFormSchema>;
export type CorrectStudentForm = z.output<typeof correctStudentFormSchema>;
