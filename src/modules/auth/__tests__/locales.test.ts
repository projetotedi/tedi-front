import { describe, expect, it } from "vitest";

import { toRegistrationFieldErrors } from "../lib/invite-error";
import enUS from "../locales/en-US.json";
import ptBR from "../locales/pt-BR.json";
import schemaSource from "../schemas/accept-invite-form.schema.ts?raw";
import passwordSchemaSource from "../schemas/password.schema.ts?raw";
import { FORM_FIELD_ORDER, REGISTRATION_LIMITS } from "../schemas/accept-invite-form.schema";
import { validationFailed } from "./handlers";

function flattenKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null
      ? flattenKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function textOf(locale: object, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null ? Reflect.get(node, part) : undefined,
      locale,
    );
}

/** Toda chave `invite.…` escrita como texto nos schemas: o `message` das regras do zod. */
function messageKeysIn(source: string): string[] {
  return [...source.matchAll(/"(invite\.[A-Za-z]+\.[A-Za-z]+)"/g)].map((match) => match[1]);
}

describe("auth locales", () => {
  it("pt-BR and en-US have the same keys", () => {
    expect(flattenKeys(enUS).sort()).toEqual(flattenKeys(ptBR).sort());
  });
});

describe("the texts of the registration form", () => {
  const schemaKeys = [
    ...new Set([...messageKeysIn(schemaSource), ...messageKeysIn(passwordSchemaSource)]),
  ];

  it("finds the messages of the schemas in the source", () => {
    expect(schemaKeys).toEqual(
      expect.arrayContaining([
        "invite.validation.raRequired",
        "invite.validation.cpfInvalid",
        "invite.validation.passwordMin",
        "invite.validation.passwordMismatch",
      ]),
    );
    expect(schemaKeys.length).toBeGreaterThan(20);
  });

  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("has in %s every message the schemas can produce", (_name, locale) => {
    const missing = schemaKeys.filter((key) => typeof textOf(locale, key) !== "string");

    expect(missing).toEqual([]);
  });

  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("has in %s a text for every error the API can attach to a field", (_name, locale) => {
    const fromValidation = FORM_FIELD_ORDER.flatMap((field) =>
      toRegistrationFieldErrors(
        validationFailed(field === "password" ? "password" : `registration.${field}`),
      ),
    );
    const fromConflicts = [
      { statusCode: 409, error: "RA_ALREADY_IN_USE" },
      { statusCode: 409, error: "EMAIL_ALREADY_IN_USE" },
      { statusCode: 400, error: "DEPARTMENT_NOT_FOUND" },
    ].flatMap((error) => toRegistrationFieldErrors(error));

    const messages = [...fromValidation, ...fromConflicts].map(({ message }) => message);
    const missing = messages.filter((key) => typeof textOf(locale, key) !== "string");

    expect(messages.length).toBeGreaterThanOrEqual(FORM_FIELD_ORDER.length);
    expect(missing).toEqual([]);
  });

  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("has in %s the general errors, the sent screen and every field label", (_name, locale) => {
    const keys = [
      "invite.errors.invalidData",
      "invite.errors.network",
      "invite.errors.unknown",
      "invite.submitted.title",
      "invite.submitted.description",
      "invite.fields.noneOption",
      ...FORM_FIELD_ORDER.filter(
        (field) => field !== "password" && field !== "passwordConfirmation",
      ).map((field) => `invite.fields.${field}.label`),
    ];

    expect(keys.filter((key) => typeof textOf(locale, key) !== "string")).toEqual([]);
  });

  it("interpolates only limits that the schema exposes", () => {
    const limitNames = new Set(Object.keys(REGISTRATION_LIMITS));
    const used = flattenKeys(ptBR)
      .map((key) => textOf(ptBR, key))
      .filter((text): text is string => typeof text === "string")
      .flatMap((text) => [...text.matchAll(/\{\{(\w+Max|\w+Min)\}\}/g)].map((match) => match[1]));

    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((name) => !limitNames.has(name))).toEqual([]);
  });

  it("writes the same placeholders in both languages", () => {
    const placeholders = (locale: object) =>
      Object.fromEntries(
        flattenKeys(locale).map((key) => [
          key,
          [...String(textOf(locale, key)).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort(),
        ]),
      );

    expect(placeholders(enUS)).toEqual(placeholders(ptBR));
  });
});
