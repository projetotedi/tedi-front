import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@shared/ui";

export interface ReviewSelectionBarProps {
  selectedCount: number;
  /** "2 de 3 selecionados · 8h". */
  summary: string;
  /** A validation is on its way. */
  isBusy: boolean;
  /** The batch is the validation on its way (its spinner). */
  isValidating: boolean;
  onClear: () => void;
  onValidate: () => void;
}

/**
 * The bar of the batch, right of the title of the queue: "2 de 3 selecionados · 8h", Limpar seleção
 * and Validar selecionados (N). The batch only validates: adjusting and rejecting are one by one
 * (Figma). The count is announced by the queue, in a live region that is always on the page (one
 * that is born with its text is not read): here it is only drawn.
 */
export function ReviewSelectionBar({
  selectedCount,
  summary,
  isBusy,
  isValidating,
  onClear,
  onValidate,
}: ReviewSelectionBarProps): ReactElement {
  const { t } = useTranslation("hours");

  return (
    <div className="flex min-h-11 flex-1 flex-wrap items-center justify-between gap-2 rounded-[10px] bg-tedi-surface-subtle py-1.5 pr-1.5 pl-3.5 sm:ml-2">
      <p aria-hidden="true" className="text-sm text-muted">
        {summary}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" isDisabled={isBusy} onPress={onClear}>
          {t("review.clearSelection")}
        </Button>
        <Button
          variant="primary"
          isLoading={isValidating}
          isDisabled={isBusy && !isValidating}
          onPress={onValidate}
        >
          {t("review.validateSelected", { count: selectedCount })}
        </Button>
      </div>
    </div>
  );
}
