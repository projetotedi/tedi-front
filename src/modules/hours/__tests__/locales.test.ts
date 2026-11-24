import { describe, expect, it } from "vitest";

import { HourEntryCategory, HourEntryEventType, HourEntryStatus } from "@api/generated/model";

import enUS from "../locales/en-US.json";
import ptBR from "../locales/pt-BR.json";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

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

/** The key without its plural suffix: pt-BR has the plural form `many` (from 1 million on), en-US does not. */
function baseKey(key: string): string {
  return key.replace(PLURAL_SUFFIX, "");
}

function baseKeys(locale: object): string[] {
  return [...new Set(flattenKeys(locale).map(baseKey))].sort();
}

/** The variables `{{name}}` of each key, every plural form of the key together. */
function variablesByKey(locale: object): Map<string, string> {
  const variables = new Map<string, Set<string>>();
  for (const key of flattenKeys(locale)) {
    const names = variables.get(baseKey(key)) ?? new Set<string>();
    for (const match of String(valueAt(locale, key)).matchAll(/{{(\w+)}}/g)) names.add(match[1]);
    variables.set(baseKey(key), names);
  }
  return new Map([...variables].map(([key, names]) => [key, [...names].sort().join(",")]));
}

describe("hours locales", () => {
  it("pt-BR and en-US have the same keys, apart from the plural forms of each language", () => {
    expect(baseKeys(enUS)).toEqual(baseKeys(ptBR));
  });

  it("uses only the plural forms of each language", () => {
    for (const [language, locale] of [
      ["pt-BR", ptBR],
      ["en-US", enUS],
    ] as const) {
      const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
      const foreign = flattenKeys(locale).filter((key) => {
        const category = PLURAL_SUFFIX.exec(key)?.[1];
        return category !== undefined && !categories.some((known) => known === category);
      });

      expect(foreign, language).toEqual([]);
    }
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
    expect(variablesByKey(enUS)).toEqual(variablesByKey(ptBR));
  });

  it("has a label for every category, status and event type of the contract", () => {
    for (const locale of [ptBR, enUS]) {
      for (const category of Object.values(HourEntryCategory)) {
        expect(valueAt(locale, `bank.categories.labels.${category}`), category).toEqual(
          expect.any(String),
        );
      }
      for (const status of Object.values(HourEntryStatus)) {
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
