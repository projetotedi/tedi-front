import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useListMyAssignments } from "@api/generated/assignments/assignments";
import type { MyAssignmentsTotalsDto } from "@api/generated/model";
import { Skeleton } from "@shared/ui";

interface Tile {
  key: keyof MyAssignmentsTotalsDto;
  /** The colors of the tile: a pair of the theme with 4,5:1 or more between the text and the background. */
  tile: string;
  label: string;
}

const TILES: Tile[] = [
  { key: "upcoming", tile: "bg-surface text-foreground", label: "text-muted" },
  {
    key: "confirmed",
    tile: "bg-tedi-badge-success text-tedi-badge-success-foreground",
    label: "",
  },
  { key: "pending", tile: "bg-tedi-warning text-tedi-warning-foreground", label: "" },
  { key: "openLessons", tile: "bg-tedi-badge text-tedi-badge-foreground", label: "" },
];

/**
 * The four numbers on top of "Minhas aulas": the lessons of the next four weeks, the confirmed ones,
 * the ones waiting for confirmation, and the lessons with a vacancy for the member. They are the
 * `totals` of `GET /me/assignments`, with no period, which the API resolves to today and the 27 days
 * that follow. The read is the same as the table below it (the key is the same), so it is one
 * request. While it loads each number is a skeleton, and when it fails (and there is nothing in the
 * cache) each shows a dash that a screen reader reads as "Não informado": the table below says the
 * error and offers to try again.
 */
export function MyLessonsSummary(): ReactElement {
  const { t } = useTranslation("assignments");
  const query = useListMyAssignments();
  const totals = query.data?.totals;

  function renderValue(key: Tile["key"]): ReactNode {
    if (totals !== undefined) return totals[key];
    if (query.isPending) return <Skeleton className="h-9 w-12 rounded-lg" />;

    return (
      <>
        <span aria-hidden="true">{t("details.empty", { ns: "common" })}</span>
        <span className="sr-only">{t("details.notInformed", { ns: "common" })}</span>
      </>
    );
  }

  return (
    <section aria-label={t("myLessons.summary.title")}>
      {query.isPending ? (
        <p role="status" className="sr-only">
          {t("myLessons.summary.loading")}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map(({ key, tile, label }) => (
          <li key={key} className={`flex flex-col gap-1 rounded-[20px] p-4 shadow-surface ${tile}`}>
            <p className={`text-base ${label}`.trim()}>{t(`myLessons.summary.${key}`)}</p>
            <div className="text-3xl font-bold">{renderValue(key)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
