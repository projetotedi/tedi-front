import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { MemberHourEntryResponseDto } from "@api/generated/model";
import { Button } from "@shared/ui";

import { formatEntryDay } from "../lib/bank-format";

export interface ReviewRowActionsProps {
  entry: MemberHourEntryResponseDto;
  /** The entry is the person's own: she cannot review it. */
  isOwn: boolean;
  /** A validation is on its way: nothing else is sent until it settles. */
  isBusy: boolean;
  /** This row is the one being validated alone (its spinner). */
  isValidating: boolean;
  onValidate: () => void;
}

/**
 * The actions of a pending entry, for who reviews: Validar. On the person's own entry it is turned
 * off, and the row says why to assistive technology.
 */
export function ReviewRowActions({
  entry,
  isOwn,
  isBusy,
  isValidating,
  onValidate,
}: ReviewRowActionsProps): ReactElement {
  const { t, i18n } = useTranslation("hours");
  const labels = {
    name: entry.member?.name ?? t("bank.members.removed"),
    date: formatEntryDay(entry.date, i18n.language),
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="primary"
        aria-label={t("review.validateLabel", labels)}
        isLoading={isValidating}
        isDisabled={isOwn || (isBusy && !isValidating)}
        onPress={onValidate}
      >
        {t("review.validate")}
      </Button>
      {isOwn ? <span className="sr-only">{t("review.selfReviewHint")}</span> : null}
    </div>
  );
}
