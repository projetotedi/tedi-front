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

describe("auth locales", () => {
  it("pt-BR and en-US have the same keys", () => {
    expect(flattenKeys(enUS).sort()).toEqual(flattenKeys(ptBR).sort());
  });
});
