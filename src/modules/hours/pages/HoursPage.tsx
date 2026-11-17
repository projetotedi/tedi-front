import { keepPreviousData } from "@tanstack/react-query";
import { useRef, useState, type ReactElement } from "react";

import { useGetHoursOverview } from "@api/generated/hours/hours";
import { useDebounce } from "@shared/hooks/useDebounce";

import { BankFilters } from "../components/BankFilters";
import { ExportHoursButton } from "../components/ExportHoursButton";
import { HoursTotals } from "../components/HoursTotals";
import { MemberHoursTable } from "../components/MemberHoursTable";
import { useBankParams } from "../hooks/useBankParams";
import { usePeriodOptions } from "../hooks/usePeriodOptions";
import { periodRange } from "../lib/bank-period";

const MEMBERS_PREVIEW_LIMIT = 4;
const MEMBERS_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * "Banco de horas" (`/hours`, `hours.viewOthers`): the hours of the period of everyone the person
 * can see (the director, her department: the API cuts it). The month lives in the URL
 * (`?period=AAAA-MM`). The search narrows the members and the totals. The title (h1) comes from the
 * route (`handle.title`).
 */
export function HoursPage(): ReactElement {
  const { period, setPeriod } = useBankParams();
  const { from, to } = periodRange(period);
  const periodOptions = usePeriodOptions(period);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [membersPage, setMembersPage] = useState(1);

  // Clearing the search counts at once: waiting for the pause would keep the old term applied.
  const isSearchEmpty = search.trim() === "";
  const debouncedSearch = useDebounce(search, isSearchEmpty ? 0 : SEARCH_DEBOUNCE_MS);
  const appliedSearch = isSearchEmpty ? "" : debouncedSearch.trim();

  const overview = useGetHoursOverview(
    {
      from,
      to,
      page: showAll ? membersPage : 1,
      limit: showAll ? MEMBERS_PAGE_SIZE : MEMBERS_PREVIEW_LIMIT,
      search: appliedSearch === "" ? undefined : appliedSearch,
    },
    { query: { placeholderData: keepPreviousData } },
  );

  function onSearchChange(value: string) {
    setSearch(value);
    setMembersPage(1);
  }

  function onPeriodChange(next: string) {
    setPeriod(next);
    setMembersPage(1);
  }

  function clearSearch() {
    onSearchChange("");
    searchInputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <BankFilters
          search={search}
          onSearchChange={onSearchChange}
          searchInputRef={searchInputRef}
          period={period}
          periodOptions={periodOptions}
          onPeriodChange={onPeriodChange}
        />
        <ExportHoursButton period={period} scope="view" />
      </div>

      <HoursTotals summary={overview.data?.summary} isLoading={overview.isPending} />
      <MemberHoursTable
        query={overview}
        hasSearch={appliedSearch !== ""}
        showAll={showAll}
        page={membersPage}
        onShowAll={() => setShowAll(true)}
        onPageChange={setMembersPage}
        onClearSearch={clearSearch}
      />
    </div>
  );
}
