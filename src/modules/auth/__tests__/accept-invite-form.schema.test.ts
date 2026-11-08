import { describe, expect, expectTypeOf, it } from "vitest";

import type { BrazilianState, MemberRegistrationFormDto } from "@api/generated/model";
import { acceptInviteBodyPasswordMin } from "@api/generated/zod/auth/auth";

import { todayInSaoPaulo } from "../lib/birth-date";
import {
  academicStepSchema,
  acceptInviteFormSchema,
  FORM_FIELD_ORDER,
  personalStepSchema,
  REGISTRATION_LIMITS,
  STEP_ONE_FIELDS,
  STEP_OF_FIELD,
  STEP_THREE_FIELDS,
  STEP_TWO_FIELDS,
  type AcceptInviteFormInput,
  type AcceptInviteFormOutput,
} from "../schemas/accept-invite-form.schema";

const DEPARTMENT_ID = "01999a3e-1111-7000-8000-000000000001";

const VALID_VALUES: AcceptInviteFormInput = {
  ra: "202600117",
  institutionalEmail: "lucas@instituicao.edu.br",
  course: "Sistemas de Informação",
  semester: "3",
  className: "SI-2024-N",
  departmentId: "",
  volunteerTermUrl: "",
  name: "Lucas Andrade Souza",
  birthDate: "1999-07-22",
  cpf: "529.982.247-25",
  phone: "(11) 98123-4567",
  personalEmail: "lucas@example.com",
  address: "",
  city: "",
  state: "",
  password: "senha-segura-1",
  passwordConfirmation: "senha-segura-1",
};

const EMPTY_VALUES: AcceptInviteFormInput = {
  ...VALID_VALUES,
  ra: "",
  institutionalEmail: "",
  course: "",
  semester: "",
  className: "",
  name: "",
  birthDate: "",
  cpf: "",
  phone: "",
  personalEmail: "",
  password: "",
  passwordConfirmation: "",
};

function messagesFor(values: unknown): Record<string, string[]> {
  const result = acceptInviteFormSchema.safeParse(values);
  if (result.success) return {};

  const messages: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    (messages[field] ??= []).push(issue.message);
  }
  return messages;
}

function parse(overrides: Partial<AcceptInviteFormInput>): AcceptInviteFormOutput {
  const result = acceptInviteFormSchema.safeParse({ ...VALID_VALUES, ...overrides });
  if (!result.success) throw new Error(JSON.stringify(result.error.issues));
  return result.data;
}

function invalid(overrides: Partial<AcceptInviteFormInput>): Record<string, string[]> {
  return messagesFor({ ...VALID_VALUES, ...overrides });
}

