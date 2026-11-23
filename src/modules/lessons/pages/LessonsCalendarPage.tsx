import { keepPreviousData } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useListLessonsCalendar } from "@api/generated/lessons/lessons";
import { ListState } from "@shared/components/ListState";
import { Button, Card } from "@shared/ui";

import { CalendarAgenda } from "../components/CalendarAgenda";
import { CalendarToolbar } from "../components/CalendarToolbar";
import { LessonFilters } from "../components/LessonFilters";
import { MonthGrid } from "../components/MonthGrid";
import { WeekGrid } from "../components/WeekGrid";
import { useLessonFilterOptions } from "../hooks/useLessonFilterOptions";
import {
  anchorForView,
  calendarRange,
  formatPeriodTitle,
  monthDays,
  readAnchorDate,
  readCalendarView,
  shiftAnchor,
  todayIso,
  type CalendarView,
} from "../lib/calendar-period";
import {
  CALENDAR_FILTER_KEYS,
  hasActiveLessonFilters,
  readLessonFilters,
  toListLessonsCalendarParams,
  withLessonFilters,
  withoutLessonFilters,
} from "../lib/lesson-filters";

/**
 * Calendário (RF-030, RF-043, F3.4, GUS-155): the lessons of every class by period, from
 * `listLessonsCalendar`, as an agenda of the month (Lista), the grid of the month (Mês) or a week
 * (Semana), with ‹ and › to go to the period before and after and Hoje to come back. The view, the
 * day that says which period (`date`) and the filters Turma, Curso, Status and Plano de aula are all
 * in the URL, so a link or a reload brings the same period back; changing the view or the period
 * is a new place in the history, and so Voltar goes back to the one before.
 *
 * One request for each period, and only for the calendar: the agenda and the month ask for the
 * same 42 days (they are the same query, so going from one to the other asks for nothing), going to
 * another month asks once, and no neighbor month is read ahead. The grid that was on the screen stays
 * (`aria-busy`) while the next period comes. A period with no lesson shows the empty grid and says
 * so, with "Limpar filtros" when a filter is on; while there is nothing to show yet it loads, and if
 * the request fails with nothing to show it says so with "Tentar de novo".
 *
 * Every lesson, in every view, is a link to its screen. The month sends the days with more events
 * than it fits (+N mais) to the week of that day.
 */
export function LessonsCalendarPage(): ReactElement {
  const { t, i18n } = useTranslation("lessons");
  const locale = i18n.language;
  const [params, setParams] = useSearchParams();
  const filters = readLessonFilters(params);
  const view = readCalendarView(params);
  const today = todayIso();
  const anchor = readAnchorDate(params, today);
  const range = calendarRange(view, anchor, locale);
  const options = useLessonFilterOptions({ courses: true });

  const query = useListLessonsCalendar(toListLessonsCalendarParams(filters, range), {
    query: { placeholderData: keepPreviousData },
  });
  const lessons = query.data ?? [];

  // The agenda draws the days of the month, and the 42 days it asked for hold some of the next and
  // the previous one: those lessons are not its.
  const shownLessons =
    view === "list"
      ? lessons.filter((lesson) => lesson.date.startsWith(anchor.slice(0, 7)))
      : lessons;
  const hasActiveFilters = hasActiveLessonFilters(filters, CALENDAR_FILTER_KEYS);

  // Asking again after an error with nothing to show makes the query "pending" again: the error
  // panel stays, with its button loading, so the button is not unmounted and the focus is not lost.
  const isRetrying = query.isPending && query.isFetching && query.errorUpdateCount > 0;
  const isLoading = query.isPending && !isRetrying;
  const hasError = (query.isError && query.data === undefined) || isRetrying;
  // The grid of the period before, kept while the next one comes, is not "empty": it only has
  // the lessons the two periods share.
  const isEmptyPeriod = query.isSuccess && !query.isPlaceholderData && shownLessons.length === 0;

  function goTo(nextView: CalendarView, nextAnchor: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("view", nextView);
      next.set("date", anchorForView(nextView, nextAnchor, locale));
      return next;
    });
  }

  function clearFilters() {
    setParams((current) => withoutLessonFilters(current), { replace: true });
  }

  function renderPeriod(): ReactElement {
    if (view === "week") return <WeekGrid anchor={anchor} today={today} lessons={lessons} />;
    if (view === "list") {
      return <CalendarAgenda days={monthDays(anchor)} lessons={shownLessons} />;
    }
    return (
      <MonthGrid
        anchor={anchor}
        today={today}
        lessons={lessons}
        onShowDay={(day) => goTo("week", day)}
      />
    );
  }

  function renderBody(): ReactElement {
    if (isLoading) return <ListState variant="loading" title={t("calendar.loading")} />;

    if (hasError) {
      return (
        <ListState
          variant="error"
          title={t("calendar.error")}
          description={t("calendar.errorDescription")}
          action={{
            label: t("retry"),
            onPress: () => void query.refetch(),
            isLoading: query.isFetching,
          }}
        />
      );
    }

    return (
      <div aria-busy={query.isPlaceholderData} className="flex flex-col gap-3">
        {isEmptyPeriod ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-base text-muted">{t("calendar.emptyPeriod")}</p>
            {hasActiveFilters ? (
              <Button variant="secondary" onPress={clearFilters}>
                {t("list.clearFilters")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {renderPeriod()}
      </div>
    );
  }

  return (
    <Card title={<span id="lessons-calendar-title">{t("calendar.title")}</span>}>
      <section aria-labelledby="lessons-calendar-title" className="flex flex-col gap-3">
        <LessonFilters
          fields={["classId", "courseId", "status", "lessonPlanId"]}
          filters={filters}
          options={options}
          onFilterChange={(key, value) =>
            setParams((current) => withLessonFilters(current, { [key]: value }))
          }
        />
        <hr className="border-tedi-divider" />
        <CalendarToolbar
          view={view}
          title={formatPeriodTitle(view, anchor, locale)}
          onViewChange={(nextView) => goTo(nextView, anchor)}
          onPrevious={() => goTo(view, shiftAnchor(view, anchor, -1))}
          onNext={() => goTo(view, shiftAnchor(view, anchor, 1))}
          onToday={() => goTo(view, today)}
        />
        {renderBody()}
      </section>
    </Card>
  );
}
