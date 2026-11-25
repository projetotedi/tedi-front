import type { ClassLessonsPreviewResponseDto } from "@api/generated/model";

export interface OutsidePeriodSummary {
  /**
   * The lessons after the last day of the class: how many, and the first of them, by its place in
   * the preview (`position`, from 1) and its day. The place is the index in the list, not the
   * `sequenceOrder` of the plan, which skips a number when an archived plan is left out.
   */
  afterEnd: { count: number; position: number; date: string } | null;
  /** The lessons before the first day of the class. */
  beforeStart: { count: number } | null;
}

/**
 * What the warning of the lessons outside the period says (RN-21). The API marks each lesson with
 * `outsideClassPeriod`; this tells on which side of the period the marked ones are, comparing the
 * days (`YYYY-MM-DD` sorts as text) with the start and the end of the class that came in the same
 * answer. A lesson that is not marked is never counted, whatever its day.
 */
export function summarizeOutsidePeriod(
  preview: ClassLessonsPreviewResponseDto,
): OutsidePeriodSummary {
  let afterEnd: OutsidePeriodSummary["afterEnd"] = null;
  let beforeStartCount = 0;

  preview.items.forEach((item, index) => {
    if (!item.outsideClassPeriod) return;

    if (item.date > preview.classEndDate) {
      afterEnd = {
        count: (afterEnd?.count ?? 0) + 1,
        position: afterEnd?.position ?? index + 1,
        date: afterEnd?.date ?? item.date,
      };
    } else if (item.date < preview.classStartDate) {
      beforeStartCount += 1;
    }
  });

  return {
    afterEnd,
    beforeStart: beforeStartCount > 0 ? { count: beforeStartCount } : null,
  };
}
