import { useTranslation } from "react-i18next";

import { DataTable } from "@shared/components/DataTable";
import { formatHours } from "@shared/lib/format";
import { Card, Chip } from "@shared/ui";

import { formatMonthYear } from "../lib/format";
import type { CategoryHours } from "../mocks/profile.mock";

interface CategoryHoursCardProps {
  period: string;
  rows: CategoryHours[];
}

export function CategoryHoursCard({ period, rows }: CategoryHoursCardProps) {
  const { t, i18n } = useTranslation("people");

  /**
   * Texto para leitor de tela, por extenso: "8 horas pendentes" ou, com minutos quebrados,
   * "1 hora e 30 minutos pendentes".
   */
  const pendingLabel = (minutes: number) => {
    const total = Math.round(minutes);
    const hours = Math.trunc(total / 60);
    const rest = total % 60;

    if (rest === 0) return t("profile.byCategory.pendingLabel.hours", { count: hours });
    if (hours === 0) return t("profile.byCategory.pendingLabel.minutes", { count: rest });
    return t("profile.byCategory.pendingLabel.hoursAndMinutes", {
      hours: t("profile.byCategory.pendingLabel.hourPart", { count: hours }),
      minutes: t("profile.byCategory.pendingLabel.minutePart", { count: rest }),
    });
  };

  return (
    <Card
      title={t("profile.byCategory.title")}
      aside={<p className="text-muted">{formatMonthYear(period, i18n.language)}</p>}
    >
      <DataTable
        caption={t("profile.byCategory.title")}
        rows={rows}
        rowKey={(row) => row.category}
        columns={[
          {
            header: t("profile.byCategory.columns.category"),
            render: (row) => t(`profile.categories.${row.category}`),
          },
          {
            header: t("profile.byCategory.columns.hours"),
            render: (row) => formatHours(row.totalMinutes),
          },
          {
            header: t("profile.byCategory.columns.pending"),
            render: (row) =>
              Math.round(row.pendingMinutes) > 0 ? (
                <Chip color="warning">
                  <span aria-hidden="true">{formatHours(row.pendingMinutes)}</span>
                  <span className="sr-only">{pendingLabel(row.pendingMinutes)}</span>
                </Chip>
              ) : (
                <span className="text-muted">
                  <span aria-hidden="true">{t("profile.empty")}</span>
                  <span className="sr-only">{t("profile.byCategory.noPending")}</span>
                </span>
              ),
          },
          { header: t("profile.byCategory.columns.note"), render: (row) => row.note },
        ]}
      />
    </Card>
  );
}
