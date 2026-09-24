import { useTranslation } from "react-i18next";

import { Card, Chip, type ChipProps } from "@shared/ui";

import type { ProfileMock } from "../mocks/profile.mock";

interface HoursSummaryProps {
  hours: ProfileMock["hours"];
}

interface Indicator {
  key: keyof ProfileMock["hours"];
  badge?: { label: string; color: NonNullable<ChipProps["color"]> };
}

const INDICATORS: Indicator[] = [
  { key: "total" },
  { key: "validated", badge: { label: "validated", color: "success" } },
  { key: "pending", badge: { label: "pending", color: "warning" } },
  { key: "adjustedOrRejected", badge: { label: "review", color: "danger" } },
];

/** Os quatro indicadores de horas do topo do perfil. */
export function HoursSummary({ hours }: HoursSummaryProps) {
  const { t } = useTranslation("people");

  return (
    <section aria-label={t("profile.summary.title")}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {INDICATORS.map(({ key, badge }) => (
          <li key={key}>
            <Card className="h-full">
              <p className="text-muted">{t(`profile.summary.${key}`)}</p>
              <p className="mt-1 text-3xl font-semibold">
                {t("profile.summary.hours", { count: hours[key] })}
              </p>
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
