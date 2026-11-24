import type { MemberHourEntryResponseDto } from "@api/generated/model";
import { usePermissionCheck } from "@modules/auth";

/**
 * Whether the person reviews hours, and each entry. The queue needs the answer of every row for its
 * "select all", so it asks the predicate of `auth` (the question of `useCan`, as a function). An
 * entry of the person herself is never reviewable (SELF_REVIEW_NOT_ALLOWED).
 */
export function useReviewPermission() {
  const check = usePermissionCheck();

  return {
    canReview: check("hours.review"),
    canReviewEntry: (entry: Pick<MemberHourEntryResponseDto, "personId">) =>
      check("hours.review", { personId: entry.personId }),
  };
}
