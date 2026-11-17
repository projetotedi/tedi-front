import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListPendingHourEntries, useValidateHourEntries } from "@api/generated/hours/hours";
import type { MemberHourEntryResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { ListState } from "@shared/components/ListState";
import { formatHours } from "@shared/lib/format";
import { resolveListState } from "@shared/lib/list-state";
import { Badge, Card, Checkbox, Pagination, toast } from "@shared/ui";

import { useReviewPermission } from "../hooks/useReviewPermission";
import { CATEGORY_LABEL_KEYS } from "../lib/bank-labels";
import { formatEntryDay } from "../lib/bank-format";
import { STALE_QUEUE_ERRORS, toReviewError, type ReviewErrorKind } from "../lib/review-errors";
import { invalidateAfterReview } from "../lib/review-queries";
import { ReviewRowActions } from "./ReviewRowActions";
import { ReviewSelectionBar } from "./ReviewSelectionBar";

const PENDING_PAGE_SIZE = 20;

const VALIDATE_ERROR_KEYS: Record<ReviewErrorKind, string> = {
  notPending: "review.errors.notPending",
  notFound: "review.errors.notFound",
  selfReview: "review.errors.selfReview",
  unchanged: "review.errors.generic",
  invalid: "review.errors.generic",
  generic: "review.errors.generic",
};

export interface PendingEntriesTableProps {
  /** The period and the member of the queue; empty is the whole queue. The parent changes the `key` when it changes. */
  filter: { from?: string; to?: string; personId?: string };
}

/**
 * "Lançamentos pendentes de validação (N)": the queue of the entries that wait for the coordination,
 * from the oldest day, twenty by page. Who reviews (`hours.review`) selects entries for the batch
 * and validates them, in batch or one by one; the director sees the entries without selection nor
 * actions. The person's own entry cannot be reviewed (SELF_REVIEW_NOT_ALLOWED): its box and buttons
 * are turned off and "select all" leaves it out.
 *
 * - **Selection.** By page, and only of the rows on the screen: what was selected and left the queue
 *   is dropped at every render, so a batch never sends an id that is not on the screen. It is
 *   cleared on another page, after a validation and after a refusal that says the queue is out of
 *   date.
 * - **Validating.** The queue is read again inside the mutation (the hook awaits it), so the
 *   buttons stay busy and the rows stay on the screen until the queue answers: no window for a
 *   second press to send the same ids. Then the toast says how many and whose, and the focus goes
 *   to the title (the button pressed left with its row).
 */
export function PendingEntriesTable({ filter }: PendingEntriesTableProps): ReactElement {
  const { t, i18n } = useTranslation("hours");
  const queryClient = useQueryClient();
  const titleId = useId();
  const titleRef = useRef<HTMLSpanElement>(null);
  const inFlightRef = useRef(false);
  const entriesInFlightRef = useRef<MemberHourEntryResponseDto[]>([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const { canReview, canReviewEntry } = useReviewPermission();

  const query = useListPendingHourEntries(
    { ...filter, page, limit: PENDING_PAGE_SIZE },
    { query: { placeholderData: keepPreviousData } },
  );
  const validate = useValidateHourEntries({
    mutation: {
      // The answer carries id and personId of each validated entry.
      onSuccess: (validated) => invalidateAfterReview(queryClient, validated),
      onError: (error) =>
        STALE_QUEUE_ERRORS.has(toReviewError(error))
          ? invalidateAfterReview(queryClient, entriesInFlightRef.current)
          : undefined,
    },
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total;
  const selectable = canReview ? rows.filter(canReviewEntry) : [];
  const selectedRows = selectable.filter((row) => selected.has(row.id));
  const isBusy = validate.isPending;
  const validatingIds = validate.isPending ? validate.variables?.data.ids : undefined;
  const isBatchValidating = validatingIds !== undefined && validatingIds.length > 1;
  const totalPages =
    query.data === undefined ? 1 : Math.max(1, Math.ceil(query.data.total / query.data.limit));

  const isRetrying = query.isPending && query.isFetching && query.errorUpdateCount > 0;
  const listState = resolveListState({
    isPending: (query.isPending && !isRetrying) || (query.isPlaceholderData && total === 0),
    isError: query.isError || isRetrying,
    total,
    hasActiveFilters: false,
  });

  function nameOf(entry: MemberHourEntryResponseDto): string {
    return entry.member?.name ?? t("bank.members.removed");
  }

  function listNames(entries: MemberHourEntryResponseDto[]): string {
    const names = [...new Set(entries.map(nameOf))];
    return new Intl.ListFormat(i18n.language, { style: "long", type: "conjunction" }).format(names);
  }

  function toggle(id: string, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function changePage(next: number) {
    setPage(next);
    setSelected(new Set());
  }

  function validateEntries(entries: MemberHourEntryResponseDto[]) {
    if (validate.isPending || inFlightRef.current || entries.length === 0) return;
    inFlightRef.current = true;
    entriesInFlightRef.current = entries;

    validate.mutate(
      { data: { ids: entries.map((entry) => entry.id) } },
      {
        // These run after the queue was read again (the hook awaited it): only toast, selection and focus.
        onSuccess: () => {
          const minutes = entries.reduce((sum, entry) => sum + entry.declaredMinutes, 0);
          toast.success(t("review.validated", { count: entries.length }), {
            description: t("review.validatedDescription", {
              hours: formatHours(minutes),
              names: listNames(entries),
            }),
          });
          setSelected(new Set());
          titleRef.current?.focus();
        },
        onError: (error) => {
          const kind = toReviewError(error);
          toast.error(t(VALIDATE_ERROR_KEYS[kind]));
          if (STALE_QUEUE_ERRORS.has(kind)) setSelected(new Set());
        },
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  const reviewColumns: Column<MemberHourEntryResponseDto>[] = [
    {
      header: t("review.select"),
      headerClassName: "w-11",
      headerContent: (
        <Checkbox
          isLabelHidden
          label={t("review.selectAll")}
          isSelected={selectable.length > 0 && selectedRows.length === selectable.length}
          isIndeterminate={selectedRows.length > 0 && selectedRows.length < selectable.length}
          isDisabled={selectable.length === 0 || isBusy}
          onChange={(isSelected) =>
            setSelected(new Set(isSelected ? selectable.map((row) => row.id) : []))
          }
        />
      ),
      render: (row) => (
        <Checkbox
          isLabelHidden
          label={t("review.selectEntry", {
            name: nameOf(row),
            date: formatEntryDay(row.date, i18n.language),
          })}
          isSelected={selected.has(row.id)}
          isDisabled={!canReviewEntry(row) || isBusy}
          onChange={(isSelected) => toggle(row.id, isSelected)}
        />
      ),
    },
  ];

  const widths = canReview
    ? {
        date: "w-[9%]",
        member: "w-[16%]",
        activity: "w-[26%]",
        category: "w-[14%]",
        hours: "w-[8%]",
      }
    : {
        date: "w-[12%]",
        member: "w-[22%]",
        activity: "w-[36%]",
        category: "w-[18%]",
        hours: "w-[12%]",
      };

  const entryColumns: Column<MemberHourEntryResponseDto>[] = [
    {
      header: t("review.date"),
      headerClassName: `${widths.date} uppercase`,
      cellClassName: "whitespace-nowrap",
      render: (row) => formatEntryDay(row.date, i18n.language),
    },
    {
      header: t("review.member"),
      headerClassName: `${widths.member} uppercase`,
      render: (row) =>
        row.member === null ? (
          <span className="text-muted">{t("bank.members.removed")}</span>
        ) : (
          row.member.name
        ),
    },
    {
      header: t("review.activity"),
      headerClassName: `${widths.activity} uppercase`,
      render: (row) => row.activity,
    },
    {
      header: t("review.category"),
      headerClassName: `${widths.category} uppercase`,
      render: (row) => <Badge tone="info">{t(CATEGORY_LABEL_KEYS[row.category])}</Badge>,
    },
    {
      header: t("review.hours"),
      headerClassName: `${widths.hours} uppercase`,
      render: (row) => formatHours(row.declaredMinutes),
    },
  ];

  const actionsColumn: Column<MemberHourEntryResponseDto> = {
    header: t("review.actions"),
    headerClassName: "w-[24%] uppercase",
    render: (row) => (
      <ReviewRowActions
        entry={row}
        isOwn={!canReviewEntry(row)}
        isBusy={isBusy}
        isValidating={validatingIds?.length === 1 && validatingIds[0] === row.id}
        onValidate={() => validateEntries([row])}
      />
    ),
  };

  const columns = canReview ? [...reviewColumns, ...entryColumns, actionsColumn] : entryColumns;

  function renderListState(): ReactElement | null {
    switch (listState) {
      case "loading":
        return <ListState variant="loading" title={t("review.loading")} />;
      case "empty":
      case "noResults":
        return (
          <ListState
            variant="empty"
            title={t("review.empty")}
            description={t("review.emptyDescription")}
          />
        );
      case "error":
        return (
          <ListState
            variant="error"
            title={t("review.error")}
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

  const title =
    total === undefined ? t("review.titlePending") : t("review.title", { count: total });

  return (
    // <Card> has no aria-labelledby of its own: the region is here, pointing at the title it draws.
    <section aria-labelledby={titleId}>
      <Card
        className="rounded-3xl"
        title={
          <span id={titleId} ref={titleRef} tabIndex={-1} className="outline-none">
            {title}
          </span>
        }
        aside={
          selectedRows.length > 0 ? (
            <ReviewSelectionBar
              selectedCount={selectedRows.length}
              total={selectable.length}
              minutes={selectedRows.reduce((sum, row) => sum + row.declaredMinutes, 0)}
              isBusy={isBusy}
              isValidating={isBatchValidating}
              onClear={() => setSelected(new Set())}
              onValidate={() => validateEntries(selectedRows)}
            />
          ) : undefined
        }
      >
        <div
          aria-busy={query.isPlaceholderData || undefined}
          className={query.isPlaceholderData ? "opacity-75" : undefined}
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            caption={t("review.caption")}
            tableClassName="table-fixed min-w-240"
          />
          {renderListState()}
        </div>

        {listState === null && query.data !== undefined && totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p aria-live="polite" className="text-base text-muted">
              {t("review.summary", { shown: rows.length, total: query.data.total })}
            </p>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={changePage}
              label={t("review.pagination.nav")}
              previousLabel={t("review.pagination.previous")}
              nextLabel={t("review.pagination.next")}
              pageLabel={(number) => t("review.pagination.page", { page: number })}
            />
          </div>
        ) : null}
      </Card>
    </section>
  );
}