describe("acceptInviteFormSchema", () => {
  it("accepts a complete payload with the optional fields empty", () => {
    expect(acceptInviteFormSchema.safeParse(VALID_VALUES).success).toBe(true);
  });

  it("turns the masked text into the values of the contract", () => {
    expect(parse({})).toEqual({
      ra: "202600117",
      institutionalEmail: "lucas@instituicao.edu.br",
      course: "Sistemas de Informação",
      semester: 3,
      className: "SI-2024-N",
      departmentId: undefined,
      volunteerTermUrl: undefined,
      name: "Lucas Andrade Souza",
      birthDate: "1999-07-22",
      cpf: "52998224725",
      phone: "11981234567",
      personalEmail: "lucas@example.com",
      address: undefined,
      city: undefined,
      state: undefined,
      password: "senha-segura-1",
      passwordConfirmation: "senha-segura-1",
    });
  });

  it("keeps the optional fields that were filled in", () => {
    expect(
      parse({
        departmentId: DEPARTMENT_ID,
        volunteerTermUrl: "https://drive.google.com/file/d/termo/view",
        address: "Rua das Acácias, 120",
        city: "São Paulo",
        state: "SP",
      }),
    ).toMatchObject({
      departmentId: DEPARTMENT_ID,
      volunteerTermUrl: "https://drive.google.com/file/d/termo/view",
      address: "Rua das Acácias, 120",
      city: "São Paulo",
      state: "SP",
    });
  });

  it("trims every text in the validated output", () => {
    expect(
      parse({
        ra: " 202600117 ",
        institutionalEmail: " lucas@instituicao.edu.br ",
        course: "  Sistemas de Informação ",
        className: " SI-2024-N ",
        name: "  Lucas Andrade Souza ",
        personalEmail: " lucas@example.com ",
        address: "  Rua das Acácias ",
        city: " São Paulo  ",
        volunteerTermUrl: " https://drive.google.com/file/d/termo/view ",
      }),
    ).toMatchObject({
      ra: "202600117",
      institutionalEmail: "lucas@instituicao.edu.br",
      course: "Sistemas de Informação",
      className: "SI-2024-N",
      name: "Lucas Andrade Souza",
      personalEmail: "lucas@example.com",
      address: "Rua das Acácias",
      city: "São Paulo",
      volunteerTermUrl: "https://drive.google.com/file/d/termo/view",
    });
  });

  it("treats an optional text of only spaces as not informed", () => {
    expect(parse({ address: "   ", city: "  ", volunteerTermUrl: " " })).toMatchObject({
      address: undefined,
      city: undefined,
      volunteerTermUrl: undefined,
    });
  });

  it("reports every empty required field at once, each with its own single message", () => {
    expect(messagesFor(EMPTY_VALUES)).toEqual({
      ra: ["invite.validation.raRequired"],
      institutionalEmail: ["invite.validation.institutionalEmailRequired"],
      course: ["invite.validation.courseRequired"],
      semester: ["invite.validation.semesterRequired"],
      className: ["invite.validation.classNameRequired"],
      name: ["invite.validation.nameRequired"],
      birthDate: ["invite.validation.birthDateRequired"],
      cpf: ["invite.validation.cpfRequired"],
      phone: ["invite.validation.phoneRequired"],
      personalEmail: ["invite.validation.personalEmailRequired"],
      password: ["invite.validation.passwordMin"],
    });
  });

  it.each([
    ["ra", "invite.validation.raRequired"],
    ["institutionalEmail", "invite.validation.institutionalEmailRequired"],
    ["course", "invite.validation.courseRequired"],
    ["semester", "invite.validation.semesterRequired"],
    ["className", "invite.validation.classNameRequired"],
    ["name", "invite.validation.nameRequired"],
    ["cpf", "invite.validation.cpfRequired"],
    ["phone", "invite.validation.phoneRequired"],
    ["personalEmail", "invite.validation.personalEmailRequired"],
  ] as const)("treats %s of only spaces as empty", (field, message) => {
    expect(invalid({ [field]: "   " })).toEqual({ [field]: [message] });
  });

  it("requires the birth date", () => {
    expect(invalid({ birthDate: "" })).toEqual({
      birthDate: ["invite.validation.birthDateRequired"],
    });
  });
});

describe("acceptInviteFormSchema size limits", () => {
  it("takes the limits from the generated contract", () => {
    expect(REGISTRATION_LIMITS).toEqual({
      nameMax: 200,
      raMax: 20,
      institutionalEmailMax: 200,
      courseMax: 100,
      semesterMin: 1,
      semesterMax: 20,
      classNameMax: 50,
      volunteerTermUrlMax: 500,
      personalEmailMax: 200,
      addressMax: 200,
      cityMax: 100,
    });
  });

  it.each([
    ["name", REGISTRATION_LIMITS.nameMax, "invite.validation.nameMax"],
    ["ra", REGISTRATION_LIMITS.raMax, "invite.validation.raMax"],
    ["course", REGISTRATION_LIMITS.courseMax, "invite.validation.courseMax"],
    ["className", REGISTRATION_LIMITS.classNameMax, "invite.validation.classNameMax"],
    ["address", REGISTRATION_LIMITS.addressMax, "invite.validation.addressMax"],
    ["city", REGISTRATION_LIMITS.cityMax, "invite.validation.cityMax"],
  ] as const)(
    "rejects %s above %i characters and accepts exactly the limit",
    (field, max, message) => {
      expect(invalid({ [field]: "a".repeat(max + 1) })).toEqual({ [field]: [message] });
      expect(invalid({ [field]: "a".repeat(max) })).toEqual({});
    },
  );

  it.each([
    ["institutionalEmail", REGISTRATION_LIMITS.institutionalEmailMax],
    ["personalEmail", REGISTRATION_LIMITS.personalEmailMax],
  ] as const)("rejects an %s above %i characters", (field, max) => {
    const domain = "@x.com.br";
    const atLimit = `${"a".repeat(max - domain.length)}${domain}`;

    expect(atLimit).toHaveLength(max);
    expect(invalid({ [field]: atLimit })).toEqual({});
    expect(Object.keys(invalid({ [field]: `a${atLimit}` }))).toEqual([field]);
  });

  it("rejects a volunteer term link above the limit", () => {
    const prefix = "https://drive.google.com/";
    const atLimit = `${prefix}${"a".repeat(REGISTRATION_LIMITS.volunteerTermUrlMax - prefix.length)}`;

    expect(invalid({ volunteerTermUrl: `${atLimit}a` })).toEqual({
      volunteerTermUrl: ["invite.validation.volunteerTermUrlMax"],
    });
    expect(invalid({ volunteerTermUrl: atLimit })).toEqual({});
  });
});

