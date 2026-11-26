import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useListStudentsByEnrollment } from "@api/generated/classes/classes";
import { useListStudents } from "@api/generated/people/people";
import { ListState } from "@shared/components/ListState";
import { useDebounce } from "@shared/hooks/useDebounce";
import { resolveListState } from "@shared/lib/list-state";
import { Card, Pagination } from "@shared/ui";

import { StudentFilters } from "../components/StudentFilters";
import { StudentsTable } from "../components/StudentsTable";
import {
  hasActiveStudentFilters,
  readStudentFilters,
  toListStudentsByEnrollmentParams,
  toListStudentsParams,
  usesEnrollmentSource,
  withStudentFilter,
  withoutStudentFilters,
  type StudentFilterKey,
} from "../lib/student-filters";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Alunos (GUS-137, Figma "Alunos · listagem"): the students, alphabetical, with the search (name,
 * e-mail or phone), the filters and the page in the URL, so a link or a reload brings the same list
 * back; any filter goes back to page 1. With Turma or Situação the list comes from
 * `listStudentsByEnrollment`, else from `listStudents` (see `usesEnrollmentSource`). Only one of the
 * two queries runs at a time. The row opens the record of the student.
 *
 * + Novo aluno, the pencil and the bin come with GUS-123 (the dialogs of the student).
 */
export function StudentsPage(): ReactElement {
  const { t } = useTranslation("people");
  const [params, setParams] = useSearchParams();
  const filters = readStudentFilters(params);
  const [searchText, setSearchText] = useState(filters.search);
  const debouncedSearch = useDebounce(searchText, SEARCH_DEBOUNCE_MS);
  const byEnrollment = usesEnrollmentSource(filters);

  useEffect(() => {
    if (debouncedSearch.trim() === (params.get("search") ?? "")) return;
    setParams((current) => withStudentFilter(current, "search", debouncedSearch.trim()), {
      replace: true,
    });
  }, [debouncedSearch, params, setParams]);

  const plainQuery = useListStudents(toListStudentsParams(filters, PAGE_SIZE), {
    query: { placeholderData: keepPreviousData, enabled: !byEnrollment },
  });
  const enrollmentQuery = useListStudentsByEnrollment(
    toListStudentsByEnrollmentParams(filters, PAGE_SIZE),
    { query: { placeholderData: keepPreviousData, enabled: byEnrollment } },
  );
  const query = byEnrollment ? enrollmentQuery : plainQuery;
  const page = query.data;
  const students = page?.data ?? [];
  const total = page?.total ?? 0;

  const listState = resolveListState({
    isPending: query.isPending,
    isError: query.isError,
    total: page?.total,
    hasActiveFilters: hasActiveStudentFilters(filters),
  });
  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

  function setFilter(key: Exclude<StudentFilterKey, "search">, value: string) {
    setParams((current) => withStudentFilter(current, key, value));
  }

  function clearFilters() {
    setSearchText("");
    setParams((current) => withoutStudentFilters(current), { replace: true });
  }

  return (
    <Card title={<span id="students-title">{t("students.title", { count: total })}</span>}>
      <section aria-labelledby="students-title" className="flex flex-col gap-3">
        <StudentFilters
          search={searchText}
          onSearchChange={setSearchText}
          filters={filters}
          onFilterChange={setFilter}
        />
        <hr className="border-tedi-divider" />

        {listState === "loading" ? (
          <ListState variant="loading" title={t("students.loading")} />
        ) : listState === "error" ? (
          <ListState
            variant="error"
            title={t("students.error")}
            action={{
              label: t("students.retry"),
              onPress: () => void query.refetch(),
              isLoading: query.isFetching,
            }}
          />
        ) : listState === "empty" ? (
          <ListState variant="empty" title={t("students.empty")} />
        ) : listState === "noResults" ? (
          <ListState
            variant="noResults"
            title={t("students.noResults")}
            action={{ label: t("students.clear"), onPress: clearFilters }}
          />
        ) : (
          <>
            <StudentsTable students={students} caption={t("students.title", { count: total })} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <p className="text-base text-muted">
                {t("students.summary", { shown: students.length, total })}
              </p>
              {totalPages > 1 ? (
                <Pagination
                  page={Math.min(filters.page, totalPages)}
                  totalPages={totalPages}
                  onPageChange={(next) => setFilter("page", String(next))}
                  label={t("students.pagination")}
                  previousLabel={t("students.previous")}
                  nextLabel={t("students.next")}
                  pageLabel={(number) => t("students.page", { page: number })}
                />
              ) : null}
            </div>
          </>
        )}
      </section>
    </Card>
  );
}
