import { describe, expect, it } from "vitest";

import { LessonPlanUsageStatus } from "@api/generated/model";

import { needsUsageConfirmation } from "../lib/lesson-plan-usage";

describe("needsUsageConfirmation", () => {
  it("asks for confirmation when a plan in use changes its duration", () => {
    const plan = { status: LessonPlanUsageStatus.in_use, expectedDurationMinutes: 90 };

    expect(needsUsageConfirmation(plan, 120)).toBe(true);
    expect(needsUsageConfirmation(plan, 60)).toBe(true);
  });

  it("does not ask when a plan in use keeps the same duration", () => {
    const plan = { status: LessonPlanUsageStatus.in_use, expectedDurationMinutes: 90 };

    expect(needsUsageConfirmation(plan, 90)).toBe(false);
  });

  it("does not ask when no course uses the plan, whatever the new duration is", () => {
    const plan = { status: LessonPlanUsageStatus.unused, expectedDurationMinutes: 90 };

    expect(needsUsageConfirmation(plan, 120)).toBe(false);
    expect(needsUsageConfirmation(plan, 90)).toBe(false);
  });
});
