import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement, Ref } from "react";
import { useTranslation } from "react-i18next";

import type { HoursMemberTotalDto, HoursOverviewResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { ListState } from "@shared/components/ListState";
import { formatHours } from "@shared/lib/format";
import { resolveListState } from "@shared/lib/list-state";
import { Button, Card, Pagination } from "@shared/ui";

import { PendingHours } from "./PendingHours";

export interface MemberHoursTableProps {
  /** The overview of the period, as `useGetHoursOverview` returns it. */
  query: UseQueryResult<HoursOverviewResponseDto, unknown>;
  /** The search already sent (after the pause): it tells "no result" from "empty". */
  hasSearch: boolean;
  /** Whether "Ver todos" was pressed: then the members come 20 by page, with the pagination. */
  showAll: boolean;
  page: number;
  onShowAll: () => void;
  onPageChange: (page: number) => void;
  onClearSearch: () => void;
  /** Opens the view of a member, by "Ver membro" or by the row. */
  onOpenMember: (personId: string) => void;
  /** The title of the card, which takes the focus when the view of everyone comes back. */
  titleRef: Ref<HTMLSpanElement>;
}

/**
 * "Horas por membro": the members with entries in the period, in the order of the API (the pending
 * ones first), with their department, the hours logged and the pending hours. "Ver membro" and the
 * row open the view of the member; a member who is no longer found has neither. The first load shows
 * four, with "Ver todos"; after it, twenty by page. The header of the columns stays in every state.
 */
export function MemberHoursTable({
  query,
  hasSearch,
  showAll,
  page,
  onShowAll,
  onPageChange,
  onClearSearch,
  onOpenMember,
  titleRef,
}: MemberHoursTableProps): ReactElement {
  const { t } = useTranslation("hours");
  const members = query.data?.members;
  const rows = members?.data ?? [];
  const total = members?.total;
  const totalPages =
    members === undefined ? 1 : Math.max(1, Math.ceil(members.total / members.limit));

  // The refetch of a query in error and without data goes back to "pending": keeping the error
  // panel (with the button loading) keeps the button, and the focus, on the screen.
  const isRetrying = query.isPending && query.isFetching && query.errorUpdateCount > 0;
  const listState = resolveListState({
    // Without rows the placeholder holds nothing on the screen: it waits as loading.
    isPending: (query.isPending && !isRetrying) || (query.isPlaceholderData && total === 0),
    isError: query.isError || isRetrying,
    total,
    hasActiveFilters: hasSearch,
  });

  const columns: Column<HoursMemberTotalDto>[] = [
    {
      header: t("bank.members.member"),
      headerClassName: "w-[30%] uppercase",
      cellClassName: "font-medium",
      render: (row) =>
        row.member === null ? (
          <span className="text-muted italic">{t("bank.members.removed")}</span>
        ) : (
          row.member.name
        ),
    },
    {
      header: t("bank.members.department"),
      headerClassName: "w-[23%] uppercase",
      render: (row) =>
        row.member?.department ? (
          row.member.department.name
        ) : (
          <span className="text-muted">
            <span aria-hidden="true">{t("common:details.empty")}</span>
            <span className="sr-only">{t("common:details.notInformed")}</span>
          </span>
        ),
    },
    {
      header: t("bank.members.declared"),
      headerClassName: "w-[16%] uppercase",
      render: (row) => formatHours(row.declaredMinutes),
    },
    {
      header: t("bank.members.pending"),
      headerClassName: "w-[16%] uppercase",
      render: (row) => <PendingHours minutes={row.pendingMinutes} />,
    },
    {
      header: t("bank.members.actions"),
      headerClassName: "w-[15%] uppercase",
      render: (row) =>
        row.member === null ? null : (
          <Button
            variant="secondary"
            aria-label={t("bank.members.viewMemberLabel", { name: row.member.name })}
            onPress={() => onOpenMember(row.personId)}
          >
            {t("bank.members.viewMember")}
          </Button>
        ),
    },
  ];

  function renderListState(): ReactElement | null {
    switch (listState) {
      case "loading":
        return <ListState variant="loading" title={t("bank.members.loading")} />;
      case "empty":
        return (
          <ListState
            variant="empty"
            title={t("bank.members.empty")}
            description={t("bank.members.emptyDescription")}
          />
        );
      case "noResults":
        return (
          <ListState
            variant="noResults"
            title={t("bank.members.noResults")}
            description={t("bank.members.noResultsDescription")}
            action={{ label: t("bank.members.clearSearch"), onPress: onClearSearch }}
          />
        );
      case "error":
        return (
          <ListState
            variant="error"
            title={t("bank.states.error")}
            description={t("bank.states.errorDescription")}
            action={{
              label: t("bank.states.retry"),
              onPress: () => void query.refetch(),
              isLoading: query.isFetching,
            }}
          />
        );
      default:
        return null;
    }
  }

  return (
    <Card
      className="rounded-3xl"
      title={
        <span ref={titleRef} tabIndex={-1} className="outline-none">
          {t("bank.members.title")}
        </span>
      }
    >
      <div
        aria-busy={query.isPlaceholderData || undefined}
        className={query.isPlaceholderData ? "opacity-75" : undefined}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.personId}
          onRowClick={(row) => {
            if (row.member !== null) onOpenMember(row.personId);
          }}
          caption={t("bank.members.caption")}
          tableClassName="table-fixed min-w-180"
        />
        {renderListState()}
      </div>

      {listState === null && total !== undefined ? (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <p aria-live="polite" className="text-base text-muted">
            {t("bank.members.summary", { shown: rows.length, total })}
          </p>
          {!showAll && total > rows.length ? (
            <Button variant="secondary" onPress={onShowAll}>
              {t("bank.members.viewAll")}
            </Button>
          ) : null}
          {showAll && totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
              label={t("bank.members.pagination.nav")}
              previousLabel={t("bank.members.pagination.previous")}
              nextLabel={t("bank.members.pagination.next")}
              pageLabel={(number) => t("bank.members.pagination.page", { page: number })}
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
