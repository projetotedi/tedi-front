import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { formatHours } from "@shared/lib/format";
import { Button } from "@shared/ui";

export interface ReviewSelectionBarProps {
  selectedCount: number;
  /** How many entries of the page can be selected. */
  total: number;
  /** The declared minutes of the selected entries. */
  minutes: number;
  /** A validation is on its way. */
  isBusy: boolean;
  /** The selected entries are the ones on their way. */
  isValidating: boolean;
  onClear: () => void;
  onValidate: () => void;
}

/**
 * The bar of the batch, right of the title of the queue: "2 de 3 selecionados · 8h", Limpar seleção
 * and Validar selecionados (N). The count is announced to assistive technology as it changes. The
 * batch only validates: adjusting and rejecting are one by one (Figma).
 */
export function ReviewSelectionBar({
  selectedCount,
  total,
  minutes,
  isBusy,
  isValidating,
  onClear,
  onValidate,
}: ReviewSelectionBarProps): ReactElement {
  const { t } = useTranslation("hours");

  return (
    <div className="flex min-h-11 flex-1 flex-wrap items-center justify-between gap-2 rounded-[10px] bg-tedi-surface-subtle py-1.5 pr-1.5 pl-3.5 sm:ml-2">
      <p aria-live="polite" className="text-sm text-muted">
        {t("review.selection", { selected: selectedCount, total, hours: formatHours(minutes) })}
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
