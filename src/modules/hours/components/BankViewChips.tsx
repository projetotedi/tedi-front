import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import xmarkIcon from "@shared/assets/icons/xmark.svg";
import { Button } from "@shared/ui";

export interface BankViewChipsProps {
  /** Whether a member is open (`?member=`). */
  isMemberView: boolean;
  /** The name of the open member, once the API sent it. */
  memberName?: string;
  /** Back to the view of everyone, by "Todos". */
  onShowAll: () => void;
  /** Back to the view of everyone, by the × of the chip of the member. */
  onClearMember: () => void;
}

/**
 * The filter Visão: which view of the bank is on the screen, as a group of chips. "Todos" is the
 * pressed one in the view of everyone; with a member open it turns white with a border, and the
 * chip of the member, blue, closes with its ×.
 */
export function BankViewChips({
  isMemberView,
  memberName,
  onShowAll,
  onClearMember,
}: BankViewChipsProps): ReactElement {
  const { t } = useTranslation("hours");
  const labelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-base font-medium text-foreground">
        {t("bank.filters.view")}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
        {isMemberView ? (
          <Button
            variant="outline"
            aria-pressed={false}
            onPress={onShowAll}
            className="border-[var(--field-border)] bg-surface px-3.5 text-foreground"
          >
            {t("bank.filters.all")}
          </Button>
        ) : (
          <Button variant="primary" aria-pressed className="px-3.5">
            {t("bank.filters.all")}
          </Button>
        )}
        {isMemberView && memberName !== undefined ? (
          <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent pl-3.5 text-base font-medium text-accent-foreground">
            {memberName}
            <Button
              variant="primary"
              isIconOnly
              aria-label={t("bank.filters.clearMember")}
              onPress={onClearMember}
              className="-ml-1.5 rounded-full"
            >
              <img src={xmarkIcon} alt="" aria-hidden="true" width={14} height={14} />
            </Button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
