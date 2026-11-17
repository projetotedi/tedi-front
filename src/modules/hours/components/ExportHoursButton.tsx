import { useMutation } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { exportHours } from "@api/generated/hours/hours";
import { HoursExportFormat, type ExportHoursParams } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { saveFile } from "@shared/lib/save-file";
import { Button, toast } from "@shared/ui";

import { periodRange } from "../lib/bank-period";

export interface ExportHoursButtonProps {
  /** The month on the screen, `YYYY-MM`. */
  period: string;
  /** What the report covers: what the view shows, or everyone (the view of one member: the API does not filter by member). */
  scope: "view" | "allMembers";
}

/**
 * "Exportar relatório": the CSV of the period (`GET /hours/export`), saved with the name the API
 * gives it. It is an action on demand, so the generated function runs in a mutation: the generated
 * hook is a query, which would ask on mount and keep the file in the cache. Only with `hours.export`.
 */
export function ExportHoursButton({ period, scope }: ExportHoursButtonProps): ReactElement | null {
  const { t } = useTranslation("hours");
  const canExport = useCan("hours.export");
  const exportFile = useMutation({
    mutationFn: (params: ExportHoursParams) => exportHours(params),
  });

  if (!canExport) return null;

  function onPress() {
    const { from, to } = periodRange(period);
    exportFile.mutate(
      { from, to, format: HoursExportFormat.csv },
      {
        onSuccess: (file) =>
          saveFile(
            file,
            file instanceof File && file.name !== ""
              ? file.name
              : t("bank.exportFileName", { period }),
          ),
        onError: () => {
          toast.error(t("bank.exportError"));
        },
      },
    );
  }

  return (
    <Button variant="secondary" isLoading={exportFile.isPending} onPress={onPress}>
      {scope === "allMembers" ? t("bank.exportAll") : t("bank.export")}
    </Button>
  );
}
