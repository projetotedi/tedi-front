import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useGetMyHoursSummary } from "@api/generated/hours/hours";
import { useCan } from "@modules/auth";
import { DataTable } from "@shared/components/DataTable";
import { formatHours } from "@shared/lib/format";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { formatMonthYear, monthPeriod } from "../lib/entry-format";
import {
  ENTRY_CATEGORY_LABEL_KEYS,
  ENTRY_STATUS_TAG_CLASSES,
  ENTRY_TAG_SHAPE,
} from "../lib/entry-labels";
import { categoryRows } from "../lib/my-hours-summary";
import { CategoryNoteText } from "./CategoryNoteText";

/**
 * The widths of the Figma for Categoria (180) and Horas (110); Pendentes has a fixed width too, and
 * Observação takes the rest.
 */
const CATEGORY_WIDTHS = { category: "w-[22%]", hours: "w-[14%]", pending: "w-[16%]" } as const;

/**
 * "Horas por categoria" of "Meu perfil", for the current month (the month of the machine of the
 * person, from its first to its last day, shown next to the title): one row per category with
 * entries in the month, or with an observation of the coordination, the most hours first. Horas is
 * what counts (validated plus waiting for validation); Pendentes is a yellow tag with the hours
 * waiting, read in words by a screen reader, or a dash read as "Sem pendência". Observação is the
 * text the coordination wrote on the category, only to be read (the member gets no notification of
 * it), or a dash read as "Sem observação". The observation is not tied to the month, so a category
 * with one and no entry in the month stays, with 0h (GUS-191, D2).
 *
 * Only for who manages her own account (`account.manageOwn`): without it nothing is drawn and nothing
 * is asked. Loading, failure and an empty month have their own states; the summary leaves the cache
 * when the card unmounts (`gcTime: 0`).
 */
export function MyCategoryHoursCard(): ReactElement | null {
  const { t, i18n } = useTranslation("hours");
  const canView = useCan("account.manageOwn");
  const period = monthPeriod();
  const query = useGetMyHoursSummary(
    { from: period.from, to: period.to },
    { query: { enabled: canView, gcTime: 0 } },
  );

  if (!canView) return null;

  const month = formatMonthYear(period.month, i18n.language);

  /**
   * Text for screen readers, in words: "8 horas pendentes" or, with broken minutes, "1 hora e 30
   * minutos pendentes".
   */
  const pendingLabel = (minutes: number) => {
    const total = Math.round(minutes);
    const hours = Math.trunc(total / 60);
    const rest = total % 60;

    if (rest === 0) return t("entries.byCategory.pendingLabel.hours", { count: hours });
    if (hours === 0) return t("entries.byCategory.pendingLabel.minutes", { count: rest });
    return t("entries.byCategory.pendingLabel.hoursAndMinutes", {
      hours: t("entries.byCategory.pendingLabel.hourPart", { count: hours }),
      minutes: t("entries.byCategory.pendingLabel.minutePart", { count: rest }),
    });
  };

  function renderContent(): ReactElement {
    if (query.isPending) {
      return (
        <div role="status" className="flex flex-col gap-3">
          <p className="sr-only">{t("entries.byCategory.loading")}</p>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      );
    }

    // A failed re-read with the summary in the cache keeps the table.
    if (query.data === undefined) {
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

    const rows = categoryRows(query.data);
    if (rows.length === 0) {
      return <p className="text-base text-muted">{t("entries.byCategory.empty", { month })}</p>;
    }

    return (
      <DataTable
        caption={t("entries.byCategory.title")}
        rows={rows}
        rowKey={(row) => row.category}
        columns={[
          {
            header: t("entries.byCategory.columns.category"),
            headerClassName: `uppercase ${CATEGORY_WIDTHS.category}`,
            render: (row) => t(ENTRY_CATEGORY_LABEL_KEYS[row.category]),
          },
          {
            header: t("entries.byCategory.columns.hours"),
            headerClassName: `uppercase ${CATEGORY_WIDTHS.hours}`,
            cellClassName: "whitespace-nowrap",
            render: (row) => formatHours(row.hoursMinutes),
          },
          {
            header: t("entries.byCategory.columns.pending"),
            headerClassName: `uppercase ${CATEGORY_WIDTHS.pending}`,
            render: (row) =>
              Math.round(row.pendingMinutes) > 0 ? (
                <span className={`${ENTRY_TAG_SHAPE} ${ENTRY_STATUS_TAG_CLASSES.pending}`}>
                  <span aria-hidden="true">{formatHours(row.pendingMinutes)}</span>
                  <span className="sr-only">{pendingLabel(row.pendingMinutes)}</span>
                </span>
              ) : (
                <span className="text-muted">
                  <span aria-hidden="true">{t("details.empty", { ns: "common" })}</span>
                  <span className="sr-only">{t("entries.byCategory.noPending")}</span>
                </span>
              ),
          },
          {
            header: t("entries.byCategory.columns.note"),
            headerClassName: "uppercase",
            render: (row) => <CategoryNoteText note={row.note} />,
          },
        ]}
      />
    );
  }

  return (
    <Card title={t("entries.byCategory.title")} aside={<p className="text-muted">{month}</p>}>
      {renderContent()}
    </Card>
  );
}
