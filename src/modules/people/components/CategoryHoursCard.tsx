import { useTranslation } from "react-i18next";

import { DataTable } from "@shared/components/DataTable";
import { Card, Chip } from "@shared/ui";

import { formatMonthYear } from "../lib/format";
import { CATEGORY_STATUS_COLOR } from "../lib/status-colors";
import type { CategoryHours } from "../mocks/profile.mock";

interface CategoryHoursCardProps {
  period: string;
  rows: CategoryHours[];
}

export function CategoryHoursCard({ period, rows }: CategoryHoursCardProps) {
  const { t, i18n } = useTranslation("people");

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
            render: (row) => t("profile.summary.hours", { count: row.hours }),
          },
          {
            header: t("profile.byCategory.columns.status"),
            render: (row) => (
              <Chip color={CATEGORY_STATUS_COLOR[row.status]}>
                {t(`profile.categoryStatus.${row.status}`)}
              </Chip>
            ),
          },
          { header: t("profile.byCategory.columns.note"), render: (row) => row.note },
        ]}
      />
    </Card>
  );
}
