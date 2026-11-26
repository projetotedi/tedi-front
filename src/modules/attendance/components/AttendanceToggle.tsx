import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@shared/ui";

import { RollCallStatus } from "../lib/roll-call";

export interface AttendanceToggleProps {
  name: string;
  value: RollCallStatus | null;
  onChange: (value: RollCallStatus | null) => void;
  isDisabled?: boolean;
  isFullWidth?: boolean;
}

/** The three-state attendance control: pressing the active status takes the row back to pending. */
export function AttendanceToggle({
  name,
  value,
  onChange,
  isDisabled = false,
  isFullWidth = false,
}: AttendanceToggleProps): ReactElement {
  const { t } = useTranslation("attendance");
  const isPresent = value === RollCallStatus.present;
  const isAbsent = value === RollCallStatus.absent;
  const width = isFullWidth ? "flex-1" : "px-3.5";

  return (
    <div role="group" aria-label={t("toggle.label", { name })} className="flex gap-2">
      <Button
        variant={isPresent ? "primary" : "secondary"}
        aria-pressed={isPresent}
        isDisabled={isDisabled}
        className={`${width} ${isPresent ? "" : "bg-tedi-badge-success text-tedi-badge-success-foreground"}`}
        onPress={() => onChange(isPresent ? null : RollCallStatus.present)}
      >
        {t("status.present")}
      </Button>
      <Button
        variant={isAbsent ? "danger" : "danger-soft"}
        aria-pressed={isAbsent}
        isDisabled={isDisabled}
        className={width}
        onPress={() => onChange(isAbsent ? null : RollCallStatus.absent)}
      >
        {t("status.absent")}
      </Button>
    </div>
  );
}
