import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

export interface CategoryNoteTextProps {
  /** The observation of the coordination on the category, or `null` when there is none. */
  note: string | null;
}

/**
 * The cell OBSERVAÇÃO of the tables of hours by category (the member's own, in "Meu perfil", and the
 * one of the coordination, in the bank): the text as it was written, with its line breaks (it takes
 * up to 500 characters and accepts new lines), or a dash, which a screen reader reads as "Sem
 * observação" (the same drawing of the dash of `PendingHours`).
 */
export function CategoryNoteText({ note }: CategoryNoteTextProps): ReactElement {
  const { t } = useTranslation("hours");

  if (note !== null) return <span className="break-words whitespace-pre-line">{note}</span>;

  return (
    <span className="text-muted">
      <span aria-hidden="true">{t("common:details.empty")}</span>
      <span className="sr-only">{t("categoryNote.none")}</span>
    </span>
  );
}
