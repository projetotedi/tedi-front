import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { MemberHourEntryResponseDto } from "@api/generated/model";
import { Button } from "@shared/ui";

import { formatEntryDay } from "../lib/bank-format";
import { memberNameOf } from "../lib/bank-labels";

export interface ReviewRowActionsProps {
  entry: MemberHourEntryResponseDto;
  /** The entry is the person's own: she cannot review it. */
  isOwn: boolean;
  /** A validation is on its way: nothing else is sent until it settles. */
  isBusy: boolean;
  /** This row is the one being validated alone (its spinner). */
  isValidating: boolean;
  onValidate: () => void;
  onAdjust: () => void;
  onReject: () => void;
}

/**
 * The actions of a pending entry, for who reviews, in the order of the Figma: Validar, Ajustar and
 * Rejeitar. On the person's own entry the three are turned off, and the row says why to assistive
 * technology. The history of an entry opens only from the toast of an adjustment ("Ver histórico").
 */
export function ReviewRowActions({
  entry,
  isOwn,
  isBusy,
  isValidating,
  onValidate,
  onAdjust,
  onReject,
}: ReviewRowActionsProps): ReactElement {
  const { t, i18n } = useTranslation("hours");
  const labels = {
    name: memberNameOf(entry, t),
    date: formatEntryDay(entry.date, i18n.language),
  };
  const isOff = isOwn || isBusy;

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
      <Button
        variant="secondary"
        aria-label={t("review.adjustLabel", labels)}
        isDisabled={isOff}
        onPress={onAdjust}
      >
        {t("review.adjust")}
      </Button>
      <Button
        variant="danger-soft"
        aria-label={t("review.rejectLabel", labels)}
        isDisabled={isOff}
        onPress={onReject}
      >
        {t("review.reject")}
      </Button>
      {isOwn ? <span className="sr-only">{t("review.selfReviewHint")}</span> : null}
    </div>
  );
}
