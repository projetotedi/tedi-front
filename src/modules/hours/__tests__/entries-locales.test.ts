import { describe, expect, it } from "vitest";

import enUS from "../locales/en-US.json";
import ptBR from "../locales/pt-BR.json";

/** The roots of the keys of GUS-163: GUS-165 writes in the same namespace under its own (coordination 163 × 165). */
const ROOTS = ["entries", "logHours", "myEntries", "removeEntry"];

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every text of a locale, by its full key ("entries.status.pending"). */
function flatten(value: Record<string, unknown>, prefix = ""): Map<string, unknown> {
  const texts = new Map<string, unknown>();
  for (const [key, child] of Object.entries(value)) {
    if (isRecord(child)) {
      for (const [inner, text] of flatten(child, `${prefix}${key}.`)) texts.set(inner, text);
    } else {
      texts.set(`${prefix}${key}`, child);
    }
  }
  return texts;
}

/** The key without its plural suffix: pt-BR has the `many` form, en-US does not. */
function base(key: string): string {
  return key.replace(PLURAL_SUFFIX, "");
}

/** The variables `{{name}}` the texts of each key use, every plural form of the key together. */
function variablesByKey(texts: Map<string, unknown>): Map<string, string> {
  const variables = new Map<string, Set<string>>();
  for (const [key, text] of texts) {
    const names = variables.get(base(key)) ?? new Set<string>();
    for (const match of String(text).matchAll(/{{(\w+)}}/g)) names.add(match[1]);
    variables.set(base(key), names);
  }
  return new Map([...variables].map(([key, names]) => [key, [...names].sort().join(",")]));
}

const PT_BR = flatten(ptBR);
const EN_US = flatten(enUS);

describe("hours locales", () => {
  it("pt-BR and en-US have the same keys, apart from the plural suffixes", () => {
    const keys = (texts: Map<string, unknown>) => [...new Set([...texts.keys()].map(base))].sort();

    expect(keys(EN_US)).toEqual(keys(PT_BR));
  });

  it("has no text left empty", () => {
    for (const texts of [PT_BR, EN_US]) {
      const empty = [...texts].filter(([, text]) => typeof text !== "string" || text.trim() === "");

      expect(empty).toEqual([]);
    }
  });

  it("uses the same interpolation variables in both languages", () => {
    expect(variablesByKey(EN_US)).toEqual(variablesByKey(PT_BR));
  });

  it("keeps every key under the prefixes of GUS-163", () => {
    for (const locale of [ptBR, enUS]) {
      expect(Object.keys(locale).filter((root) => !ROOTS.includes(root))).toEqual([]);
    }
  });
});
