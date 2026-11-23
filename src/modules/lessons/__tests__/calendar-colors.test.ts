import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { calendarEventClasses } from "../lib/calendar-colors";

// Vitest empties the CSS it imports, so the stylesheet is read from the disk, as text.
const indexCss = readFileSync(resolve(__dirname, "../../../index.css"), "utf8");

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];

describe("calendarEventClasses", () => {
  it.each(SLOTS)("gives the slot %i its own background and text color", (slot) => {
    expect(calendarEventClasses(slot)).toBe(
      `bg-tedi-calendar-event-${slot} text-tedi-calendar-event-${slot}-foreground`,
    );
  });

  it("gives one class per color slot, 0 to 7, and no two the same", () => {
    expect(new Set(SLOTS.map(calendarEventClasses)).size).toBe(8);
  });

  it.each([-1, 8, 100, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "a value out of range (%s) falls in the first color",
    (value) => {
      expect(calendarEventClasses(value)).toBe(calendarEventClasses(0));
    },
  );

  it("has every color of the classes declared in src/index.css", () => {
    for (const slot of SLOTS) {
      expect(indexCss).toContain(`--color-tedi-calendar-event-${slot}:`);
      expect(indexCss).toContain(`--color-tedi-calendar-event-${slot}-foreground:`);
    }
  });
});
