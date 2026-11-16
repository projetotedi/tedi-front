import { describe, expect, it } from "vitest";

import { summarizeOutsidePeriod } from "../lib/outside-period";
import {
  buildOutsidePreview,
  buildPreview,
  buildPreviewFor,
  buildPreviewItem,
  CLASS_END_DATE,
  CLASS_START_DATE,
  FIGMA_BODY,
  PLAN_FIXTURES,
} from "./handlers";

describe("summarizeOutsidePeriod", () => {
  it("is empty when every lesson is inside the period", () => {
    expect(summarizeOutsidePeriod(buildPreview())).toEqual({ afterEnd: null, beforeStart: null });
  });

  it("says the first lesson after the end, by its place in the list and its day (the Figma: the 4th, on 28/04)", () => {
    const preview = buildOutsidePreview();

    expect(preview.outsideClassPeriodCount).toBe(1);
    expect(summarizeOutsidePeriod(preview)).toEqual({
      afterEnd: { count: 1, position: 4, date: "2026-04-28" },
      beforeStart: null,
    });
  });

  it("counts every lesson after the end and points at the first of them", () => {
    // From 14/04, the series is 14/04, 21/04, 28/04 and 05/05: the last two are after 24/04.
    const preview = buildPreviewFor(
      { ...FIGMA_BODY, firstDate: "2026-04-14" },
      { plans: PLAN_FIXTURES },
    );

    expect(preview.outsideClassPeriodCount).toBe(2);
    expect(summarizeOutsidePeriod(preview)).toEqual({
      afterEnd: { count: 2, position: 3, date: "2026-04-28" },
      beforeStart: null,
    });
  });

  it("says the lessons before the start of the class", () => {
    // From 24/03, the series is 24/03, 31/03 and 07/04: the first two are before 07/04.
    const preview = buildPreviewFor({ ...FIGMA_BODY, firstDate: "2026-03-24" });

    expect(preview.outsideClassPeriodCount).toBe(2);
    expect(summarizeOutsidePeriod(preview)).toEqual({
      afterEnd: null,
      beforeStart: { count: 2 },
    });
  });

  it("says both sides when the series starts before the class and ends after it", () => {
    // A class of one day (07/04): 31/03 is before it, 07/04 is the day itself, 14/04 and 21/04 are after.
    const preview = buildPreviewFor(
      { ...FIGMA_BODY, firstDate: "2026-03-31" },
      { plans: PLAN_FIXTURES, classEndDate: "2026-04-07" },
    );

    expect(summarizeOutsidePeriod(preview)).toEqual({
      afterEnd: { count: 2, position: 3, date: "2026-04-14" },
      beforeStart: { count: 1 },
    });
  });

  it("numbers the lesson by its place in the list, not by the sequence order of its plan", () => {
    // An archived plan left the sequence order with a gap: the 3rd of the list is order 4.
    const preview = buildPreview({
      items: [
        buildPreviewItem({ date: "2026-04-07", sequenceOrder: 1 }),
        buildPreviewItem({ date: "2026-04-14", sequenceOrder: 3 }),
        buildPreviewItem({ date: "2026-04-28", sequenceOrder: 4, outsideClassPeriod: true }),
      ],
    });

    expect(summarizeOutsidePeriod(preview).afterEnd).toEqual({
      count: 1,
      position: 3,
      date: "2026-04-28",
    });
  });

  it("looks only at the lessons the API marked, whatever their day", () => {
    const preview = buildPreview({
      items: [
        buildPreviewItem({ date: "2026-04-07" }),
        buildPreviewItem({ date: "2026-05-30", outsideClassPeriod: false }),
      ],
    });

    expect(summarizeOutsidePeriod(preview)).toEqual({ afterEnd: null, beforeStart: null });
  });

  it("takes the first and the last day of the class as inside", () => {
    const preview = buildPreview({
      classStartDate: CLASS_START_DATE,
      classEndDate: CLASS_END_DATE,
      items: [
        buildPreviewItem({ date: CLASS_START_DATE }),
        buildPreviewItem({ date: CLASS_END_DATE }),
      ],
    });

    expect(summarizeOutsidePeriod(preview)).toEqual({ afterEnd: null, beforeStart: null });
  });
});
