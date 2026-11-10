import { describe, expect, expectTypeOf, it } from "vitest";

import type { AcceptInviteDto } from "@api/generated/model";
import { AcceptInviteBody } from "@api/generated/zod/auth/auth";

import { toAcceptInviteDto } from "../lib/registration-payload";
import {
  acceptInviteFormSchema,
  type AcceptInviteFormInput,
  type AcceptInviteFormOutput,
} from "../schemas/accept-invite-form.schema";

const TOKEN = "tok-abc";
const DEPARTMENT_ID = "01999a3e-1111-7000-8000-000000000001";

const REQUIRED_OUTPUT: AcceptInviteFormOutput = {
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
};

const FULL_OUTPUT: AcceptInviteFormOutput = {
  ...REQUIRED_OUTPUT,
  departmentId: DEPARTMENT_ID,
  volunteerTermUrl: "https://drive.google.com/file/d/termo/view",
  address: "Rua das Acácias, 120",
  city: "São Paulo",
  state: "SP",
};

const REQUIRED_REGISTRATION = {
  name: "Lucas Andrade Souza",
  ra: "202600117",
  personalEmail: "lucas@example.com",
  birthDate: "1999-07-22",
  cpf: "52998224725",
  phone: "11981234567",
  institutionalEmail: "lucas@instituicao.edu.br",
  course: "Sistemas de Informação",
  semester: 3,
  className: "SI-2024-N",
};

describe("toAcceptInviteDto", () => {
  it("sends the token, the password and the registration in the format of the API", () => {
    expect(toAcceptInviteDto(TOKEN, REQUIRED_OUTPUT)).toStrictEqual({
      token: TOKEN,
      password: "senha-segura-1",
      registration: REQUIRED_REGISTRATION,
    });
  });

  it("leaves out the optional fields that were not filled, instead of sending null or empty text", () => {
    const { registration } = toAcceptInviteDto(TOKEN, REQUIRED_OUTPUT);

    expect(Object.keys(registration!).sort()).toEqual(Object.keys(REQUIRED_REGISTRATION).sort());
    expect(JSON.parse(JSON.stringify(registration))).toStrictEqual(REQUIRED_REGISTRATION);
  });

  it("sends every optional field that was filled", () => {
    expect(toAcceptInviteDto(TOKEN, FULL_OUTPUT)).toStrictEqual({
      token: TOKEN,
      password: "senha-segura-1",
      registration: {
        ...REQUIRED_REGISTRATION,
        address: "Rua das Acácias, 120",
        city: "São Paulo",
        state: "SP",
        departmentId: DEPARTMENT_ID,
        volunteerTermUrl: "https://drive.google.com/file/d/termo/view",
      },
    });
  });

  it("does not send the password confirmation, nor any field of the form at the top level", () => {
    const body = toAcceptInviteDto(TOKEN, FULL_OUTPUT);

    expect(Object.keys(body).sort()).toEqual(["password", "registration", "token"]);
    expect(JSON.stringify(body)).not.toContain("passwordConfirmation");
    expect(body).not.toHaveProperty("name");
    expect(body).not.toHaveProperty("ra");
    expect(body).not.toHaveProperty("email");
  });

  it("sends each optional field on its own, leaving the others out", () => {
    const only = (overrides: Partial<AcceptInviteFormOutput>) =>
      Object.keys(toAcceptInviteDto(TOKEN, { ...REQUIRED_OUTPUT, ...overrides }).registration!)
        .filter((key) => !(key in REQUIRED_REGISTRATION))
        .sort();

    expect(only({ departmentId: DEPARTMENT_ID })).toEqual(["departmentId"]);
    expect(only({ state: "RJ" })).toEqual(["state"]);
    expect(only({ city: "Niterói" })).toEqual(["city"]);
    expect(only({ address: "Rua A" })).toEqual(["address"]);
    expect(only({ volunteerTermUrl: "https://drive.google.com/x.y" })).toEqual([
      "volunteerTermUrl",
    ]);
  });

  it("passes the generated AcceptInviteBody schema, with and without the optional fields", () => {
    for (const output of [REQUIRED_OUTPUT, FULL_OUTPUT]) {
      const result = AcceptInviteBody.safeParse(toAcceptInviteDto(TOKEN, output));

      expect(result.success).toBe(true);
    }
  });

  it("keeps every key the generated schema knows, so a field added to the contract fails here", () => {
    const registrationShape = AcceptInviteBody.shape.registration.unwrap().shape;
    const { registration } = toAcceptInviteDto(TOKEN, FULL_OUTPUT);

    expect(Object.keys(registration!).sort()).toEqual(Object.keys(registrationShape).sort());
  });

  it("turns what the person typed in the form into a body the generated schema accepts", () => {
    const typed: AcceptInviteFormInput = {
      ra: " 202600117 ",
      institutionalEmail: " lucas@instituicao.edu.br ",
      course: "Sistemas de Informação",
      semester: "3",
      className: "SI-2024-N",
      departmentId: DEPARTMENT_ID,
      volunteerTermUrl: "",
      name: "  Lucas Andrade Souza ",
      birthDate: "1999-07-22",
      cpf: "529.982.247-25",
      phone: "(11) 98123-4567",
      personalEmail: "lucas@example.com",
      address: "",
      city: "São Paulo",
      state: "SP",
      password: "senha-segura-1",
      passwordConfirmation: "senha-segura-1",
    };

    const values = acceptInviteFormSchema.parse(typed);
    const body = toAcceptInviteDto(TOKEN, values);

    expect(body).toStrictEqual({
      token: TOKEN,
      password: "senha-segura-1",
      registration: {
        ...REQUIRED_REGISTRATION,
        departmentId: DEPARTMENT_ID,
        city: "São Paulo",
        state: "SP",
      },
    });
    expect(AcceptInviteBody.safeParse(body).success).toBe(true);
  });

  it("returns the generated AcceptInviteDto", () => {
    expectTypeOf(toAcceptInviteDto).returns.toEqualTypeOf<AcceptInviteDto>();
    expectTypeOf(toAcceptInviteDto).parameters.toEqualTypeOf<[string, AcceptInviteFormOutput]>();
  });
});
