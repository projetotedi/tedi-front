import { useTranslation } from "react-i18next";

import { DataTable } from "@shared/components/DataTable";
import { formatHours } from "@shared/lib/format";
import { Badge, Card } from "@shared/ui";

import { formatDayMonth } from "../lib/format";
import type { HoursEntry } from "../lib/hours";
import { ENTRY_STATUS_COLOR } from "../lib/status-colors";

interface EntriesCardProps {
  /**
   * `null` while there is no hours bank: the card shows an empty state. An empty list is
   * different: the bank exists and the person has no entries yet.
   */
  entries: HoursEntry[] | null;
}

/** Últimos lançamentos. O link "Ver extrato completo" abre um modal que fica fora da GUS-86. */
export function EntriesCard({ entries }: EntriesCardProps) {
  const { t, i18n } = useTranslation("people");
  const duration = (value: number | null) =>
    value === null ? t("profile.empty") : formatHours(value);

  if (entries === null) {
    return (
      <Card title={t("profile.entries.title")}>
        <p className="text-base text-muted">{t("profile.hoursUnavailable")}</p>
      </Card>
    );
  }

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
              render: (entry) => duration(entry.declaredMinutes),
            },
            {
              header: t("profile.entries.columns.validated"),
              render: (entry) => duration(entry.validatedMinutes),
            },
            {
              header: t("profile.entries.columns.status"),
              render: (entry) => (
                <Badge tone={ENTRY_STATUS_COLOR[entry.status]}>
                  {t(`profile.entryStatus.${entry.status}`)}
                </Badge>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}
