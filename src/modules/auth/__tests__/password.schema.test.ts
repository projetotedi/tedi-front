import { describe, expect, expectTypeOf, it } from "vitest";

import { acceptInviteBodyPasswordMin } from "@api/generated/zod/auth/auth";

import { acceptInviteFormSchema } from "../schemas/accept-invite-form.schema";
import { newPasswordFormSchema, type NewPasswordFormValues } from "../schemas/password.schema";

function messagesFor(values: unknown): Record<string, string[]> {
  const result = newPasswordFormSchema.safeParse(values);
  if (result.success) return {};

  const messages: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    (messages[field] ??= []).push(issue.message);
  }
  return messages;
}

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
    expect(messagesFor({ password: "1234567", passwordConfirmation: "1234567" })).toEqual({
      password: ["invite.validation.passwordMin"],
    });
  });

  it("takes the password minimum from the generated contract", () => {
    expect(acceptInviteBodyPasswordMin).toBe(8);

    const withPassword = (password: string) => ({ password, passwordConfirmation: password });
    expect(
      newPasswordFormSchema.safeParse(withPassword("1".repeat(acceptInviteBodyPasswordMin)))
        .success,
    ).toBe(true);
    expect(
      newPasswordFormSchema.safeParse(withPassword("1".repeat(acceptInviteBodyPasswordMin - 1)))
        .success,
    ).toBe(false);
  });

  it("rejects a confirmation different from the password, on the confirmation field", () => {
    expect(
      messagesFor({
        password: "nova-senha-1",
        passwordConfirmation: "nova-senha-2",
      }),
    ).toEqual({ passwordConfirmation: ["invite.validation.passwordMismatch"] });
  });

  it("reports a short password and a different confirmation at the same time", () => {
    expect(messagesFor({ password: "1234567", passwordConfirmation: "12345678" })).toEqual({
      password: ["invite.validation.passwordMin"],
      passwordConfirmation: ["invite.validation.passwordMismatch"],
    });
  });

  it("does not ask for name, RA or e-mail", () => {
    expectTypeOf<NewPasswordFormValues>().toEqualTypeOf<{
      password: string;
      passwordConfirmation: string;
    }>();
    expect(Object.keys(newPasswordFormSchema.shape).sort()).toEqual([
      "password",
      "passwordConfirmation",
    ]);
  });

  it("shares the password rules with the last step of the registration form", () => {
    for (const shape of [newPasswordFormSchema.shape, acceptInviteFormSchema.shape]) {
      expect(shape.password).toBe(newPasswordFormSchema.shape.password);
      expect(shape.passwordConfirmation).toBe(newPasswordFormSchema.shape.passwordConfirmation);
    }
  });
});
