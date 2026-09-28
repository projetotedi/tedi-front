import { useTranslation } from "react-i18next";

import { DataTable } from "@shared/components/DataTable";
import { Card, Chip } from "@shared/ui";

import { formatDayMonth } from "../lib/format";
import { ENTRY_STATUS_COLOR } from "../lib/status-colors";
import type { HoursEntry } from "../mocks/profile.mock";

interface EntriesCardProps {
  entries: HoursEntry[];
}

/** Últimos lançamentos. O link "Ver extrato completo" abre um modal que fica fora da GUS-86. */
export function EntriesCard({ entries }: EntriesCardProps) {
  const { t, i18n } = useTranslation("people");
  const minutes = (value: number | null) =>
    value === null ? t("profile.empty") : t("profile.entries.minutes", { count: value });

  return (
    <Card title={t("profile.entries.title")}>
      {entries.length === 0 ? (
        <p>{t("profile.entries.empty")}</p>
      ) : (
        <DataTable
          caption={t("profile.entries.title")}
          rows={entries}
          rowKey={(entry) => entry.id}
          columns={[
            {
              header: t("profile.entries.columns.date"),
              render: (entry) => formatDayMonth(entry.date, i18n.language),
            },
            { header: t("profile.entries.columns.activity"), render: (entry) => entry.activity },
            {
              header: t("profile.entries.columns.category"),
              render: (entry) => t(`profile.categories.${entry.category}`),
            },
            {
              header: t("profile.entries.columns.declared"),
              render: (entry) => minutes(entry.declaredMinutes),
            },
            {
              header: t("profile.entries.columns.validated"),
              render: (entry) => minutes(entry.validatedMinutes),
            },
            {
              header: t("profile.entries.columns.status"),
              render: (entry) => (
                <Chip color={ENTRY_STATUS_COLOR[entry.status]}>
                  {t(`profile.entryStatus.${entry.status}`)}
                </Chip>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}