describe("acceptInviteFormSchema e-mails", () => {
  it.each([
    ["institutionalEmail", "invite.validation.institutionalEmailInvalid"],
    ["personalEmail", "invite.validation.personalEmailInvalid"],
  ] as const)("rejects an %s that is not an e-mail", (field, message) => {
    for (const email of [
      "sem-arroba",
      "lucas@",
      "@instituicao.edu.br",
      "lucas@instituicao",
      "a b@c.com",
    ]) {
      expect(invalid({ [field]: email })).toEqual({ [field]: [message] });
    }
  });

  it("does not mix up the two e-mails", () => {
    expect(invalid({ institutionalEmail: "nope", personalEmail: "nope" })).toEqual({
      institutionalEmail: ["invite.validation.institutionalEmailInvalid"],
      personalEmail: ["invite.validation.personalEmailInvalid"],
    });
  });
});

describe("acceptInviteFormSchema semester", () => {
  it.each([
    ["1", 1],
    ["7", 7],
    ["20", 20],
    [" 12 ", 12],
    ["007", 7],
  ])("sends the text %j as the integer %i", (text, expected) => {
    expect(parse({ semester: text }).semester).toBe(expected);
  });

  it.each(["0", "21", "100", "-1", "1.5", "1,5", "3º", "abc", "3x", "٣"])(
    "rejects the text %j with the single range message",
    (text) => {
      expect(invalid({ semester: text })).toEqual({
        semester: ["invite.validation.semesterInvalid"],
      });
    },
  );
});

describe("acceptInviteFormSchema birth date", () => {
  it("accepts today and the lower bound of the API", () => {
    expect(invalid({ birthDate: todayInSaoPaulo() })).toEqual({});
    expect(invalid({ birthDate: "1900-01-01" })).toEqual({});
  });

  it.each(["1899-12-31", "0958-04-12", "2999-01-01", "2023-02-31", "22/07/1999", "1999-7-22"])(
    "rejects %j",
    (birthDate) => {
      expect(invalid({ birthDate })).toEqual({
        birthDate: ["invite.validation.birthDateInvalid"],
      });
    },
  );
});

describe("acceptInviteFormSchema CPF", () => {
  it.each(["529.982.247-25", "52998224725", "111.444.777-35", " 123.456.789-09 "])(
    "accepts %j and sends only its digits",
    (cpf) => {
      expect(parse({ cpf }).cpf).toBe(cpf.replace(/\D/g, ""));
    },
  );

  it("rejects 10 digits", () => {
    expect(invalid({ cpf: "529.982.247-2" })).toEqual({
      cpf: ["invite.validation.cpfInvalid"],
    });
  });

  it.each(["529.982.247-26", "111.111.111-11", "000.000.000-00", "529.982.247-255", "5299822472a"])(
    "rejects the CPF %j",
    (cpf) => {
      expect(invalid({ cpf })).toEqual({ cpf: ["invite.validation.cpfInvalid"] });
    },
  );
});

describe("acceptInviteFormSchema phone", () => {
  it.each([
    ["(11) 98123-4567", "11981234567"],
    ["(11) 2345-6789", "1123456789"],
    ["11981234567", "11981234567"],
    ["1123456789", "1123456789"],
  ])("accepts %j and sends the digits %s", (phone, digits) => {
    expect(parse({ phone }).phone).toBe(digits);
  });

  it.each(["(11) 9812-345", "119812345", "(11) 98123-45678", "119812345678", "(11) abcde-fghi"])(
    "rejects %j, which has fewer than 10 or more than 11 digits",
    (phone) => {
      expect(invalid({ phone })).toEqual({ phone: ["invite.validation.phoneInvalid"] });
    },
  );
});

describe("acceptInviteFormSchema optional fields", () => {
  it.each([
    "https://drive.google.com/file/d/termo/view",
    "https://drive.google.com/drive/folders/abc?usp=sharing",
  ])("accepts the https link %s", (volunteerTermUrl) => {
    expect(parse({ volunteerTermUrl }).volunteerTermUrl).toBe(volunteerTermUrl);
  });

  it.each([
    "http://drive.google.com/file/d/termo/view",
    "drive.google.com/file/d/termo/view",
    "ftp://drive.google.com/termo",
    "https://localhost",
    "https://drive google.com/termo",
    "não é um link",
  ])("rejects the link %j: only https is accepted", (volunteerTermUrl) => {
    expect(invalid({ volunteerTermUrl })).toEqual({
      volunteerTermUrl: ["invite.validation.volunteerTermUrlInvalid"],
    });
  });

  it("accepts every federative unit and an empty one", () => {
    expect(parse({ state: "" }).state).toBeUndefined();
    for (const state of ["AC", "SP", "TO", "DF"] as const) {
      expect(parse({ state }).state).toBe(state);
    }
  });

  it.each(["sp", "XX", "São Paulo", "S"])("rejects the state %j", (state) => {
    expect(invalid({ state: state as BrazilianState })).toEqual({
      state: ["invite.validation.stateInvalid"],
    });
  });

  it("passes the chosen department through and turns the empty choice into undefined", () => {
    expect(parse({ departmentId: DEPARTMENT_ID }).departmentId).toBe(DEPARTMENT_ID);
    expect(parse({ departmentId: "" }).departmentId).toBeUndefined();
  });
});

