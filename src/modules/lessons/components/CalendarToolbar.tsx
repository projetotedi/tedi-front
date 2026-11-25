import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@shared/ui";

import { CALENDAR_VIEWS, type CalendarView } from "../lib/calendar-period";

export interface CalendarToolbarProps {
  view: CalendarView;
  /** The period on the screen, written out ("março de 2026"). */
  title: string;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

/**
 * The bar of the calendar: ‹ and › to go to the period before and after (a month, or a week in the
 * week), Hoje, the period on the screen, and the choice of the view (Lista, Mês and Semana), a
 * group of buttons that say which one is on by `aria-pressed`. The arrows are named by what they
 * do in the view that is open ("Mês anterior", "Próxima semana"), and the title is a polite live
 * region, so a screen reader says the new period when it changes. The legend "Monitores abaixo do
 * esperado" stays below, as text: the events are not marked yet, since the API only says it for
 * lessons that have an allocation (GUS-158).
 */
export function CalendarToolbar({
  view,
  title,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
}: CalendarToolbarProps): ReactElement {
  const { t } = useTranslation("lessons");
  const isWeek = view === "week";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            isIconOnly
            aria-label={t(isWeek ? "calendar.previousWeek" : "calendar.previousMonth")}
            onPress={onPrevious}
          >
            <span aria-hidden="true">‹</span>
          </Button>
          <Button
            variant="secondary"
            isIconOnly
            aria-label={t(isWeek ? "calendar.nextWeek" : "calendar.nextMonth")}
            onPress={onNext}
          >
            <span aria-hidden="true">›</span>
          </Button>
          <Button variant="secondary" onPress={onToday}>
            {t("calendar.today")}
          </Button>
          <p aria-live="polite" className="ms-1 text-lg font-semibold first-letter:uppercase">
            {title}
          </p>
        </div>
        <div role="group" aria-label={t("calendar.views.label")} className="flex gap-2">
          {CALENDAR_VIEWS.map((option) => (
            <Button
              key={option}
              variant={option === view ? "primary" : "secondary"}
              aria-pressed={option === view}
              onPress={() => onViewChange(option)}
            >
              {t(`calendar.views.${option}`)}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted">{t("calendar.legend.belowExpectedMonitors")}</p>
    </div>
  );
}
