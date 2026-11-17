import { describe, expect, it } from "vitest";

import { AccessibilityNeed, MemberStatus } from "@api/generated/model";

import enUS from "../locales/en-US.json";
import ptBR from "../locales/pt-BR.json";

function flattenKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null
      ? flattenKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function flattenValues(value: object): string[] {
  return Object.values(value).flatMap((child) =>
    typeof child === "object" && child !== null ? flattenValues(child) : [String(child)],
  );
}

// Only the `student` subtree: the `profile` one has plural forms that pt-BR needs and en-US does
// not (`_many`), so comparing the whole files would fail for a reason that is not a missing text.
describe("people locales (student)", () => {
  it("pt-BR and en-US have the same keys", () => {
    expect(flattenKeys(enUS.student).sort()).toEqual(flattenKeys(ptBR.student).sort());
  });

  it("has no empty text", () => {
    for (const text of [...flattenValues(ptBR.student), ...flattenValues(enUS.student)]) {
      expect(text.trim()).not.toBe("");
    }
  });

  it.each([
    ["pt-BR", ptBR.student],
    ["en-US", enUS.student],
  ])("%s has a label for every category of accessibility the API knows", (_locale, student) => {
    expect(Object.keys(student.accessibilityNeed).sort()).toEqual(
      Object.values(AccessibilityNeed).sort(),
    );
  });
});

// The `member` subtree has no plural forms, so it can be compared key by key.
describe("people locales (member)", () => {
  it("pt-BR and en-US have the same keys", () => {
    expect(flattenKeys(enUS.member).sort()).toEqual(flattenKeys(ptBR.member).sort());
  });

  it("has no empty text", () => {
    for (const text of [...flattenValues(ptBR.member), ...flattenValues(enUS.member)]) {
      expect(text.trim()).not.toBe("");
    }
  });

  it.each([
    ["pt-BR", ptBR.member],
    ["en-US", enUS.member],
  ])("%s has a label for every status of a member the API knows", (_locale, member) => {
    expect(Object.keys(member.status).sort()).toEqual(Object.values(MemberStatus).sort());
  });
});
