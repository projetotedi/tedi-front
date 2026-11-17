import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useListCourses } from "@api/generated/catalog/catalog";
import type { CourseListItemDto } from "@api/generated/model";
import { ListState } from "@shared/components/ListState";
import { useDebounce } from "@shared/hooks/useDebounce";
import { resolveListState } from "@shared/lib/list-state";
import { Card, Pagination } from "@shared/ui";

import { ArchiveCourseDialog } from "../components/ArchiveCourseDialog";
import { CourseFilters } from "../components/CourseFilters";
import { CoursesTable } from "../components/CoursesTable";
import { UnarchiveCourseDialog } from "../components/UnarchiveCourseDialog";
import { useCourseClassCounts } from "../hooks/useCourseClassCounts";
import {
  hasActiveCourseFilters,
  readCourseFilters,
  toListCoursesParams,
  withCourseFilter,
  withoutCourseFilters,
} from "../lib/course-filters";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type OpenDialog = { kind: "archive" | "unarchive"; course: CourseListItemDto } | null;

/**
 * Cursos (RF-013, GUS-131): the catalog of courses with search, filters and pages, all of it in the
 * URL, so a link or a reload brings the same list back. Any filter sends the list back to page 1.
 *
 * One `listCourses` per page (the number of lesson plans and the workload come in it) and one
 * `getClassesSummaryByCourse` for the column Turmas of the whole page. The page that was on the
 * screen stays while the next one loads (`keepPreviousData`), so the table does not blink.
 *
 * + Novo curso and the pencil of the Figma come with the form of GUS-129; the bin and Reativar
 * open the dialogs of GUS-139 over the list, and the list stays where it was.
 */
export function CoursesPage(): ReactElement {
  const { t } = useTranslation("catalog");
  const [params, setParams] = useSearchParams();
  const filters = readCourseFilters(params);
  const [searchText, setSearchText] = useState(filters.search);
  const debouncedSearch = useDebounce(searchText, SEARCH_DEBOUNCE_MS);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  useEffect(() => {
    if (debouncedSearch === (params.get("search") ?? "")) return;
    setParams((current) => withCourseFilter(current, "search", debouncedSearch.trim()), {
      replace: true,
    });
  }, [debouncedSearch, params, setParams]);

  const coursesQuery = useListCourses(toListCoursesParams(filters, filters.search, PAGE_SIZE), {
    query: { placeholderData: keepPreviousData },
  });
  const page = coursesQuery.data;
  const courses = page?.data ?? [];
  const classCounts = useCourseClassCounts(courses.map((course) => course.id));

  const listState = resolveListState({
    isPending: coursesQuery.isPending,
    isError: coursesQuery.isError,
    total: page?.total,
    hasActiveFilters: hasActiveCourseFilters(filters),
  });
  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

  function setFilter(key: "category" | "status" | "prerequisite" | "page", value: string) {
    setParams((current) => withCourseFilter(current, key, value));
  }

  function clearFilters() {
    setSearchText("");
    setParams((current) => withoutCourseFilters(current), { replace: true });
  }

  return (
    <Card title={<span id="courses-title">{t("courses.title", { count: page?.total ?? 0 })}</span>}>
      <section aria-labelledby="courses-title" className="flex flex-col gap-3">
        <CourseFilters
          search={searchText}
          onSearchChange={setSearchText}
          filters={filters}
          onFilterChange={setFilter}
        />

        {listState === "loading" ? (
          <ListState variant="loading" title={t("courses.loading")} />
        ) : listState === "error" ? (
          <ListState
            variant="error"
            title={t("courses.error")}
            action={{
              label: t("retry"),
              onPress: () => void coursesQuery.refetch(),
              isLoading: coursesQuery.isFetching,
            }}
          />
        ) : listState === "empty" ? (
          <ListState
            variant="empty"
            title={t("courses.empty")}
            description={t("courses.emptyDescription")}
          />
        ) : listState === "noResults" ? (
          <ListState
            variant="noResults"
            title={t("courses.noResults")}
            action={{ label: t("clearFilters"), onPress: clearFilters }}
          />
        ) : (
          <>
            <CoursesTable
              courses={courses}
              classCounts={classCounts}
              caption={t("courses.title", { count: page?.total ?? 0 })}
              onArchive={(course) => setOpenDialog({ kind: "archive", course })}
              onUnarchive={(course) => setOpenDialog({ kind: "unarchive", course })}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <p className="text-base text-muted">
                {t("courses.summary", { shown: courses.length, total: page?.total ?? 0 })}
              </p>
              {totalPages > 1 ? (
                <Pagination
                  page={Math.min(filters.page, totalPages)}
                  totalPages={totalPages}
                  onPageChange={(next) => setFilter("page", String(next))}
                  label={t("courses.pagination")}
                  previousLabel={t("previous")}
                  nextLabel={t("next")}
                  pageLabel={(number) => t("page", { page: number })}
                />
              ) : null}
            </div>
          </>
        )}
      </section>

      {openDialog?.kind === "archive" ? (
        <ArchiveCourseDialog course={openDialog.course} onClose={() => setOpenDialog(null)} />
      ) : null}
      {openDialog?.kind === "unarchive" ? (
        <UnarchiveCourseDialog course={openDialog.course} onClose={() => setOpenDialog(null)} />
      ) : null}
    </Card>
  );
}
