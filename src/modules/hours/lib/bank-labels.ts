import type { TFunction } from "i18next";

import { HourEntryCategory, type MemberHourEntryResponseDto } from "@api/generated/model";

/** The name of the member of an entry, or "Membro removido" when the API no longer finds her. */
export function memberNameOf(
  entry: Pick<MemberHourEntryResponseDto, "member">,
  t: TFunction<"hours">,
): string {
  return entry.member?.name ?? t("bank.members.removed");
}

/**
 * The label of each category, under the namespace `hours`. It duplicates `entry-labels.ts` of
 * GUS-163 on purpose (both cards were built at the same time): the second one merged unifies them.
 */
export const CATEGORY_LABEL_KEYS: Record<HourEntryCategory, string> = {
  [HourEntryCategory.lesson]: "bank.categories.labels.lesson",
  [HourEntryCategory.planning]: "bank.categories.labels.planning",
  [HourEntryCategory.event]: "bank.categories.labels.event",
  [HourEntryCategory.management]: "bank.categories.labels.management",
  [HourEntryCategory.meeting]: "bank.categories.labels.meeting",
  [HourEntryCategory.support]: "bank.categories.labels.support",
  [HourEntryCategory.other]: "bank.categories.labels.other",
};

/** The order of the categories on the screen: the one of the contract. */
export const CATEGORY_ORDER: readonly HourEntryCategory[] = Object.values(HourEntryCategory);
