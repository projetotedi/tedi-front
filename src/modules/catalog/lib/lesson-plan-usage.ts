import { LessonPlanUsageStatus, type LessonPlanDetailDto } from "@api/generated/model";

/**
 * RF-017: a plan that courses already use needs a confirmation before its duration changes,
 * because the workload of every one of those courses changes with it (RN-24).
 * A plan nobody uses, or an edit that keeps the duration, saves right away.
 */
export function needsUsageConfirmation(
  plan: Pick<LessonPlanDetailDto, "status" | "expectedDurationMinutes">,
  newDurationMinutes: number,
): boolean {
  return (
    plan.status === LessonPlanUsageStatus.in_use &&
    newDurationMinutes !== plan.expectedDurationMinutes
  );
}
