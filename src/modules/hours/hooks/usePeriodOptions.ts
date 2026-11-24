import { useTranslation } from "react-i18next";

import { useListPendingHourEntries } from "@api/generated/hours/hours";
import { HourEntryStatus } from "@api/generated/model";
import type { SelectOption } from "@shared/ui";

import { currentPeriod, periodParts, periodsBetween, shiftPeriod } from "../lib/bank-period";

/** One entry is enough: the queue comes from the oldest day, whatever the status. */
const PROBE = { page: 1, limit: 1 } as const;

/** When a probe fails the oldest entry is not known, and the options go this many months back. */
const FALLBACK_MONTHS = 24;

/**
 * The options of the Período: every month from the one of the oldest entry the person can see to
 * the current month, plus the month that is chosen, the newest first. The contract has no route
 * that lists the months with entries, so this asks the queue for the oldest entry of each status
 * (`GET /hour-entries` sorts by day, ascending, for any status) and takes the oldest of the four.
 * A month with no entries in between shows up too (it shows the empty state). A probe that failed
 * would hide the months of its status behind a list that looks complete: then the last 24 months
 * are offered too.
 */
export function usePeriodOptions(selected: string): SelectOption[] {
  const { t, i18n } = useTranslation("hours");
  const pending = useListPendingHourEntries({ ...PROBE, status: HourEntryStatus.pending });
  const approved = useListPendingHourEntries({ ...PROBE, status: HourEntryStatus.approved });
  const adjusted = useListPendingHourEntries({ ...PROBE, status: HourEntryStatus.adjusted });
  const rejected = useListPendingHourEntries({ ...PROBE, status: HourEntryStatus.rejected });
  const probes = [pending, approved, adjusted, rejected];

  const now = currentPeriod();
  const hasFailedProbe = probes.some((query) => query.isError && query.data === undefined);
  const first = [
    ...probes.map((query) => query.data?.data.at(0)?.date.slice(0, 7)),
    hasFailedProbe ? shiftPeriod(now, 1 - FALLBACK_MONTHS) : undefined,
  ]
    .filter((period): period is string => period !== undefined)
    .sort()
    .at(0);
  const periods = new Set(first === undefined ? [now] : periodsBetween(first, now));
  periods.add(selected);

  return [...periods]
    .sort()
    .reverse()
    .map((id) => ({
      id,
      label: t("bank.filters.periodValue", periodParts(id, i18n.language)),
    }));
}
