import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useGetMyHoursSummary } from "@api/generated/hours/hours";
import { useCan } from "@modules/auth";
import { formatHours } from "@shared/lib/format";
import { Alert, Button, Skeleton } from "@shared/ui";

import { summaryTotals, type SummaryTotals } from "../lib/my-hours-summary";

interface Tile {
  key: keyof SummaryTotals;
  /** The colors of the tile: the pair of the Figma, 4,5:1 or more between the text and the background. */
  tile: string;
  label: string;
}

const TILES: Tile[] = [
  { key: "total", tile: "bg-surface text-foreground", label: "text-muted" },
  {
    key: "validated",
    tile: "bg-tedi-badge-success text-tedi-badge-success-foreground",
    label: "",
  },
  { key: "pending", tile: "bg-tedi-warning text-tedi-status-warning-foreground", label: "" },
  {
    key: "adjustedOrRejected",
    tile: "bg-tedi-status-danger text-tedi-status-danger-foreground",
    label: "",
  },
];

/**
 * The four numbers of the hours on top of "Meu perfil": the total logged, the validated hours, the
 * ones waiting for validation and the ones adjusted or rejected, over the whole history of the person
 * (`GET /me/hours/summary` with no period). Each tile has the colors of the Figma.
 *
 * Only for who manages her own account (`account.manageOwn`, every profile): without it nothing is
 * drawn and nothing is asked. While it loads each number is a skeleton; when it fails with nothing in
 * the cache each is a dash a screen reader reads as "Não informado", and under them an alert says it
 * with "Tentar de novo" (this read is its own, so its failure has to be said here). A failed re-read
 * keeps the numbers. The summary leaves the cache when the tiles unmount (`gcTime: 0`), so whoever
 * signs in next on the same tab does not see it.
 */
export function MyHoursSummary(): ReactElement | null {
  const { t } = useTranslation("hours");
  const canView = useCan("account.manageOwn");
  const query = useGetMyHoursSummary(undefined, { query: { enabled: canView, gcTime: 0 } });

  if (!canView) return null;

  const totals = query.data === undefined ? undefined : summaryTotals(query.data);
  const isFailed = totals === undefined && !query.isPending;

  function renderValue(key: Tile["key"]): ReactNode {
    if (totals !== undefined) return formatHours(totals[key]);
    if (query.isPending) return <Skeleton className="h-9 w-12 rounded-lg" />;

    return (
      <>
        <span aria-hidden="true">{t("details.empty", { ns: "common" })}</span>
        <span className="sr-only">{t("details.notInformed", { ns: "common" })}</span>
      </>
    );
  }

  return (
    <section aria-label={t("entries.summary.title")}>
      {query.isPending ? (
        <p role="status" className="sr-only">
          {t("entries.summary.loading")}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map(({ key, tile, label }) => (
          <li key={key} className={`flex flex-col gap-2 rounded-[20px] p-4 shadow-surface ${tile}`}>
            <p className={`text-base font-medium ${label}`.trim()}>{t(`entries.summary.${key}`)}</p>
            <div className="text-3xl font-bold">{renderValue(key)}</div>
          </li>
        ))}
      </ul>
      {isFailed ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Alert variant="error">{t("entries.loadError")}</Alert>
          <Button
            variant="secondary"
            isLoading={query.isFetching}
            onPress={() => void query.refetch()}
          >
            {t("entries.retry")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
