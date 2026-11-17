import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { HourEntryStatus } from "@api/generated/model";

import {
  ENTRY_STATUS_LABEL_KEYS,
  ENTRY_STATUS_TAG_CLASSES,
  ENTRY_TAG_SHAPE,
} from "../lib/entry-labels";

export interface EntryStatusTagProps {
  status: HourEntryStatus;
}

/** The status of an entry as a pill with its word: Aprovado, Ajustado, Pendente or Rejeitado. */
export function EntryStatusTag({ status }: EntryStatusTagProps): ReactElement {
  const { t } = useTranslation("hours");

  return (
    <span className={`${ENTRY_TAG_SHAPE} ${ENTRY_STATUS_TAG_CLASSES[status]}`}>
      {t(ENTRY_STATUS_LABEL_KEYS[status])}
    </span>
  );
}
