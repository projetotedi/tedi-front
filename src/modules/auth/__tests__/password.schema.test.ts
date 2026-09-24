import { describe, expect, expectTypeOf, it } from "vitest";

import type { AcceptInviteDto } from "@api/generated/model";
import { acceptInviteBodyPasswordMin } from "@api/generated/zod/auth/auth";

import {
  acceptInviteFormSchema,
  newPasswordFormSchema,
  type AcceptInviteFormValues,
  type NewPasswordFormValues,
} from "../schemas/password.schema";

const VALID_ACCESS_VALUES = {
  name: "Lucas Andrade Souza",
  ra: "202600117",
  email: "lucas@instituicao.edu.br",
  password: "senha-segura-1",
  passwordConfirmation: "senha-segura-1",
  privacyConsent: true,
};

type Schema = typeof acceptInviteFormSchema | typeof newPasswordFormSchema;

function messagesFor(schema: Schema, values: unknown): Record<string, string[]> {
  const result = schema.safeParse(values);
  if (result.success) return {};

  const messages: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    (messages[field] ??= []).push(issue.message);
  }
  return messages;
}

describe("acceptInviteFormSchema", () => {
  it("accepts a complete payload", () => {
    expect(acceptInviteFormSchema.safeParse(VALID_ACCESS_VALUES).success).toBe(true);
  });

  it("requires the name", () => {
    expect(messagesFor(acceptInviteFormSchema, { ...VALID_ACCESS_VALUES, name: "" })).toEqual({
      name: ["invite.validation.nameRequired"],
    });
  });

  it("treats a name of only spaces as empty", () => {
    expect(messagesFor(acceptInviteFormSchema, { ...VALID_ACCESS_VALUES, name: "   " })).toEqual({
      name: ["invite.validation.nameRequired"],
    });
  });

  it("rejects a name longer than the contract allows", () => {
    expect(
      messagesFor(acceptInviteFormSchema, { ...VALID_ACCESS_VALUES, name: "a".repeat(201) }),
    ).toEqual({ name: ["invite.validation.nameMax"] });
    expect(
      acceptInviteFormSchema.safeParse({ ...VALID_ACCESS_VALUES, name: "a".repeat(200) }).success,
    ).toBe(true);
  });

  it("requires the RA", () => {
    expect(messagesFor(acceptInviteFormSchema, { ...VALID_ACCESS_VALUES, ra: "" })).toEqual({
      ra: ["invite.validation.raRequired"],
    });
    expect(messagesFor(acceptInviteFormSchema, { ...VALID_ACCESS_VALUES, ra: "  " })).toEqual({
      ra: ["invite.validation.raRequired"],
    });
  });

  it.each(["", "   ", "sem-arroba", "lucas@", "lucas@instituicao"])(
    "rejects the email %j with the single email message",
    (email) => {
      expect(messagesFor(acceptInviteFormSchema, { ...VALID_ACCESS_VALUES, email })).toEqual({
        email: ["invite.validation.emailInvalid"],
      });
    },
  );

  it("trims the name, the RA and the email in the validated output", () => {
    const result = acceptInviteFormSchema.safeParse({
      ...VALID_ACCESS_VALUES,
      name: "  Lucas Andrade Souza ",
      ra: " 202600117 ",
      email: " lucas@instituicao.edu.br ",
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      name: "Lucas Andrade Souza",
      ra: "202600117",
      email: "lucas@instituicao.edu.br",
    });
  });

  it("rejects a password shorter than 8 characters", () => {
    const shortPassword = "1234567";

    expect(
      messagesFor(acceptInviteFormSchema, {
        ...VALID_ACCESS_VALUES,
        password: shortPassword,
        passwordConfirmation: shortPassword,
      }),
    ).toEqual({ password: ["invite.validation.passwordMin"] });
  });

  it("takes the password minimum from the generated contract", () => {
    expect(acceptInviteBodyPasswordMin).toBe(8);

    const atLimit = "1".repeat(acceptInviteBodyPasswordMin);
    const belowLimit = "1".repeat(acceptInviteBodyPasswordMin - 1);
    const withPassword = (password: string) => ({
      ...VALID_ACCESS_VALUES,
      password,
      passwordConfirmation: password,
    });

    expect(acceptInviteFormSchema.safeParse(withPassword(atLimit)).success).toBe(true);
    expect(acceptInviteFormSchema.safeParse(withPassword(belowLimit)).success).toBe(false);
  });

  it("rejects a confirmation different from the password, on the confirmation field", () => {
    expect(
      messagesFor(acceptInviteFormSchema, {
        ...VALID_ACCESS_VALUES,
        passwordConfirmation: "outra-senha-1",
      }),
    ).toEqual({ passwordConfirmation: ["invite.validation.passwordMismatch"] });
  });

  it("reports a short password and a different confirmation at the same time", () => {
    expect(
      messagesFor(acceptInviteFormSchema, {
        ...VALID_ACCESS_VALUES,
        password: "1234567",
        passwordConfirmation: "12345678",
      }),
    ).toEqual({
      password: ["invite.validation.passwordMin"],
      passwordConfirmation: ["invite.validation.passwordMismatch"],
    });
  });

  it("reports every empty field at once", () => {
    expect(
      messagesFor(acceptInviteFormSchema, {
        name: "",
        ra: "",
        email: "",
        password: "",
        passwordConfirmation: "",
        privacyConsent: false,
      }),
    ).toEqual({
      name: ["invite.validation.nameRequired"],
      ra: ["invite.validation.raRequired"],
      email: ["invite.validation.emailInvalid"],
      password: ["invite.validation.passwordMin"],
      privacyConsent: ["invite.validation.privacyConsentRequired"],
    });
  });

  it("requires the privacy consent to be checked", () => {
    expect(
      messagesFor(acceptInviteFormSchema, { ...VALID_ACCESS_VALUES, privacyConsent: false }),
    ).toEqual({ privacyConsent: ["invite.validation.privacyConsentRequired"] });
  });

  it("has the fields of the AcceptInviteDto plus the confirmation and the privacy consent, and no token", () => {
    expectTypeOf<AcceptInviteFormValues>().toEqualTypeOf<{
      name: string;
      ra: string;
      email: string;
      password: string;
      passwordConfirmation: string;
      privacyConsent: boolean;
    }>();
    expectTypeOf<
      Omit<AcceptInviteFormValues, "passwordConfirmation" | "privacyConsent">
    >().toExtend<Omit<AcceptInviteDto, "token">>();
    expect(Object.keys(acceptInviteFormSchema.shape).sort()).toEqual([
      "email",
      "name",
      "password",
      "passwordConfirmation",
      "privacyConsent",
      "ra",
    ]);
  });
});

describe("newPasswordFormSchema", () => {
  it("accepts a password and the same confirmation", () => {
    expect(
      newPasswordFormSchema.safeParse({
        password: "nova-senha-1",
        passwordConfirmation: "nova-senha-1",
      }).success,
    ).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      messagesFor(newPasswordFormSchema, { password: "1234567", passwordConfirmation: "1234567" }),
    ).toEqual({ password: ["invite.validation.passwordMin"] });
  });

  it("rejects a confirmation different from the password, on the confirmation field", () => {
    expect(
      messagesFor(newPasswordFormSchema, {
        password: "nova-senha-1",
        passwordConfirmation: "nova-senha-2",
      }),
    ).toEqual({ passwordConfirmation: ["invite.validation.passwordMismatch"] });
  });

  it("does not ask for name, RA or email", () => {
    expectTypeOf<NewPasswordFormValues>().toEqualTypeOf<{
      password: string;
      passwordConfirmation: string;
    }>();
    expect(Object.keys(newPasswordFormSchema.shape).sort()).toEqual([
      "password",
      "passwordConfirmation",
    ]);
  });
});
