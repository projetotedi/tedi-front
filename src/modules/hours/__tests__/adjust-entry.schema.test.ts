import { describe, expect, it } from "vitest";

import {
  adjustEntryFormSchema,
  parseHoursInput,
  toAdjustBody,
  validNewMinutes,
} from "../schemas/adjust-entry.schema";

const schema = adjustEntryFormSchema(240);
const JUSTIFICATION = "Feito em dupla com o Rafael: cada um registra 2h.";

function newValueError(newValue: string): string | undefined {
  const result = schema.safeParse({ newValue, justification: JUSTIFICATION });
  return result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === "newValue")?.message;
}

function justificationError(justification: string): string | undefined {
  const result = schema.safeParse({ newValue: "2h", justification });
  return result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === "justification")?.message;
}

describe("adjust entry schema", () => {
  it.each([
    ["2h", 120],
    ["2h30", 150],
    [" 2H30 ", 150],
    ["0h45", 45],
    ["24h", 1440],
  ])("accepts %j as %i minutes", (value, minutes) => {
    expect(parseHoursInput(value)).toBe(minutes);
    const result = schema.safeParse({ newValue: value, justification: JUSTIFICATION });
    expect(result.success && result.data.newValue).toBe(minutes);
  });

  it.each(["2", "2:30", "2h60", "abc"])("asks for the format 2h or 2h30 for %j", (value) => {
    expect(parseHoursInput(value)).toBeNull();
    expect(newValueError(value)).toBe("newValueFormat");
  });

  it("asks for the new value when it is empty", () => {
    expect(newValueError("")).toBe("newValueRequired");
    expect(newValueError("   ")).toBe("newValueRequired");
  });

  it.each(["0h", "25h", "24h01"])("refuses %j as out of 0h01 to 24h", (value) => {
    expect(newValueError(value)).toBe("newValueRange");
  });

  it("refuses the declared value", () => {
    expect(newValueError("4h")).toBe("unchanged");
  });

  it("asks for the justification when it is empty or only spaces", () => {
    expect(justificationError("")).toBe("justificationRequired");
    expect(justificationError("   ")).toBe("justificationRequired");
  });

  it("refuses a justification over 500 characters", () => {
    expect(justificationError("a".repeat(501))).toBe("tooLong");
    expect(justificationError("a".repeat(500))).toBeUndefined();
  });

  it("validNewMinutes gives the minutes the form accepts, and null for what it refuses", () => {
    expect(validNewMinutes("2h30", 240)).toBe(150);
    expect(validNewMinutes(" 24H ", 240)).toBe(1440);
    for (const refused of ["", "2:30", "0h", "25h", "4h"]) {
      expect(validNewMinutes(refused, 240), refused).toBeNull();
    }
  });

  it("toAdjustBody sends the minutes and the trimmed justification", () => {
    const values = schema.parse({ newValue: "2h", justification: `  ${JUSTIFICATION}  ` });

    expect(toAdjustBody(values)).toEqual({ validatedMinutes: 120, justification: JUSTIFICATION });
  });
});
