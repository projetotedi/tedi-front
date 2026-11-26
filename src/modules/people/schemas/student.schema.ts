import { z } from "zod";

import {
  AccessibilityNeed,
  type CreateStudentDto,
  type StudentDetailDto,
  type UpdateStudentDto,
} from "@api/generated/model";
import {
  archiveStudentBodyReasonMax,
  createStudentBodyClassNeedsMax,
  createStudentBodyEducationMax,
  createStudentBodyEmailMax,
  createStudentBodyEmergencyContactNameMax,
  createStudentBodyHowFoundUsMax,
  createStudentBodyNameMax,
  createStudentBodySupportResourceMax,
} from "@api/generated/zod/people/people";

import { maskPhone } from "../lib/format";
import { isValidBirthDate } from "../lib/student";

export const STUDENT_LIMITS = {
  nameMax: createStudentBodyNameMax,
  emailMax: createStudentBodyEmailMax,
  educationMax: createStudentBodyEducationMax,
  howFoundUsMax: createStudentBodyHowFoundUsMax,
  emergencyContactNameMax: createStudentBodyEmergencyContactNameMax,
  supportResourceMax: createStudentBodySupportResourceMax,
  classNeedsMax: createStudentBodyClassNeedsMax,
  reasonMax: archiveStudentBodyReasonMax,
} as const;

/** "Sim", "Não" or not answered: the API keeps `null` for the last one. */
export type YesNo = "" | "yes" | "no";

const PHONE_DIGITS = /^\d{10,13}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const optionalText = (max: number, message: string) => z.string().trim().max(max, message);

const optionalPhone = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || PHONE_DIGITS.test(onlyDigits(value)), message);

const yesNo = z.enum(["", "yes", "no"]);

/**
 * The form of Novo aluno and Editar dados do aluno (GUS-123). Only the name and the birth date are
 * required; the messages are keys of `student.form.errors`, which take `STUDENT_LIMITS`.
 */
export const studentFormSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(STUDENT_LIMITS.nameMax, "nameTooLong"),
  birthDate: z
    .string()
    .min(1, { message: "birthDateRequired", abort: true })
    .refine((value) => isValidBirthDate(value), "birthDateInvalid"),
  phone: optionalPhone("phoneInvalid"),
  email: z
    .string()
    .trim()
    .max(STUDENT_LIMITS.emailMax, "emailTooLong")
    .refine((value) => value === "" || EMAIL.test(value), "emailInvalid"),
  education: optionalText(STUDENT_LIMITS.educationMax, "educationTooLong"),
  hasSmartphone: yesNo,
  hasComputer: yesNo,
  howFoundUs: optionalText(STUDENT_LIMITS.howFoundUsMax, "howFoundUsTooLong"),
  emergencyContactName: optionalText(
    STUDENT_LIMITS.emergencyContactNameMax,
    "emergencyContactNameTooLong",
  ),
  emergencyContactPhone: optionalPhone("phoneInvalid"),
  accessibilityNeed: z.enum(AccessibilityNeed),
  supportResource: optionalText(STUDENT_LIMITS.supportResourceMax, "supportResourceTooLong"),
  classNeeds: optionalText(STUDENT_LIMITS.classNeedsMax, "classNeedsTooLong"),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;

export function emptyStudentFormValues(): StudentFormValues {
  return {
    name: "",
    birthDate: "",
    phone: "",
    email: "",
    education: "",
    hasSmartphone: "",
    hasComputer: "",
    howFoundUs: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    accessibilityNeed: AccessibilityNeed.none,
    supportResource: "",
    classNeeds: "",
  };
}

function toYesNo(value: boolean | null): YesNo {
  if (value === null) return "";
  return value ? "yes" : "no";
}

function fromYesNo(value: YesNo): boolean | null {
  return value === "" ? null : value === "yes";
}

/** The student as the form shows it: `null` is the empty field and the phones are masked. */
export function toStudentFormValues(student: StudentDetailDto): StudentFormValues {
  return {
    name: student.name,
    birthDate: student.birthDate,
    phone: maskPhone(student.phone ?? ""),
    email: student.email ?? "",
    education: student.education ?? "",
    hasSmartphone: toYesNo(student.hasSmartphone),
    hasComputer: toYesNo(student.hasComputer),
    howFoundUs: student.howFoundUs ?? "",
    emergencyContactName: student.emergencyContact.name ?? "",
    emergencyContactPhone: maskPhone(student.emergencyContact.phone ?? ""),
    accessibilityNeed: student.accessibilityNeed,
    supportResource: student.supportResource ?? "",
    classNeeds: student.classNeeds ?? "",
  };
}

/** The body the API takes: trimmed, the phones in digits and an empty field as `null`. */
function toBody(values: StudentFormValues): Required<CreateStudentDto> {
  const text = (value: string) => {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };
  const phone = (value: string) => text(onlyDigits(value));

  return {
    name: values.name.trim(),
    birthDate: values.birthDate,
    phone: phone(values.phone),
    email: text(values.email),
    education: text(values.education),
    hasSmartphone: fromYesNo(values.hasSmartphone),
    hasComputer: fromYesNo(values.hasComputer),
    howFoundUs: text(values.howFoundUs),
    emergencyContactName: text(values.emergencyContactName),
    emergencyContactPhone: phone(values.emergencyContactPhone),
    accessibilityNeed: values.accessibilityNeed,
    supportResource: text(values.supportResource),
    classNeeds: text(values.classNeeds),
  };
}

export function toCreateStudentBody(values: StudentFormValues): CreateStudentDto {
  return toBody(values);
}

/**
 * Only what changed: the API leaves an omitted field as it is and clears one sent as `null`. An
 * empty object means nothing changed, and the form makes no request.
 */
export function toUpdateStudentBody(
  values: StudentFormValues,
  initial: StudentFormValues,
): UpdateStudentDto {
  const next = toBody(values);
  const before = toBody(initial);
  const changed: Record<string, unknown> = {};

  for (const key of Object.keys(next) as (keyof CreateStudentDto)[]) {
    if (next[key] !== before[key]) changed[key] = next[key];
  }
  return changed as UpdateStudentDto;
}

/** Arquivar aluno: only the reason, optional. */
export const archiveStudentFormSchema = z.object({
  reason: z.string().trim().max(STUDENT_LIMITS.reasonMax, "reasonTooLong"),
});

export type ArchiveStudentFormValues = z.infer<typeof archiveStudentFormSchema>;
