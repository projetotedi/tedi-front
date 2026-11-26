import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@shared/ui";

import { RollCallStatus } from "../lib/roll-call";

export interface AttendanceStatusTagProps {
  status: RollCallStatus | null;
  isJustified?: boolean;
}

/** The signed status of a row, or "A validar" while it is not signed. */
export function AttendanceStatusTag({
  status,
  isJustified = false,
}: AttendanceStatusTagProps): ReactElement {
  const { t } = useTranslation("attendance");

  if (status === null) return <Badge tone="neutral">{t("status.pending")}</Badge>;

  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={status === RollCallStatus.present ? "success" : "danger"}>
        {t(`status.${status}`)}
      </Badge>
      {isJustified ? <Badge tone="info">{t("status.justified")}</Badge> : null}
    </span>
  );
}
