import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListMyHourEntries } from "@api/generated/hours/hours";
import type { HourEntryResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { ListState } from "@shared/components/ListState";
import { resolveListState, type ListStateVariant } from "@shared/lib/list-state";
import { Button, Card, Dialog, Pagination } from "@shared/ui";

import { formatDayMonth } from "../lib/entry-format";
import { MY_STATEMENT_PAGE_SIZE } from "../lib/entry-queries";
import { canRemoveEntry } from "../lib/entry-rules";
import { entryColumns, type EntryColumnWidths } from "./entry-columns";
import { RemoveEntryDialog } from "./RemoveEntryDialog";

/** The widths of the Figma over the 1032px of the table: Ações takes the rest. */
const STATEMENT_WIDTHS: EntryColumnWidths = {
  date: "w-[8%]",
  activity: "w-[30%]",
  category: "w-[14%]",
  declared: "w-[11%]",
  validated: "w-[10%]",
  status: "w-[13%]",
};

export interface MyEntriesDialogProps {
  onClose: () => void;
}

/**
 * "Meus lançamentos", the full statement of the person (`GET /me/hour-entries`, pages of 20, the
 * newest day first): Data, Atividade (with the note of the coordination under an adjusted or
 * rejected entry), Categoria, Declarado, Validado, Status and Ações, in a dialog wide enough for the
 * seven columns. The pages are below the table only past 20 entries, and the page on the screen stays
 * there, busy, while the next one loads.
 *
 * "Remover" is on the entries that can still be removed (pending, and not from the attendance), named
 * by the day and the activity; it opens `RemoveEntryDialog` over the statement, which cannot be closed
 * while that one is open. Once an entry is removed, or the API says it changed meanwhile and the
 * confirmation is closed, its button is gone with it: the focus goes to the list as soon as the
 * statement has been read again. When the removed entry was the only one of the last page, the
 * statement goes back a page.
 *
 * The headers stay on the screen in every state: loading, empty (with how to log hours), and failed
 * (with "Tentar de novo"). The statement is read again every time it opens and leaves the cache when
 * it closes (`gcTime: 0`). Mount it only while it is open.
 */
export function MyEntriesDialog({ onClose }: MyEntriesDialogProps): ReactElement {
  const { t, i18n } = useTranslation("hours");
  const canManage = useCan("account.manageOwn");
  const contentRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<HourEntryResponseDto | null>(null);
  // The entry being removed changed in the API meanwhile: its button will not come back.
  const entryChangedRef = useRef(false);
  // The list takes the focus once the statement is read again; each request counts, even two in a row.
  const listFocusPendingRef = useRef(false);
  const [listFocusRequests, setListFocusRequests] = useState(0);

  const query = useListMyHourEntries(
    { page, limit: MY_STATEMENT_PAGE_SIZE },
    { query: { placeholderData: keepPreviousData, gcTime: 0, refetchOnMount: "always" } },
  );
  const data = query.data;
  const totalPages = data === undefined ? 1 : Math.max(1, Math.ceil(data.total / data.limit));

  // The page that was on the screen may be gone after a removal: go to the last one there is. It is
  // adjusted while rendering (not in an effect), so the empty page is never drawn.
  if (data !== undefined && !query.isPlaceholderData && page > totalPages) setPage(totalPages);

  // A placeholder with no rows holds nothing on the screen, so it counts as loading.
  const isEmptyPlaceholder =
    query.isPlaceholderData && data !== undefined && data.data.length === 0;
  const listState = resolveListState({
    isPending: query.isPending || isEmptyPlaceholder,
    isError: query.isError,
    total: data?.total,
    hasActiveFilters: false,
  });

  useEffect(() => {
    if (!listFocusPendingRef.current || query.isFetching) return;
    listFocusPendingRef.current = false;
    contentRef.current?.focus();
  }, [listFocusRequests, query.isFetching]);

  function focusListWhenRead() {
    listFocusPendingRef.current = true;
    setListFocusRequests((count) => count + 1);
  }

  function closeRemoving() {
    setRemoving(null);
    if (entryChangedRef.current) {
      entryChangedRef.current = false;
      focusListWhenRead();
    }
  }

  const columns: Column<HourEntryResponseDto>[] = [
    ...entryColumns(t, i18n.language, { widths: STATEMENT_WIDTHS, withReviewNote: true }),
    {
      header: t("myEntries.columns.actions"),
      headerClassName: "uppercase",
      render: (entry) =>
        canManage && canRemoveEntry(entry) ? (
          <Button
            variant="ghost"
            className="-my-2.5 -ms-4 font-medium text-tedi-status-danger-foreground"
            aria-label={t("myEntries.removeLabel", {
              date: formatDayMonth(entry.date, i18n.language),
              activity: entry.activity,
            })}
            onPress={() => setRemoving(entry)}
          >
            {t("myEntries.remove")}
          </Button>
        ) : null,
    },
  ];

  function renderListState(variant: ListStateVariant): ReactElement {
    switch (variant) {
      case "loading":
        return <ListState variant="loading" title={t("myEntries.loading")} />;
      // The statement has no filter, so "no results" is the empty statement.
      case "empty":
      case "noResults":
        return (
          <ListState
            variant="empty"
            title={t("myEntries.emptyTitle")}
            description={t("myEntries.emptyDescription")}
          />
        );
      case "error":
        return (
          <ListState
            variant="error"
            title={t("myEntries.errorTitle")}
            description={t("myEntries.errorDescription")}
            action={{
              label: t("entries.retry"),
              onPress: () => void query.refetch(),
              isLoading: query.isFetching,
            }}
          />
        );
      default: {
        const unknownVariant: never = variant;
        return unknownVariant;
      }
    }
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("myEntries.title")}
      closeLabel={t("entries.close")}
      // Esc goes to the dialog on top first; this one does not close while Remover is open.
      isDismissable={removing === null}
      size="table"
      footer={
        <Button variant="primary" onPress={onClose}>
          {t("entries.close")}
        </Button>
      }
    >
      <Card>
        <div
          ref={contentRef}
          role="region"
          aria-label={t("myEntries.title")}
          aria-busy={query.isPlaceholderData || undefined}
          tabIndex={-1}
          className="outline-none"
        >
          <DataTable
            caption={t("myEntries.title")}
            rows={data?.data ?? []}
            rowKey={(entry) => entry.id}
            columns={columns}
          />
          {listState === null ? null : renderListState(listState)}
          {listState === null && totalPages > 1 ? (
            <div className="flex justify-end pt-2">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={t("myEntries.pagination.nav")}
                previousLabel={t("myEntries.pagination.previous")}
                nextLabel={t("myEntries.pagination.next")}
                pageLabel={(number) => t("myEntries.pagination.page", { page: number })}
              />
            </div>
          ) : null}
        </div>
      </Card>

      {removing === null ? null : (
        <RemoveEntryDialog
          entry={removing}
          onClose={closeRemoving}
          onRemoved={focusListWhenRead}
          onStale={() => {
            entryChangedRef.current = true;
          }}
        />
      )}
    </Dialog>
  );
}
