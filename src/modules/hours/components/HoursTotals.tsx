import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { HoursSummaryResponseDto } from "@api/generated/model";
import { formatHours } from "@shared/lib/format";
import { Skeleton } from "@shared/ui";

import { bankTotals, type BankTotals } from "../lib/bank-totals";

export interface HoursTotalsProps {
  summary: HoursSummaryResponseDto | undefined;
  isLoading: boolean;
}

interface TotalCard {
  key: keyof BankTotals;
  className: string;
  labelClassName: string;
}

// The colors of the Figma: neutral, green, yellow and red. The label says what each card is, so the
// color carries no information by itself.
const CARDS: readonly TotalCard[] = [
  { key: "declared", className: "bg-surface text-foreground", labelClassName: "text-muted" },
  {
    key: "validated",
    className: "bg-tedi-badge-success text-tedi-badge-success-foreground",
    labelClassName: "",
  },
  {
    key: "pending",
    className: "bg-tedi-warning text-tedi-status-warning-foreground",
    labelClassName: "",
  },
  {
    key: "adjustedOrRejected",
    className: "bg-tedi-status-danger text-tedi-status-danger-foreground",
    labelClassName: "",
  },
];

/**
 * The four totals of the period (lançadas, validadas, pendentes, ajustadas/rejeitadas), of everyone
 * or of one member. While the first answer is on its way the values are skeletons; without a summary
 * (the read failed) nothing is drawn, and the block below says what went wrong.
 */
export function HoursTotals({ summary, isLoading }: HoursTotalsProps): ReactElement | null {
  const { t } = useTranslation("hours");

  if (summary === undefined && !isLoading) return null;

  const totals = summary === undefined ? undefined : bankTotals(summary);

  return (
    <ul
      aria-label={t("bank.totals.label")}
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
    >
      {CARDS.map((card) => (
        <li
          key={card.key}
          className={`flex flex-col gap-2 rounded-[20px] p-4 shadow-tedi-card ${card.className}`}
        >
          <p className={`text-sm font-medium ${card.labelClassName}`.trim()}>
            {t(`bank.totals.${card.key}`)}
          </p>
          {totals === undefined ? (
            <Skeleton className="h-[34px] w-20" />
          ) : (
            <p className="text-[28px] leading-[34px] font-bold">{formatHours(totals[card.key])}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
