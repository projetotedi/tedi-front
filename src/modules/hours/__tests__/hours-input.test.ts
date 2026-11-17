import { describe, expect, it } from "vitest";

import { parseHoursInput } from "../lib/hours-input";

describe("parseHoursInput", () => {
  it.each([
    ["2h30", 150],
    ["3h", 180],
    ["0h45", 45],
    [" 2H05 ", 125],
    ["24h", 1440],
    ["02h30", 150],
    ["25h", 1500],
  ])("reads %s as %i minutes", (text, minutes) => {
    expect(parseHoursInput(text)).toBe(minutes);
  });

  it.each(["", "2:30", "150", "2,5", "2h5", "2h60", "h30", "2h30min", "-1h", "2 h 30"])(
    "refuses %j",
    (text) => {
      expect(parseHoursInput(text)).toBeNull();
    },
  );
});
