import { keepPreviousData } from "@tanstack/react-query";
import { useRef, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useListLessons } from "@api/generated/lessons/lessons";
import { useCan } from "@modules/auth";
import { ListState } from "@shared/components/ListState";
import { resolveListState } from "@shared/lib/list-state";
import { Button, Card, Pagination } from "@shared/ui";
import calendarIcon from "../../../assets/icons/calendar.svg";

import { LessonFilters } from "../components/LessonFilters";
import { LessonsTable } from "../components/LessonsTable";
import { NewLessonFlow } from "../components/NewLessonFlow";
import { useLessonFilterOptions } from "../hooks/useLessonFilterOptions";
import { useUrlSearch } from "../hooks/useUrlSearch";
import {
  hasActiveLessonFilters,
  LIST_FILTER_KEYS,
  readLessonFilters,
  toListLessonsParams,
  withLessonFilters,
  withoutLessonFilters,
} from "../lib/lesson-filters";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Aulas (RF-030, RF-043, F3.4, GUS-155): the lessons of every class, from `listLessons`, with the
 * search by content, Turma, Status, Período, Plano de aula and the page in the URL, so a link or a
 * reload brings the same list back ("Ver todas" in the screen of a class opens it with
 * `?classId=`). Any filter sends the list back to page 1, and the page on the screen stays while the
 * next one loads (`keepPreviousData`, with `aria-busy`). The search goes to the URL after the typing
 * stops, and follows the URL when it changes by another way.
 *
 * A row opens the lesson (`/lessons/:id`); the pencil and the trash of the last column open
 * Editar aula and Cancelar aula over the list, and the list stays where it was. The column and
 * "+ Nova aula" are only for who manages lessons (`lessons.manage`): the member sees neither, not
 * even in the empty state. "+ Nova aula" asks which class the lesson is for, and the class of the
 * filter, when there is one, comes chosen.
 *
 * "Candidaturas pendentes (N)" is not drawn here: the card has it hidden until the allocation of
 * members exists, and its button belongs to the `assignments` module, which `lessons` does not
 * import (a slot of `app/` would bring it, and the screen of the lesson, GUS-156, is about to ask
 * for the same slots).
 */
export function LessonsPage(): ReactElement {
  const { t } = useTranslation("lessons");
  const canManage = useCan("lessons.manage");
  const [params, setParams] = useSearchParams();
  const filters = readLessonFilters(params);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isNewLessonOpen, setIsNewLessonOpen] = useState(false);
  const options = useLessonFilterOptions({ courses: false });

  const search = useUrlSearch(
    filters.search,
    (value) =>
      setParams((current) => withLessonFilters(current, { search: value }), { replace: true }),
    SEARCH_DEBOUNCE_MS,
  );

  const lessonsQuery = useListLessons(toListLessonsParams(filters, PAGE_SIZE), {
    query: { placeholderData: keepPreviousData },
  });
  const page = lessonsQuery.data;
  const lessons = page?.data ?? [];
  const total = page?.total;

  // Asking again after an error with nothing to show makes the query "pending" again: the error
  // panel stays, with its button loading, so the button is not unmounted and the focus is not lost.
  const isRetrying =
    lessonsQuery.isPending && lessonsQuery.isFetching && lessonsQuery.errorUpdateCount > 0;

  const listState = resolveListState({
    // A placeholder with no rows holds nothing on the screen, and read with the new filters it
    // would show the wrong state (empty right after Limpar filtros): it waits as loading.
    isPending:
      (lessonsQuery.isPending && !isRetrying) || (lessonsQuery.isPlaceholderData && total === 0),
    isError: lessonsQuery.isError || isRetrying,
    total,
    hasActiveFilters: hasActiveLessonFilters(filters, LIST_FILTER_KEYS),
  });
  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

  function clearFilters() {
    search.clear();
    setParams((current) => withoutLessonFilters(current), { replace: true });
    searchInputRef.current?.focus();
  }

  const openNewLesson = () => setIsNewLessonOpen(true);

  return (
    <Card
      title={
        <span id="lessons-title">
          {total === undefined ? t("list.titlePending") : t("list.title", { count: total })}
        </span>
      }
      aside={
        canManage ? (
          <Button variant="primary" onPress={openNewLesson}>
            <span aria-hidden="true">+</span> {t("actions.new")}
          </Button>
        ) : null
      }
    >
      <section aria-labelledby="lessons-title" className="flex flex-col gap-3">
        <LessonFilters
          fields={["search", "classId", "status", "period", "lessonPlanId"]}
          search={search.text}
          onSearchChange={search.setText}
          searchInputRef={searchInputRef}
          filters={filters}
          options={options}
          onFilterChange={(key, value) =>
            setParams((current) => withLessonFilters(current, { [key]: value }))
          }
          onPeriodChange={(from, to) =>
            setParams((current) => withLessonFilters(current, { from, to }))
          }
        />
        <hr className="border-tedi-divider" />

        {listState === "loading" ? (
          <ListState variant="loading" title={t("list.loading")} />
        ) : listState === "error" ? (
          <ListState
            variant="error"
            title={t("list.error")}
            description={t("list.errorDescription")}
            action={{
              label: t("retry"),
              onPress: () => void lessonsQuery.refetch(),
              isLoading: lessonsQuery.isFetching,
            }}
          />
        ) : listState === "empty" ? (
          <ListState
            variant="empty"
            title={t("list.empty")}
            description={t("list.emptyDescription")}
            icon={calendarIcon}
            action={canManage ? { label: t("actions.new"), onPress: openNewLesson } : undefined}
          />
        ) : listState === "noResults" ? (
          <ListState
            variant="noResults"
            title={t("list.noResults")}
            icon={calendarIcon}
            action={{ label: t("list.clearFilters"), onPress: clearFilters }}
          />
        ) : (
          <div aria-busy={lessonsQuery.isPlaceholderData}>
            <LessonsTable lessons={lessons} caption={t("list.caption")} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <p className="text-base text-muted">
                {t("list.summary", { shown: lessons.length, count: total ?? 0 })}
              </p>
              {totalPages > 1 ? (
                <Pagination
                  page={Math.min(filters.page, totalPages)}
                  totalPages={totalPages}
                  onPageChange={(next) =>
                    setParams((current) => withLessonFilters(current, { page: String(next) }))
                  }
                  label={t("list.pagination")}
                  previousLabel={t("list.previous")}
                  nextLabel={t("list.next")}
                  pageLabel={(number) => t("list.page", { page: number })}
                />
              ) : null}
            </div>
          </div>
        )}
      </section>

      {isNewLessonOpen ? (
        <NewLessonFlow
          initialClassId={filters.classId || undefined}
          onClose={() => setIsNewLessonOpen(false)}
        />
      ) : null}
    </Card>
  );
}
