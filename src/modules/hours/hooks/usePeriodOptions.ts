import { useTranslation } from "react-i18next";

import { useListPendingHourEntries } from "@api/generated/hours/hours";
import { HourEntryStatus } from "@api/generated/model";
import type { SelectOption } from "@shared/ui";

import { currentPeriod, periodParts, periodsBetween } from "../lib/bank-period";

/** One entry is enough: the queue comes from the oldest day, whatever the status. */
const PROBE = { page: 1, limit: 1 } as const;

/**
 * The options of the Período: every month from the one of the oldest entry the person can see to
 * the current month, plus the month that is chosen, the newest first. The contract has no route
 * that lists the months with entries, so this asks the queue for the oldest entry of each status
 * (`GET /hour-entries` sorts by day, ascending, for any status) and takes the oldest of the four.
 * A month with no entries in between shows up too (it shows the empty state).
 */
export function usePeriodOptions(selected: string): SelectOption[] {
  const { t, i18n } = useTranslation("hours");
  const pending = useListPendingHourEntries({ ...PROBE, status: HourEntryStatus.pending });
  const approved = useListPendingHourEntries({ ...PROBE, status: HourEntryStatus.approved });
  const adjusted = useListPendingHourEntries({ ...PROBE, status: HourEntryStatus.adjusted });
  const rejected = useListPendingHourEntries({ ...PROBE, status: HourEntryStatus.rejected });

  const oldest = [pending, approved, adjusted, rejected]
    .map((query) => query.data?.data.at(0)?.date)
    .filter((date): date is string => date !== undefined)
    .sort()
    .at(0);
  const now = currentPeriod();
  const periods = new Set(oldest === undefined ? [now] : periodsBetween(oldest.slice(0, 7), now));
  periods.add(selected);

  return [...periods]
    .sort()
    .reverse()
    .map((id) => ({
      id,
      label: t("bank.filters.periodValue", periodParts(id, i18n.language)),
    }));
}
