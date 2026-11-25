import { beforeAll, describe, expect, it } from "vitest";

import i18n from "@shared/i18n";

import { coverageParts, formatCoverage } from "../lib/coverage";
import "../index";
import { buildCoverage } from "./application-handlers";

describe("coverageParts", () => {
  it("has the teacher while the lesson has none, then the monitors", () => {
    expect(coverageParts(buildCoverage())).toEqual([
      { key: "teacher", confirmed: 0, expected: 1 },
      { key: "monitors", confirmed: 2, expected: 3 },
    ]);
  });

  it("leaves the teacher out when the lesson has one", () => {
    expect(
      coverageParts(
        buildCoverage({ teacher: { confirmed: 1 }, monitors: { confirmed: 0, expected: 2 } }),
      ),
    ).toEqual([{ key: "monitors", confirmed: 0, expected: 2 }]);
  });

  it("leaves the monitors out when none is expected (null: not informed)", () => {
    expect(
      coverageParts(buildCoverage({ teacher: { confirmed: 0 }, monitors: { expected: null } })),
    ).toEqual([{ key: "teacher", confirmed: 0, expected: 1 }]);
  });

  it("leaves the monitors out when the expected number is 0", () => {
    expect(
      coverageParts(
        buildCoverage({ teacher: { confirmed: 1 }, monitors: { confirmed: 0, expected: 0 } }),
      ),
    ).toEqual([]);
  });

  it("keeps the monitors when they are all there: an expected count is always shown", () => {
    expect(
      coverageParts(
        buildCoverage({ teacher: { confirmed: 1 }, monitors: { confirmed: 3, expected: 3 } }),
      ),
    ).toEqual([{ key: "monitors", confirmed: 3, expected: 3 }]);
  });
});

describe("formatCoverage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  const t = () => i18n.getFixedT("pt-BR", "assignments");

  it("writes both parts joined by a dot: Professor(a) 0 de 1 · Monitores 2 de 3", () => {
    expect(formatCoverage(buildCoverage(), t())).toBe("Professor(a) 0 de 1 · Monitores 2 de 3");
  });

  it("writes only Monitores 0 de 2 when the teacher is already there", () => {
    expect(
      formatCoverage(
        buildCoverage({ teacher: { confirmed: 1 }, monitors: { confirmed: 0, expected: 2 } }),
        t(),
      ),
    ).toBe("Monitores 0 de 2");
  });

  it("writes only the teacher when no monitor is expected", () => {
    expect(
      formatCoverage(
        buildCoverage({ teacher: { confirmed: 0 }, monitors: { expected: null } }),
        t(),
      ),
    ).toBe("Professor(a) 0 de 1");
  });

  it("writes Equipe completa when there is nothing left to say: the teacher is there and no monitor is expected", () => {
    expect(
      formatCoverage(
        buildCoverage({ teacher: { confirmed: 1 }, monitors: { confirmed: 0, expected: null } }),
        t(),
      ),
    ).toBe("Equipe completa");
    expect(
      formatCoverage(
        buildCoverage({ teacher: { confirmed: 1 }, monitors: { confirmed: 0, expected: 0 } }),
        t(),
      ),
    ).toBe("Equipe completa");
  });

  it("keeps Monitores 3 de 3 once the monitors are full", () => {
    expect(
      formatCoverage(
        buildCoverage({ teacher: { confirmed: 1 }, monitors: { confirmed: 3, expected: 3 } }),
        t(),
      ),
    ).toBe("Monitores 3 de 3");
  });

  it("speaks the language it is given", () => {
    expect(formatCoverage(buildCoverage(), i18n.getFixedT("en-US", "assignments"))).toBe(
      "Teacher 0 of 1 · Monitors 2 of 3",
    );
  });
});
