import { useTranslation } from "react-i18next";

import { formatHours } from "@shared/lib/format";
import { Card, Chip, type ChipProps } from "@shared/ui";

import type { ProfileMock } from "../mocks/profile.mock";

interface HoursSummaryProps {
  minutes: ProfileMock["summaryMinutes"];
}

interface Indicator {
  key: keyof ProfileMock["summaryMinutes"];
  badge?: { label: string; color: NonNullable<ChipProps["color"]> };
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
                  <Chip color={badge.color}>{t(`profile.summary.badges.${badge.label}`)}</Chip>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
