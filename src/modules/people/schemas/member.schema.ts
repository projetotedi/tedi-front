import { z } from "zod";

import {
  BrazilianState,
  type DeactivateMemberDto,
  type MemberDetailResponseDto,
  type UpdateMemberDto,
} from "@api/generated/model";
import {
  deactivateMemberBodyNoteMax,
  deactivateMemberBodyReasonMax,
  updateMemberBodyAddressMax,
  updateMemberBodyCityMax,
  updateMemberBodyClassNameMax,
  updateMemberBodyCourseMax,
  updateMemberBodyEmailMax,
  updateMemberBodyInstitutionalEmailMax,
  updateMemberBodyMainFunctionMax,
  updateMemberBodyNameMax,
  updateMemberBodyRaMax,
  updateMemberBodySemesterMax,
  updateMemberBodyVolunteerTermUrlMax,
} from "@api/generated/zod/people/people";
import { isCalendarDate, isValidCpf } from "@modules/auth";

import { maskPhone } from "../lib/format";
import { isValidBirthDate, todayInSaoPaulo } from "../lib/student";

/** The limits of `UpdateMemberDto` and `DeactivateMemberDto`, which the messages also take. */
export const MEMBER_LIMITS = {
  nameMax: updateMemberBodyNameMax,
  emailMax: updateMemberBodyEmailMax,
  addressMax: updateMemberBodyAddressMax,
  cityMax: updateMemberBodyCityMax,
  raMax: updateMemberBodyRaMax,
  courseMax: updateMemberBodyCourseMax,
  semesterMin: 1,
  semesterMax: updateMemberBodySemesterMax,
  classNameMax: updateMemberBodyClassNameMax,
  institutionalEmailMax: updateMemberBodyInstitutionalEmailMax,
  mainFunctionMax: updateMemberBodyMainFunctionMax,
  volunteerTermUrlMax: updateMemberBodyVolunteerTermUrlMax,
  reasonMax: deactivateMemberBodyReasonMax,
  noteMax: deactivateMemberBodyNoteMax,
} as const;

/** The first day the API takes as the join or the exit date of a member. */
const MIN_PROJECT_DATE = "2000-01-01";

const PHONE_DIGITS = /^\d{10,13}$/;
const WHOLE_NUMBER = /^\d+$/;
const BRAZILIAN_STATES: readonly string[] = Object.values(BrazilianState);

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** A real day from `MIN_PROJECT_DATE` up to today in America/Sao_Paulo, the rule of the API. */
function isProjectDate(value: string): boolean {
  return isCalendarDate(value) && value >= MIN_PROJECT_DATE && value <= todayInSaoPaulo();
}

