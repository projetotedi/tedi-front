import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useListClasses } from "@api/generated/classes/classes";
import { useCan } from "@modules/auth";
import { ListState } from "@shared/components/ListState";
import { useDebounce } from "@shared/hooks/useDebounce";
import { resolveListState } from "@shared/lib/list-state";
import { Button, Card, Pagination } from "@shared/ui";

import { ArchiveClassDialog } from "../components/ArchiveClassDialog";
import { ClassFilters } from "../components/ClassFilters";
import { ClassFormDialog } from "../components/ClassFormDialog";
import { ClassesTable } from "../components/ClassesTable";
import { UnarchiveClassDialog } from "../components/UnarchiveClassDialog";
import { useCourseOptions } from "../hooks/useCourseOptions";
import {
  hasActiveClassFilters,
  readClassFilters,
  toListClassesParams,
  withClassFilter,
  withoutClassFilters,
  type ClassFilterKey,
} from "../lib/class-filters";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

type OpenDialog =
  | { kind: "create" }
  | { kind: "edit" | "archive" | "unarchive"; classId: string }
  | null;

/**
 * Turmas (RF-024, RF-030, GUS-133, GUS-170): the classes of every edition, from `listClasses`, with
 * the search, the filters and the page in the URL, so a link or a reload brings the same list back
 * ("Ver todas" in the screen of a course opens it with `?courseId=`). Any filter sends the list back
 * to page 1, and the page on the screen stays while the next one loads (`keepPreviousData`).
 *
 * + Nova turma, the pencil, the bin and Reativar are only for who manages classes
 * (`classes.manage`); each one opens its dialog over the list, and the list stays where it was.
 */
export function ClassesListPage(): ReactElement {
  const { t } = useTranslation("classes");
  const canManage = useCan("classes.manage");
  const { courses } = useCourseOptions();
  const [params, setParams] = useSearchParams();
  const filters = readClassFilters(params);
  const [searchText, setSearchText] = useState(filters.search);
  const debouncedSearch = useDebounce(searchText, SEARCH_DEBOUNCE_MS);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  useEffect(() => {
    if (debouncedSearch.trim() === (params.get("search") ?? "")) return;
    setParams((current) => withClassFilter(current, "search", debouncedSearch.trim()), {
      replace: true,
    });
  }, [debouncedSearch, params, setParams]);

  const classesQuery = useListClasses(toListClassesParams(filters, PAGE_SIZE), {
    query: { placeholderData: keepPreviousData },
  });
  const page = classesQuery.data;
  const classes = page?.data ?? [];
  const total = page?.total ?? 0;

  const listState = resolveListState({
    isPending: classesQuery.isPending,
    isError: classesQuery.isError,
    total: page?.total,
    hasActiveFilters: hasActiveClassFilters(filters),
  });
  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

  function setFilter(key: Exclude<ClassFilterKey, "search">, value: string) {
    setParams((current) => withClassFilter(current, key, value));
  }

  function setStatus(statuses: string[], archived: boolean) {
    setParams((current) =>
      withClassFilter(
        withClassFilter(current, "status", statuses.join(",")),
        "archived",
        archived ? "true" : "",
      ),
    );
  }

  function clearFilters() {
    setSearchText("");
    setParams((current) => withoutClassFilters(current), { replace: true });
  }

  const openCreate = () => setOpenDialog({ kind: "create" });

  return (
    <Card
      title={<span id="classes-title">{t("title", { count: total })}</span>}
      aside={canManage ? <Button onPress={openCreate}>{t("create")}</Button> : undefined}
    >
      <section aria-labelledby="classes-title" className="flex flex-col gap-3">
        <ClassFilters
          search={searchText}
          onSearchChange={setSearchText}
          filters={filters}
          courses={courses}
          onFilterChange={setFilter}
          onStatusChange={setStatus}
        />
        <hr className="border-tedi-divider" />

        {listState === "loading" ? (
          <ListState variant="loading" title={t("loading")} />
        ) : listState === "error" ? (
          <ListState
            variant="error"
            title={t("error")}
            action={{
              label: t("retry"),
              onPress: () => void classesQuery.refetch(),
              isLoading: classesQuery.isFetching,
            }}
          />
        ) : listState === "empty" ? (
          <ListState
            variant="empty"
            title={t("empty")}
            description={t("emptyDescription")}
            action={canManage ? { label: t("create"), onPress: openCreate } : undefined}
          />
        ) : listState === "noResults" ? (
          <ListState
            variant="noResults"
            title={t("noResults")}
            action={{ label: t("clear"), onPress: clearFilters }}
          />
        ) : (
          <>
            <ClassesTable
              classes={classes}
              caption={t("title", { count: total })}
              onEdit={(item) => setOpenDialog({ kind: "edit", classId: item.id })}
              onArchive={(item) => setOpenDialog({ kind: "archive", classId: item.id })}
              onUnarchive={(item) => setOpenDialog({ kind: "unarchive", classId: item.id })}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <p className="text-base text-muted">
                {t("summary", { shown: classes.length, total })}
              </p>
              {totalPages > 1 ? (
                <Pagination
                  page={Math.min(filters.page, totalPages)}
                  totalPages={totalPages}
                  onPageChange={(next) => setFilter("page", String(next))}
                  label={t("pagination")}
                  previousLabel={t("previous")}
                  nextLabel={t("next")}
                  pageLabel={(number) => t("page", { page: number })}
                />
              ) : null}
            </div>
          </>
        )}
      </section>

      {openDialog?.kind === "create" ? (
        <ClassFormDialog onClose={() => setOpenDialog(null)} />
      ) : null}
      {openDialog?.kind === "edit" ? (
        <ClassFormDialog classId={openDialog.classId} onClose={() => setOpenDialog(null)} />
      ) : null}
      {openDialog?.kind === "archive" ? (
        <ArchiveClassDialog classId={openDialog.classId} onClose={() => setOpenDialog(null)} />
      ) : null}
      {openDialog?.kind === "unarchive" ? (
        <UnarchiveClassDialog classId={openDialog.classId} onClose={() => setOpenDialog(null)} />
      ) : null}
    </Card>
  );
}
