import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { formatHours } from "@shared/lib/format";
import { Badge } from "@shared/ui";

export interface PendingHoursProps {
  minutes: number;
}

/**
 * The cell PENDENTES of the tables of the bank: the pending hours as a yellow tag, or a dash when
 * there are none, which a screen reader reads as "Sem pendência" (the name of the layer in the Figma).
 */
export function PendingHours({ minutes }: PendingHoursProps): ReactElement {
  const { t } = useTranslation("hours");

  if (minutes > 0) return <Badge tone="warning">{formatHours(minutes)}</Badge>;

  return (
    <span className="text-muted">
      <span aria-hidden="true">{t("common:details.empty")}</span>
      <span className="sr-only">{t("bank.members.noPending")}</span>
    </span>
  );
}
