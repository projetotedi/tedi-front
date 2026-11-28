import { describe, expect, it } from "vitest";

import { toDeactivateMemberError, toUpdateMemberError } from "../lib/member-errors";
import {
  createDeactivateMemberSchema,
  emptyDeactivateMemberValues,
  memberFormSchema,
  toDeactivateMemberBody,
  toMemberFormValues,
  toUpdateMemberBody,
  type MemberFormValues,
} from "../schemas/member.schema";
import { todayInSaoPaulo } from "../lib/student";
import { buildMemberDetail, buildSeedMemberDetail } from "./handlers";

const VALUES = toMemberFormValues(buildMemberDetail());

function apiError(statusCode: number, error: string, details?: { field: string }[]) {
  return Object.assign(new Error(error), {
    statusCode,
    error,
    ...(details ? { details: details.map(({ field }) => ({ field, message: "invalid" })) } : {}),
  });
}

/** The messages the schema gives, by field. */
function errorsOf(values: Partial<MemberFormValues>): Record<string, string> {
  const result = memberFormSchema.safeParse({ ...VALUES, ...values });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe("toMemberFormValues", () => {
  it("shows the member with the phone masked, the semester as text and the CPF empty", () => {
    expect(VALUES).toEqual({
      name: "Beatriz Nunes Carvalho",
      birthDate: "2003-09-14",
      phone: "(11) 99191-2020",
      email: "bia.nunes@email.com",
      cpf: "",
      address: "Rua Domingos de Morais, 45 — apto 32",
      city: "São Paulo",
      state: "SP",
      ra: "202400003",
      institutionalEmail: "beatriz.nunes@inst.edu.br",
      course: "Sistemas de Informação",
      semester: "5",
      className: "SI-2024-N",
      departmentId: "01952ef7-0000-7000-8000-0000000000d1",
      mainFunction: "Ministrar aulas e apoio pedagógico",
      joinedAt: "2024-03-01",
      volunteerTermUrl: "https://drive.google.com/file/d/termo-beatriz/view",
    });
  });

  it("turns every null of a person with no registration into an empty field", () => {
    const values = toMemberFormValues(buildSeedMemberDetail());

    expect(values.phone).toBe("");
    expect(values.state).toBe("");
    expect(values.semester).toBe("");
    expect(values.departmentId).toBe("");
  });

  it("upper-cases a state the API kept in lower case and drops one that is not a state", () => {
    expect(toMemberFormValues(buildMemberDetail({ state: "rj" })).state).toBe("RJ");
    expect(toMemberFormValues(buildMemberDetail({ state: "XX" })).state).toBe("");
  });
});

describe("memberFormSchema", () => {
  it("accepts the member as it came", () => {
    expect(errorsOf({})).toEqual({});
  });

  it("requires what the API never clears", () => {
    expect(
      errorsOf({
        name: " ",
        phone: "",
        email: "",
        ra: "",
        institutionalEmail: "",
        course: "",
        semester: "",
        className: "",
        mainFunction: "",
        birthDate: "",
        joinedAt: "",
      }),
    ).toEqual({
      name: "nameRequired",
      phone: "phoneRequired",
      email: "emailRequired",
      ra: "raRequired",
      institutionalEmail: "institutionalEmailRequired",
      course: "courseRequired",
      semester: "semesterRequired",
      className: "classNameRequired",
      mainFunction: "mainFunctionRequired",
      birthDate: "birthDateRequired",
      joinedAt: "joinedAtRequired",
    });
  });

  it("lets the address, the city, the state, the CPF and the volunteer term be empty", () => {
    expect(errorsOf({ address: "", city: "", state: "", cpf: "", volunteerTermUrl: "" })).toEqual(
      {},
    );
  });

  it.each([
    ["a CPF with a wrong check digit", { cpf: "529.982.247-26" }, "cpf", "cpfInvalid"],
    ["a phone without the area code", { phone: "98123-4567" }, "phone", "phoneInvalid"],
    ["a semester out of 1 to 20", { semester: "21" }, "semester", "semesterInvalid"],
    ["a semester that is not a whole number", { semester: "2.5" }, "semester", "semesterInvalid"],
    ["an e-mail without a domain", { email: "bia@" }, "email", "emailInvalid"],
    ["a join date before 2000", { joinedAt: "1999-12-31" }, "joinedAt", "joinedAtInvalid"],
    ["a join date in the future", { joinedAt: "2999-01-01" }, "joinedAt", "joinedAtInvalid"],
    ["a birth date before 1900", { birthDate: "1899-12-31" }, "birthDate", "birthDateInvalid"],
    [
      "a volunteer term that is not HTTPS",
      { volunteerTermUrl: "http://drive.google.com/x" },
      "volunteerTermUrl",
      "volunteerTermUrlInvalid",
    ],
    [
      "a volunteer term longer than the API takes",
      { volunteerTermUrl: `https://drive.google.com/${"a".repeat(500)}` },
      "volunteerTermUrl",
      "volunteerTermUrlMax",
    ],
  ])("refuses %s", (_label, values, field, message) => {
    expect(errorsOf(values)[field]).toBe(message);
  });
});

describe("toUpdateMemberBody", () => {
  it("is empty when nothing changed", () => {
    expect(toUpdateMemberBody(VALUES, VALUES)).toEqual({});
  });

  it("is empty when only spaces or the mask of the phone changed", () => {
    expect(
      toUpdateMemberBody({ ...VALUES, name: ` ${VALUES.name} `, phone: "11991912020" }, VALUES),
    ).toEqual({});
  });

  it("sends only the changed fields, trimmed, the phone in digits and the semester as a number", () => {
    expect(
      toUpdateMemberBody(
        { ...VALUES, name: " Beatriz Nunes ", phone: "(11) 3333-4444", semester: "6" },
        VALUES,
      ),
    ).toEqual({ name: "Beatriz Nunes", phone: "1133334444", semester: 6 });
  });

  it("sends null for a cleared address, city, state or volunteer term", () => {
    expect(
      toUpdateMemberBody(
        { ...VALUES, address: " ", city: "", state: "", volunteerTermUrl: "" },
        VALUES,
      ),
    ).toEqual({ address: null, city: null, state: null, volunteerTermUrl: null });
  });

  it("sends a typed CPF in digits, and never an empty one", () => {
    expect(toUpdateMemberBody({ ...VALUES, cpf: "529.982.247-25" }, VALUES)).toEqual({
      cpf: "52998224725",
    });
    expect(toUpdateMemberBody({ ...VALUES, cpf: "" }, VALUES)).toEqual({});
  });

  it("sends a new department, and never clears it", () => {
    const other = "01952ef7-0000-7000-8000-0000000000d2";
    expect(toUpdateMemberBody({ ...VALUES, departmentId: other }, VALUES)).toEqual({
      departmentId: other,
    });
    expect(toUpdateMemberBody({ ...VALUES, departmentId: "" }, VALUES)).toEqual({});
  });
});

describe("the deactivation form", () => {
  const today = todayInSaoPaulo();

  it("starts with the exit date of today and no reason", () => {
    expect(emptyDeactivateMemberValues()).toEqual({ exitDate: today, reason: "", note: "" });
  });

  it.each([
    ["no exit date", { exitDate: "" }, "exitDate", "exitDateRequired"],
    ["an exit date in the future", { exitDate: "2999-01-01" }, "exitDate", "exitDateInvalid"],
    ["an exit date before 2000", { exitDate: "1999-12-31" }, "exitDate", "exitDateInvalid"],
    [
      "an exit date before the join",
      { exitDate: "2024-02-29" },
      "exitDate",
      "exitDateBeforeJoinedAt",
    ],
    ["a blank reason", { reason: "   " }, "reason", "reasonRequired"],
    ["a reason longer than 200", { reason: "a".repeat(201) }, "reason", "reasonMax"],
    ["a note longer than 2000", { note: "a".repeat(2001) }, "note", "noteMax"],
  ])("refuses %s", (_label, values, field, message) => {
    const result = createDeactivateMemberSchema("2024-03-01").safeParse({
      exitDate: today,
      reason: "Formou-se.",
      note: "",
      ...values,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
  });

  it("takes any exit date up to today when the join date is not known", () => {
    const result = createDeactivateMemberSchema(null).safeParse({
      exitDate: "2000-01-01",
      reason: "Formou-se.",
      note: "",
    });

    expect(result.success).toBe(true);
  });

  it("sends the reason trimmed and the note only when there is one", () => {
    expect(
      toDeactivateMemberBody({ exitDate: "2026-06-30", reason: " Formou-se. ", note: "  " }),
    ).toEqual({ exitDate: "2026-06-30", reason: "Formou-se." });
    expect(
      toDeactivateMemberBody({ exitDate: "2026-06-30", reason: "Formou-se.", note: " Mestrado " }),
    ).toEqual({ exitDate: "2026-06-30", reason: "Formou-se.", note: "Mestrado" });
  });
});

describe("toUpdateMemberError", () => {
  it.each([
    [apiError(409, "RA_ALREADY_IN_USE"), [{ name: "ra", message: "raInUse" }]],
    [apiError(409, "EMAIL_ALREADY_IN_USE"), [{ name: "email", message: "emailInUse" }]],
    [
      apiError(400, "DEPARTMENT_NOT_FOUND"),
      [{ name: "departmentId", message: "departmentNotFound" }],
    ],
    [apiError(403, "DEPARTMENT_SCOPE"), [{ name: "departmentId", message: "departmentScope" }]],
  ])("puts %o on its field", (error, fields) => {
    expect(toUpdateMemberError(error)).toEqual({ kind: "fields", fields });
  });

  it("puts the fields of a 400 VALIDATION_FAILED on the form, in its order, and ignores unknown ones", () => {
    expect(
      toUpdateMemberError(
        apiError(400, "VALIDATION_FAILED", [
          { field: "semester" },
          { field: "phone" },
          { field: "somethingElse" },
        ]),
      ),
    ).toEqual({
      kind: "fields",
      fields: [
        { name: "phone", message: "phoneInvalid" },
        { name: "semester", message: "semesterInvalid" },
      ],
    });
    expect(toUpdateMemberError(apiError(400, "VALIDATION_FAILED"))).toEqual({
      kind: "invalidData",
    });
  });

  it.each([
    [apiError(403, "FORBIDDEN"), "forbidden"],
    [apiError(403, "FORBIDDEN_SCOPE"), "forbidden"],
    [apiError(404, "MEMBER_NOT_FOUND"), "notFound"],
    [apiError(409, "NO_MEMBER_PROFILE"), "noMemberProfile"],
    [apiError(409, "REGISTRATION_NOT_APPROVED"), "registrationNotApproved"],
    [apiError(409, "MEMBER_INACTIVE"), "memberInactive"],
    [apiError(503, "SERVICE_UNAVAILABLE"), "network"],
    [new TypeError("Failed to fetch"), "network"],
    [apiError(500, "INTERNAL"), "unknown"],
  ])("says %o above the form", (error, kind) => {
    expect(toUpdateMemberError(error)).toEqual({ kind });
  });
});

describe("toDeactivateMemberError", () => {
  it("puts EXIT_DATE_BEFORE_JOINED_AT and the fields of a 400 on the form", () => {
    expect(toDeactivateMemberError(apiError(400, "EXIT_DATE_BEFORE_JOINED_AT"))).toEqual({
      kind: "fields",
      fields: [{ name: "exitDate", message: "exitDateBeforeJoinedAt" }],
    });
    expect(
      toDeactivateMemberError(apiError(400, "VALIDATION_FAILED", [{ field: "reason" }])),
    ).toEqual({ kind: "fields", fields: [{ name: "reason", message: "reasonRequired" }] });
  });

  it.each([
    [apiError(403, "OWN_ACCOUNT"), "ownAccount"],
    [apiError(403, "FORBIDDEN"), "forbidden"],
    [apiError(404, "MEMBER_NOT_FOUND"), "notFound"],
    [apiError(409, "LAST_COORDINATOR"), "lastCoordinator"],
    [apiError(409, "MEMBER_INACTIVE"), "alreadyInactive"],
    [apiError(409, "NO_MEMBER_PROFILE"), "noMemberProfile"],
    [apiError(409, "REGISTRATION_NOT_APPROVED"), "registrationNotApproved"],
    [apiError(400, "VALIDATION_FAILED"), "invalidData"],
    [apiError(502, "BAD_GATEWAY"), "network"],
    [apiError(500, "INTERNAL"), "unknown"],
  ])("says %o above the buttons", (error, kind) => {
    expect(toDeactivateMemberError(error)).toEqual({ kind });
  });
});