describe("acceptInviteFormSchema password", () => {
  it("rejects a password shorter than 8 characters", () => {
    expect(invalid({ password: "1234567", passwordConfirmation: "1234567" })).toEqual({
      password: ["invite.validation.passwordMin"],
    });
  });

  it("takes the password minimum from the generated contract", () => {
    expect(acceptInviteBodyPasswordMin).toBe(8);

    const withPassword = (password: string) => ({ password, passwordConfirmation: password });
    expect(invalid(withPassword("1".repeat(acceptInviteBodyPasswordMin)))).toEqual({});
    expect(invalid(withPassword("1".repeat(acceptInviteBodyPasswordMin - 1)))).not.toEqual({});
  });

  it("rejects a confirmation different from the password, on the confirmation field", () => {
    expect(invalid({ passwordConfirmation: "outra-senha-1" })).toEqual({
      passwordConfirmation: ["invite.validation.passwordMismatch"],
    });
  });

  it("reports a short password and a different confirmation at the same time", () => {
    expect(invalid({ password: "1234567", passwordConfirmation: "12345678" })).toEqual({
      password: ["invite.validation.passwordMin"],
      passwordConfirmation: ["invite.validation.passwordMismatch"],
    });
  });
});

describe("the types of the registration form", () => {
  it("has only text on the input and the types of the contract on the output", () => {
    expectTypeOf<AcceptInviteFormInput>().toEqualTypeOf<{
      ra: string;
      institutionalEmail: string;
      course: string;
      semester: string;
      className: string;
      departmentId: string;
      volunteerTermUrl: string;
      name: string;
      birthDate: string;
      cpf: string;
      phone: string;
      personalEmail: string;
      address: string;
      city: string;
      state: "" | BrazilianState;
      password: string;
      passwordConfirmation: string;
    }>();
    expectTypeOf<AcceptInviteFormOutput["semester"]>().toEqualTypeOf<number>();
    expectTypeOf<AcceptInviteFormOutput["departmentId"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<AcceptInviteFormOutput["state"]>().toEqualTypeOf<BrazilianState | undefined>();
  });

  it("covers every field of the registration of the contract", () => {
    expectTypeOf<keyof MemberRegistrationFormDto>().toExtend<keyof AcceptInviteFormOutput>();
    expectTypeOf<
      Pick<AcceptInviteFormOutput, keyof MemberRegistrationFormDto>
    >().toExtend<MemberRegistrationFormDto>();
    expect(Object.keys(acceptInviteFormSchema.shape)).toHaveLength(
      Object.keys(VALID_VALUES).length,
    );
  });
});

describe("the steps of the registration form", () => {
  it("lists the fields of step 1 as the keys of the academic step schema", () => {
    expect([...STEP_ONE_FIELDS].sort()).toEqual(Object.keys(academicStepSchema.shape).sort());
  });

  it("lists the fields of step 2 as the keys of the personal step schema", () => {
    expect([...STEP_TWO_FIELDS].sort()).toEqual(Object.keys(personalStepSchema.shape).sort());
  });

  it("splits every form field into exactly one step", () => {
    const stepFields = [...STEP_ONE_FIELDS, ...STEP_TWO_FIELDS, ...STEP_THREE_FIELDS];

    expect(stepFields.sort()).toEqual(Object.keys(acceptInviteFormSchema.shape).sort());
    expect(new Set(stepFields).size).toBe(stepFields.length);
  });

  it("maps every field to the step that lists it", () => {
    for (const field of STEP_ONE_FIELDS) expect(STEP_OF_FIELD[field]).toBe(1);
    for (const field of STEP_TWO_FIELDS) expect(STEP_OF_FIELD[field]).toBe(2);
    for (const field of STEP_THREE_FIELDS) expect(STEP_OF_FIELD[field]).toBe(3);
  });

  it("orders the fields as the screen shows them, step by step", () => {
    expect(FORM_FIELD_ORDER).toEqual([
      "ra",
      "institutionalEmail",
      "course",
      "semester",
      "className",
      "departmentId",
      "volunteerTermUrl",
      "name",
      "birthDate",
      "cpf",
      "phone",
      "personalEmail",
      "address",
      "city",
      "state",
      "password",
      "passwordConfirmation",
    ]);
  });
});
