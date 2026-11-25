import { describe, expect, it } from "vitest";

import enUS from "../locales/en-US.json";
import ptBR from "../locales/pt-BR.json";

function flattenKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null
      ? flattenKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("classes locales", () => {
  it("pt-BR and en-US have the same keys", () => {
    expect(flattenKeys(enUS).sort()).toEqual(flattenKeys(ptBR).sort());
  });

  it("has no text left empty", () => {
    for (const locale of [ptBR, enUS]) {
      const empty = flattenKeys(locale).filter((key) => {
        const value = key
          .split(".")
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], locale);
        return typeof value !== "string" || value.trim() === "";
      });

      expect(empty).toEqual([]);
    }
  });
});
