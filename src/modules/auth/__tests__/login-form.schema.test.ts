import { describe, expect, expectTypeOf, it } from "vitest";

import type { LoginDto } from "@api/generated/model";

import { loginFormSchema, type LoginFormValues } from "../schemas/login-form.schema";

function messagesFor(values: unknown): Record<string, string[]> {
  const result = loginFormSchema.safeParse(values);
  if (result.success) return {};

  const messages: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    (messages[field] ??= []).push(issue.message);
  }
  return messages;
}

describe("loginFormSchema", () => {
  it("accepts an RA and a password with at least 8 characters", () => {
    expect(loginFormSchema.safeParse({ ra: "202400001", password: "12345678" }).success).toBe(true);
  });

  it("requires the RA", () => {
    expect(messagesFor({ ra: "", password: "12345678" })).toEqual({
      ra: ["login.validation.raRequired"],
    });
  });

  it("requires at least 8 characters in the password", () => {
    expect(messagesFor({ ra: "202400001", password: "1234567" })).toEqual({
      password: ["login.validation.passwordMin"],
    });
  });

  it("reports both fields at once", () => {
    expect(messagesFor({ ra: "", password: "" })).toEqual({
      ra: ["login.validation.raRequired"],
      password: ["login.validation.passwordMin"],
    });
  });

  it("produces exactly the LoginDto the API expects", () => {
    expectTypeOf<LoginFormValues>().toEqualTypeOf<LoginDto>();
  });
});
