import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { HourEntryOrigin, type HourEntryResponseDto } from "@api/generated/model";
import { Badge } from "@shared/ui";

export interface EntryLinkNoteProps {
  entry: Pick<HourEntryResponseDto, "origin" | "classId" | "lessonId" | "lessonCancelled">;
}

/**
 * What goes under the activity of an entry about its link (GUS-174). A lesson cancelled after the
 * entry was logged gets the tag "Aula cancelada": the entry is not reversed, and the coordination
 * decides in the review (PO, GUS-172). Otherwise a logged entry says whether it is linked to a lesson
 * or only to a class. An hour of the attendance is always of its lesson, so it says nothing.
 */
export function EntryLinkNote({ entry }: EntryLinkNoteProps): ReactElement | null {
  const { t } = useTranslation("hours");

  if (entry.lessonCancelled) {
    return (
      <span className="mt-1 block">
        <Badge tone="danger">{t("entries.link.lessonCancelled")}</Badge>
      </span>
    );
  }
  if (entry.origin === HourEntryOrigin.attendance) return null;
  if (entry.lessonId !== null) {
    return <span className="mt-0.5 block text-sm text-muted">{t("entries.link.lesson")}</span>;
  }
  if (entry.classId !== null) {
    return <span className="mt-0.5 block text-sm text-muted">{t("entries.link.class")}</span>;
  }
  return null;
}