/** The volunteer term is a link to the Drive, and the API takes only HTTPS. */
function isHttpsUrl(value: string): boolean {
  if (/\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

const requiredText = (max: number, requiredMessage: string, maxMessage: string) =>
  z.string().trim().min(1, { message: requiredMessage, abort: true }).max(max, maxMessage);

const optionalText = (max: number, maxMessage: string) => z.string().trim().max(max, maxMessage);

const requiredEmail = (max: number, requiredMessage: string, invalidMessage: string) =>
  z
    .string()
    .trim()
    .min(1, { message: requiredMessage, abort: true })
    .max(max, { message: invalidMessage, abort: true })
    .pipe(z.email({ message: invalidMessage }));

/**
 * The form of Editar membro (GUS-148, GUS-194). The fields the API never clears are required; the
 * address, the city, the state and the volunteer term can be emptied. The CPF starts empty because
 * `GET /members/:id` only brings it masked (RNF-14): it is checked, and sent, only when typed. The
 * messages are keys of `member.edit.errors`, which take `MEMBER_LIMITS`.
 */
export const memberFormSchema = z.object({
  name: requiredText(MEMBER_LIMITS.nameMax, "nameRequired", "nameMax"),
  birthDate: z
    .string()
    .min(1, { message: "birthDateRequired", abort: true })
    .refine((value) => isValidBirthDate(value), "birthDateInvalid"),
  phone: z
    .string()
    .trim()
    .min(1, { message: "phoneRequired", abort: true })
    .refine((value) => PHONE_DIGITS.test(onlyDigits(value)), "phoneInvalid"),
  email: requiredEmail(MEMBER_LIMITS.emailMax, "emailRequired", "emailInvalid"),
  cpf: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidCpf(value), "cpfInvalid"),
  address: optionalText(MEMBER_LIMITS.addressMax, "addressMax"),
  city: optionalText(MEMBER_LIMITS.cityMax, "cityMax"),
  state: z.union([z.literal(""), z.enum(BrazilianState)], { error: "stateInvalid" }),
  ra: requiredText(MEMBER_LIMITS.raMax, "raRequired", "raMax"),
  institutionalEmail: requiredEmail(
    MEMBER_LIMITS.institutionalEmailMax,
    "institutionalEmailRequired",
    "institutionalEmailInvalid",
  ),
  course: requiredText(MEMBER_LIMITS.courseMax, "courseRequired", "courseMax"),
  semester: z
    .string()
    .trim()
    .min(1, { message: "semesterRequired", abort: true })
    .refine((value) => {
      const semester = Number(value);
      return (
        WHOLE_NUMBER.test(value) &&
        semester >= MEMBER_LIMITS.semesterMin &&
        semester <= MEMBER_LIMITS.semesterMax
      );
    }, "semesterInvalid"),
  className: requiredText(MEMBER_LIMITS.classNameMax, "classNameRequired", "classNameMax"),
  departmentId: z.string(),
  mainFunction: requiredText(
    MEMBER_LIMITS.mainFunctionMax,
    "mainFunctionRequired",
    "mainFunctionMax",
  ),
  joinedAt: z
    .string()
    .min(1, { message: "joinedAtRequired", abort: true })
    .refine(isProjectDate, "joinedAtInvalid"),
  volunteerTermUrl: z
    .string()
    .trim()
    .max(MEMBER_LIMITS.volunteerTermUrlMax, { message: "volunteerTermUrlMax", abort: true })
    .refine((value) => value === "" || isHttpsUrl(value), "volunteerTermUrlInvalid"),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;
export type MemberFormFieldName = keyof MemberFormValues;

/** The fields in the order of the form: the focus goes to the first one with an error. */
export const MEMBER_FORM_FIELDS: readonly MemberFormFieldName[] = [
  "name",
  "birthDate",
  "phone",
  "email",
  "cpf",
  "address",
  "city",
  "state",
  "ra",
  "institutionalEmail",
  "course",
  "semester",
  "className",
  "departmentId",
  "mainFunction",
  "joinedAt",
  "volunteerTermUrl",
];

function toStateValue(state: string | null): MemberFormValues["state"] {
  const upper = state?.toUpperCase() ?? "";
  return BRAZILIAN_STATES.includes(upper) ? (upper as BrazilianState) : "";
}

/** The member as the form shows it: `null` is the empty field and the phone is masked. */
export function toMemberFormValues(member: MemberDetailResponseDto): MemberFormValues {
  return {
    name: member.name,
    birthDate: member.birthDate ?? "",
    phone: maskPhone(member.phone ?? ""),
    email: member.email ?? "",
    cpf: "",
    address: member.address ?? "",
    city: member.city ?? "",
    state: toStateValue(member.state),
    ra: member.ra ?? "",
    institutionalEmail: member.institutionalEmail ?? "",
    course: member.course ?? "",
    semester: member.semester === null ? "" : String(member.semester),
    className: member.className ?? "",
    departmentId: member.department?.id ?? "",
    mainFunction: member.mainFunction ?? "",
    joinedAt: member.joinedAt ?? "",
    volunteerTermUrl: member.volunteerTermUrl ?? "",
  };
}

/**
 * The body the API takes: trimmed, the phone and the CPF in digits, the semester as a number and a
 * cleared optional field as `null`. The CPF and the department are left out while empty: the API
 * never clears them.
 */
function toBody(values: MemberFormValues): UpdateMemberDto {
  const text = (value: string) => {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };
  const cpf = onlyDigits(values.cpf);

  return {
    name: values.name.trim(),
    birthDate: values.birthDate,
    phone: onlyDigits(values.phone),
    email: values.email.trim(),
    ...(cpf !== "" ? { cpf } : {}),
    address: text(values.address),
    city: text(values.city),
    state: values.state === "" ? null : values.state,
    ra: values.ra.trim(),
    institutionalEmail: values.institutionalEmail.trim(),
    course: values.course.trim(),
    semester: Number(values.semester),
    className: values.className.trim(),
    ...(values.departmentId !== "" ? { departmentId: values.departmentId } : {}),
    mainFunction: values.mainFunction.trim(),
    joinedAt: values.joinedAt,
    volunteerTermUrl: text(values.volunteerTermUrl),
  };
}

/**
 * Only what changed: the API keeps an omitted field and clears one sent as `null`. A typed CPF is
 * always sent, because the form never knows the one that is saved. An empty object means nothing
 * changed, and the form makes no request.
 */
export function toUpdateMemberBody(
  values: MemberFormValues,
  initial: MemberFormValues,
): UpdateMemberDto {
  const next = toBody(values);
  const before = toBody(initial);
  const changed: Record<string, unknown> = {};

  for (const key of Object.keys(next) as (keyof UpdateMemberDto)[]) {
    if (next[key] !== before[key]) changed[key] = next[key];
  }
  return changed as UpdateMemberDto;
}

/**
 * Inativar membro (GUS-149, GUS-194): the exit date (a real day from 2000-01-01 up to today, and not
 * before the member joined the project), the reason, required, and an optional note. The messages
 * are keys of `member.deactivate.errors`, which take `MEMBER_LIMITS`.
 */
export function createDeactivateMemberSchema(joinedAt: string | null) {
  return z.object({
    exitDate: z
      .string()
      .min(1, { message: "exitDateRequired", abort: true })
      .refine(isProjectDate, { message: "exitDateInvalid", abort: true })
      .refine((value) => joinedAt === null || value >= joinedAt, "exitDateBeforeJoinedAt"),
    reason: requiredText(MEMBER_LIMITS.reasonMax, "reasonRequired", "reasonMax"),
    note: optionalText(MEMBER_LIMITS.noteMax, "noteMax"),
  });
}

export type DeactivateMemberFormValues = z.infer<ReturnType<typeof createDeactivateMemberSchema>>;
export type DeactivateMemberFieldName = keyof DeactivateMemberFormValues;

/** The fields in the order of the dialog: the focus goes to the first one with an error. */
export const DEACTIVATE_MEMBER_FIELDS: readonly DeactivateMemberFieldName[] = [
  "exitDate",
  "reason",
  "note",
];

/** The exit date starts on today, the most common case. */
export function emptyDeactivateMemberValues(): DeactivateMemberFormValues {
  return { exitDate: todayInSaoPaulo(), reason: "", note: "" };
}

/** The body of `PATCH /members/:id/deactivate`: trimmed, and without the note when it is empty. */
export function toDeactivateMemberBody(values: DeactivateMemberFormValues): DeactivateMemberDto {
  const note = values.note.trim();
  return {
    exitDate: values.exitDate,
    reason: values.reason.trim(),
    ...(note !== "" ? { note } : {}),
  };
}
