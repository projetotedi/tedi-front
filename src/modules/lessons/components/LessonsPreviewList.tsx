import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { ClassLessonsPreviewResponseDto } from "@api/generated/model";
import { formatCalendarDate, formatHours } from "@shared/lib/format";

export interface LessonsPreviewListProps {
  preview: ClassLessonsPreviewResponseDto;
  /** The list is the last one, kept while the next is on its way: a screen reader is told it is changing. */
  isBusy: boolean;
}

/**
 * The dates the lessons would have, one row per lesson in the order of the plan: its number in the
 * series, the day, the title it would copy and how long the plan expects it to last. The number is
 * the place in the list (`index + 1`), not the `sequenceOrder` of the plan, which skips a number
 * when an archived plan is left out. The duration is the one of the plan (`expectedDurationMinutes`),
 * and may differ from the start and the end typed above: the lessons themselves get the typed time.
 *
 * A lesson outside the period of the class has the warning color and says it in words, so it is
 * not only a color. The text of the number and of the day is read by a screen reader as "Aula 1",
 * and the square with the number is for who sees. The auxiliary text uses the dark neutral and not
 * `text-muted`: on these backgrounds `text-muted` is 4,2:1 (4,3:1 on the warning), under 4,5:1.
 */
export function LessonsPreviewList({ preview, isBusy }: LessonsPreviewListProps): ReactElement {
  const { t, i18n } = useTranslation("lessons");

  return (
    <ol
      aria-label={t("generate.preview.listLabel")}
      aria-busy={isBusy}
      className="flex flex-col gap-2"
    >
      {preview.items.map((item, index) => {
        const number = index + 1;
        const isOutside = item.outsideClassPeriod;

        return (
          <li
            key={item.lessonPlanId}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] px-3 py-2.5 ${
              isOutside ? "bg-tedi-warning" : "bg-surface-secondary"
            }`}
          >
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-md border border-border-secondary bg-surface text-sm font-medium"
            >
              {number}
            </span>
            <span className="sr-only">{t("generate.preview.lessonNumber", { number })}</span>
            <span
              className={`w-28 shrink-0 text-base font-medium ${
                isOutside ? "text-tedi-warning-foreground" : ""
              }`}
            >
              {formatCalendarDate(item.date, i18n.language)}
            </span>
            <span className="min-w-0 flex-1 text-base break-words">{item.title}</span>
            {isOutside ? (
              <span className="text-sm font-semibold text-tedi-warning-foreground">
                {t("generate.preview.outsidePeriod")}
              </span>
            ) : null}
            <span
              className={`text-sm ${
                isOutside ? "text-tedi-warning-foreground" : "text-tedi-neutral-foreground"
              }`}
            >
              {formatHours(item.expectedDurationMinutes)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
