import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@shared/ui";

/**
 * The filter Visão: which view of the bank is on the screen, as a group of chips. "Todos" is the
 * one pressed.
 */
export function BankViewChips(): ReactElement {
  const { t } = useTranslation("hours");
  const labelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-base font-medium text-foreground">
        {t("bank.filters.view")}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
        <Button variant="primary" aria-pressed className="px-3.5">
          {t("bank.filters.all")}
        </Button>
      </div>
    </div>
  );
}
