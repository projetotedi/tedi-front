import { describe, expect, it } from "vitest";

import { HourEntryCategory, HourEntryEventType, HourEntryStatus } from "@api/generated/model";

import enUS from "../locales/en-US.json";
import ptBR from "../locales/pt-BR.json";

function flattenKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null
      ? flattenKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function valueAt(locale: object, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (typeof node !== "object" || node === null) return undefined;
    return Object.prototype.hasOwnProperty.call(node, part)
      ? (node as Record<string, unknown>)[part]
      : undefined;
  }, locale);
}

describe("hours locales", () => {
  it("pt-BR and en-US have the same keys", () => {
    expect(flattenKeys(enUS).sort()).toEqual(flattenKeys(ptBR).sort());
  });

  it("has no empty text", () => {
    for (const locale of [ptBR, enUS]) {
      const empty = flattenKeys(locale).filter((key) => {
        const value = valueAt(locale, key);
        return typeof value !== "string" || value.trim() === "";
      });

      expect(empty).toEqual([]);
    }
  });

  it("uses the same interpolation variables in both languages", () => {
    const variables = (locale: object, key: string): string[] =>
      [...String(valueAt(locale, key)).matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort();

    for (const key of flattenKeys(ptBR)) {
      expect(variables(enUS, key), key).toEqual(variables(ptBR, key));
    }
  });

  it("has a label for every category, status and event type of the contract", () => {
    for (const locale of [ptBR, enUS]) {
      for (const category of Object.values(HourEntryCategory)) {
        expect(valueAt(locale, `bank.categories.labels.${category}`), category).toEqual(
          expect.any(String),
        );
      }
      for (const status of Object.values(HourEntryStatus)) {
        expect(valueAt(locale, `bank.status.${status}`), status).toEqual(expect.any(String));
        expect(valueAt(locale, `history.current.${status}`), status).toEqual(expect.any(String));
        expect(valueAt(locale, `history.statusDetail.${status}`), status).toEqual(
          expect.any(String),
        );
      }
      for (const type of Object.values(HourEntryEventType)) {
        expect(valueAt(locale, `history.events.${type}`), type).toEqual(expect.any(String));
      }
    }
  });
});
