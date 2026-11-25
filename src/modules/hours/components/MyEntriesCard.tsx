import { useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListMyHourEntries } from "@api/generated/hours/hours";
import { useCan } from "@modules/auth";
import { DataTable } from "@shared/components/DataTable";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { MY_RECENT_ENTRIES_PARAMS } from "../lib/entry-queries";
import { entryColumns, type EntryColumnWidths } from "./entry-columns";
import { MyEntriesDialog } from "./MyEntriesDialog";

/** The widths of the Figma (Data 70, Atividade 300, Categoria 130, Declarado 95, Validado 90): Status takes the rest. */
const CARD_WIDTHS: EntryColumnWidths = {
  date: "w-[9%]",
  activity: "w-[35%]",
  category: "w-[16%]",
  declared: "w-[12%]",
  validated: "w-[12%]",
  status: "",
};

/**
 * "Meus lançamentos" of "Meu perfil": the five most recent entries of the person
 * (`GET /me/hour-entries?limit=5`, the newest day first), with the day, the activity, the category,
 * the declared and the validated hours and the status. "Ver extrato completo ›", next to the title,
 * opens the full statement (`MyEntriesDialog`, where a pending entry can be removed) and is there only
 * when there are entries; the focus goes back to it when the statement closes, or to the title of the
 * card when no entry is left (the link is gone with the last one). It is a link in look
 * (#2563eb) with no grey on hover, which would leave it under 4,5:1: the hover underlines it.
 *
 * Only for who manages her own account (`account.manageOwn`): without it nothing is drawn and nothing
 * is asked. While it loads the card shows skeletons; a failed read with nothing in the cache says so
 * with "Tentar de novo" (a failed re-read keeps the list); with no entries it says there are none.
 * The entries leave the cache when the card unmounts (`gcTime: 0`).
 */
export function MyEntriesCard(): ReactElement | null {
  const { t, i18n } = useTranslation("hours");
  const canView = useCan("account.manageOwn");
  const query = useListMyHourEntries(MY_RECENT_ENTRIES_PARAMS, {
    query: { enabled: canView, gcTime: 0 },
  });
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const titleRef = useRef<HTMLSpanElement>(null);
  // The statement closed and this card may still be reading its entries again.
  const isReturningFocusRef = useRef(false);
  const page = query.data;
  const hasEntries = page !== undefined && page.total > 0;

  // Once the read after closing the statement settles, a card with no entry left has no link to give
  // the focus back to: the title takes it.
  useEffect(() => {
    if (isStatementOpen || !isReturningFocusRef.current || query.isFetching) return;
    isReturningFocusRef.current = false;
    if (!hasEntries) titleRef.current?.focus();
  }, [isStatementOpen, query.isFetching, hasEntries]);

  if (!canView) return null;

  function closeStatement() {
    isReturningFocusRef.current = true;
    setIsStatementOpen(false);
  }

  const statementLink = hasEntries ? (
    <Button
      variant="ghost"
      className="-my-2.5 -me-4 font-medium text-tedi-text-link underline-offset-2 [--button-bg-hover:transparent] [--button-bg-pressed:transparent] hover:underline focus-visible:underline"
      onPress={() => setIsStatementOpen(true)}
    >
      {t("entries.recent.viewStatement")} <span aria-hidden="true">›</span>
    </Button>
  ) : null;

  function renderContent(): ReactElement {
    if (query.isPending) {
      return (
        <div role="status" className="flex flex-col gap-3">
          <p className="sr-only">{t("entries.recent.loading")}</p>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      );
    }

    // A failed re-read with the list in the cache keeps the list: the error is for when there is
    // nothing to show.
    if (page === undefined) {
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("entries.loadError")}</Alert>
          <Button
            variant="secondary"
            isLoading={query.isFetching}
            onPress={() => void query.refetch()}
          >
            {t("entries.retry")}
          </Button>
        </div>
      );
    }

    if (page.data.length === 0) {
      return <p className="text-base text-muted">{t("entries.recent.empty")}</p>;
    }

    return (
      <DataTable
        caption={t("entries.recent.title")}
        rows={page.data}
        rowKey={(entry) => entry.id}
        columns={entryColumns(t, i18n.language, { widths: CARD_WIDTHS, withReviewNote: false })}
      />
    );
  }

  return (
    <>
      <Card
        title={
          <span ref={titleRef} tabIndex={-1} className="outline-none">
            {t("entries.recent.title")}
          </span>
        }
        aside={statementLink}
      >
        {renderContent()}
      </Card>
      {isStatementOpen ? <MyEntriesDialog onClose={closeStatement} /> : null}
    </>
  );
}
