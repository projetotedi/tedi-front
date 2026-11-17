import type { MemberHourEntryResponseDto } from "@api/generated/model";
import { useAuth } from "@modules/auth";
import { can } from "@shared/lib/permissions";

/**
 * Whether the person reviews hours, and each entry. `useCan` answers one question per call, and the
 * queue needs the answer of every row for its "select all", so this reads the same `can` with the
 * user of the session. An entry of the person herself is never reviewable (SELF_REVIEW_NOT_ALLOWED).
 */
export function useReviewPermission() {
  const { user } = useAuth();

  return {
    canReview: can(user, "hours.review"),
    canReviewEntry: (entry: Pick<MemberHourEntryResponseDto, "personId">) =>
      can(user, "hours.review", { personId: entry.personId }),
  };
}
