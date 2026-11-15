import { useTranslation } from "react-i18next";

import { formatHours } from "@shared/lib/format";
import { Badge, Card, type BadgeProps } from "@shared/ui";

import type { HoursSummaryMinutes } from "../lib/hours";

interface HoursSummaryProps {
  /** `null` while there is no hours bank: the card shows an empty state instead of numbers. */
  minutes: HoursSummaryMinutes | null;
}

interface Indicator {
  key: keyof HoursSummaryMinutes;
  badge?: { label: string; color: BadgeProps["tone"] };
}

const INDICATORS: Indicator[] = [
  { key: "total" },
  { key: "validated", badge: { label: "validated", color: "success" } },
  { key: "pending", badge: { label: "pending", color: "warning" } },
  { key: "adjustedOrRejected", badge: { label: "review", color: "danger" } },
];

/** Os quatro indicadores de horas do topo do perfil. */
export function HoursSummary({ minutes }: HoursSummaryProps) {
  const { t } = useTranslation("people");

  if (minutes === null) {
    return (
      <section aria-label={t("profile.summary.title")}>
        <Card>
          <p className="text-base text-muted">{t("profile.hoursUnavailable")}</p>
        </Card>
      </section>
    );
  }

  return (
    <section aria-label={t("profile.summary.title")}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {INDICATORS.map(({ key, badge }) => (
          <li key={key}>
            <Card className="h-full">
              <p className="text-muted">{t(`profile.summary.${key}`)}</p>
              <p className="mt-1 text-3xl font-semibold">{formatHours(minutes[key])}</p>
              {badge && (
                <div className="mt-2">
                  <Badge tone={badge.color}>{t(`profile.summary.badges.${badge.label}`)}</Badge>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
