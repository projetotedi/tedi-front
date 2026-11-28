import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useGetHoursOverview, useGetMemberHours } from "@api/generated/hours/hours";
import { ListState } from "@shared/components/ListState";
import { useDebounce } from "@shared/hooks/useDebounce";
import { Card } from "@shared/ui";

import { BankFilters } from "../components/BankFilters";
import { CategoryHoursTable } from "../components/CategoryHoursTable";
import { ExportHoursButton } from "../components/ExportHoursButton";
import { HoursTotals } from "../components/HoursTotals";
import { MemberHoursTable } from "../components/MemberHoursTable";
import { PendingEntriesTable } from "../components/PendingEntriesTable";
import { useBankParams } from "../hooks/useBankParams";
import { usePeriodOptions } from "../hooks/usePeriodOptions";
import { periodRange } from "../lib/bank-period";

const MEMBERS_PREVIEW_LIMIT = 4;
const MEMBERS_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * "Banco de horas" (`/hours`, `hours.viewOthers`): the hours of the period of everyone the person
 * can see (the director, her department: the API cuts it), or of one member. The month and the
 * member live in the URL (`?period=AAAA-MM&member=<personId>`). The search narrows the members and
 * the totals, and typing in the view of a member goes back to everyone. The title (h1) comes from
 * the route (`handle.title`).
 */
export function HoursPage(): ReactElement {
  const { t } = useTranslation("hours");
  const { period, memberId, setPeriod, openMember, closeMember } = useBankParams();
  const { from, to } = periodRange(period);
  const periodOptions = usePeriodOptions(period);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const focusTitleRef = useRef(false);
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
    { query: { enabled: memberId === null, placeholderData: keepPreviousData } },
  );
  // Only the summary is drawn: one entry is enough.
  const member = useGetMemberHours(
    memberId ?? "",
    { from, to, page: 1, limit: 1 },
    { query: { enabled: memberId !== null } },
  );

  // The button pressed to change the view leaves the screen with it: the focus goes to the title of
  // the first block of the new view.
  useEffect(() => {
    if (!focusTitleRef.current) return;
    focusTitleRef.current = false;
    titleRef.current?.focus();
  }, [memberId]);

  function onSearchChange(value: string) {
    setSearch(value);
    setMembersPage(1);
    if (memberId !== null) closeMember();
  }

  function onPeriodChange(next: string) {
    setPeriod(next);
    setMembersPage(1);
  }

  function clearSearch() {
    onSearchChange("");
    searchInputRef.current?.focus();
  }

  function showMember(personId: string) {
    focusTitleRef.current = true;
    openMember(personId);
  }

  function showEveryone() {
    focusTitleRef.current = true;
    closeMember();
  }

  function renderMemberView(personId: string): ReactElement {
    if (member.isError && member.data === undefined) {
      return (
        <Card className="rounded-3xl">
          <ListState
            variant="error"
            title={t("bank.states.memberError")}
            description={t("bank.states.errorDescription")}
            action={{ label: t("bank.states.backToAll"), onPress: showEveryone }}
          />
        </Card>
      );
    }

    return (
      <>
        <HoursTotals summary={member.data?.summary} isLoading={member.isPending} />
        <CategoryHoursTable
          summary={member.data?.summary}
          isLoading={member.isPending}
          titleRef={titleRef}
          memberId={personId}
          memberName={member.data?.member.name}
        />
        <PendingEntriesTable key={`${from}|${to}|${personId}`} filter={{ from, to, personId }} />
      </>
    );
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
          isMemberView={memberId !== null}
          memberName={member.data?.member.name}
          onShowAll={showEveryone}
          onClearMember={showEveryone}
        />
        {/* The export takes no member nor search: when the screen is narrowed, the label says it is everyone. */}
        <ExportHoursButton
          period={period}
          scope={memberId === null && appliedSearch === "" ? "view" : "allMembers"}
        />
      </div>

      {memberId === null ? (
        <>
          <HoursTotals summary={overview.data?.summary} isLoading={overview.isPending} />
          <MemberHoursTable
            query={overview}
            hasSearch={appliedSearch !== ""}
            showAll={showAll}
            page={membersPage}
            onShowAll={() => setShowAll(true)}
            onPageChange={setMembersPage}
            onClearSearch={clearSearch}
            onOpenMember={showMember}
            titleRef={titleRef}
          />
          <PendingEntriesTable key={`${from}|${to}`} filter={{ from, to }} />
        </>
      ) : (
        renderMemberView(memberId)
      )}
    </div>
  );
}
