import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactElement } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useListLessonPlans, useUnarchiveLessonPlan } from "@api/generated/catalog/catalog";
import { useCan } from "@modules/auth";
import { ListState } from "@shared/components/ListState";
import { useDebounce } from "@shared/hooks/useDebounce";
import { resolveListState } from "@shared/lib/list-state";
import { Button, Card, Pagination, toast } from "@shared/ui";
import graduationCapIcon from "../../../assets/icons/graduation-cap.svg";

import { ArchiveLessonPlanDialog } from "../components/ArchiveLessonPlanDialog";
import { LessonPlanFilters } from "../components/LessonPlanFilters";
import { LessonPlanFormDialog } from "../components/LessonPlanFormDialog";
import { LessonPlansTable } from "../components/LessonPlansTable";
import {
  hasActiveLessonPlanFilters,
  readLessonPlanFilters,
  toListLessonPlansParams,
  withDurationFilter,
  withLessonPlanFilters,
  withoutLessonPlanFilters,
} from "../lib/lesson-plan-filters";
import { invalidateLessonPlans } from "../lib/lesson-plan-queries";

const PAGE_SIZE = 7;
const TYPING_DEBOUNCE_MS = 300;

type OpenDialog = { kind: "create" } | { kind: "edit" | "archive"; lessonPlanId: string } | null;

/**
 * Planos de aula (GUS-127): the catalog of lesson plans from `listLessonPlans`, with the search by
 * title, Conteúdo, Duração, Uso and the page in the URL, so a link or a reload brings the same list
 * back. Any filter sends the list back to page 1, and the page on the screen stays while the next
 * one loads (`keepPreviousData`). The search and Conteúdo go to the URL after the typing stops.
 *
 * + Novo plano de aula, the pencil, the bin and Reativar are only for who manages lesson plans
 * (`lessonPlans.manage`). They open the dialogs of GUS-126 over the list; a new plan opens its
 * detail after the save, and the rest leave the list where it was.
 */
export function LessonPlansPage(): ReactElement {
  const { t } = useTranslation("catalog");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canManage = useCan("lessonPlans.manage");
  const [params, setParams] = useSearchParams();
  const filters = readLessonPlanFilters(params);
  const [searchText, setSearchText] = useState(filters.search);
  const [contentText, setContentText] = useState(filters.content);
  const debouncedSearch = useDebounce(searchText.trim(), TYPING_DEBOUNCE_MS);
  const debouncedContent = useDebounce(contentText.trim(), TYPING_DEBOUNCE_MS);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  useEffect(() => {
    if (debouncedSearch === (params.get("search") ?? "")) return;
    setParams((current) => withLessonPlanFilters(current, { search: debouncedSearch }), {
      replace: true,
    });
  }, [debouncedSearch, params, setParams]);

  useEffect(() => {
    if (debouncedContent === (params.get("content") ?? "")) return;
    setParams((current) => withLessonPlanFilters(current, { content: debouncedContent }), {
      replace: true,
    });
  }, [debouncedContent, params, setParams]);

  const plansQuery = useListLessonPlans(toListLessonPlansParams(filters, PAGE_SIZE), {
    query: { placeholderData: keepPreviousData },
  });
  const page = plansQuery.data;
  const plans = page?.data ?? [];
  const total = page?.total ?? 0;

  const unarchivePlan = useUnarchiveLessonPlan({
    mutation: {
      onSuccess: () => {
        toast.success(t("toast.unarchived"));
        void invalidateLessonPlans(queryClient);
      },
      onError: () => toast.error(t("toast.unarchiveFailed")),
    },
  });

  const listState = resolveListState({
    isPending: plansQuery.isPending,
    isError: plansQuery.isError,
    total: page?.total,
    hasActiveFilters: hasActiveLessonPlanFilters(filters),
  });
  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

  function clearFilters() {
    setSearchText("");
    setContentText("");
    setParams((current) => withoutLessonPlanFilters(current), { replace: true });
  }

  const openCreate = () => setOpenDialog({ kind: "create" });
  const closeDialog = () => setOpenDialog(null);

  return (
    <Card
      title={<span id="lesson-plans-title">{t("title", { count: total })}</span>}
      aside={canManage ? <Button onPress={openCreate}>{t("newPlan")}</Button> : null}
    >
      <section aria-labelledby="lesson-plans-title" className="flex flex-col gap-3">
        <LessonPlanFilters
          search={searchText}
          onSearchChange={setSearchText}
          content={contentText}
          onContentChange={setContentText}
          filters={filters}
          onUsageChange={(usage) =>
            setParams((current) => withLessonPlanFilters(current, { usage }))
          }
          onDurationChange={(id) => setParams((current) => withDurationFilter(current, id))}
        />
        <hr className="border-tedi-divider" />

        {listState === "loading" ? (
          <ListState variant="loading" title={t("loading")} />
        ) : listState === "error" ? (
          <ListState
            variant="error"
            title={t("error")}
            description={t("errorDescription")}
            action={{
              label: t("retry"),
              onPress: () => void plansQuery.refetch(),
              isLoading: plansQuery.isFetching,
            }}
          />
        ) : listState === "empty" ? (
          <ListState
            variant="empty"
            title={t("empty")}
            description={t("emptyDescription")}
            icon={graduationCapIcon}
            action={canManage ? { label: t("newPlan"), onPress: openCreate } : undefined}
          />
        ) : listState === "noResults" ? (
          <ListState
            variant="noResults"
            title={t("noResults")}
            icon={graduationCapIcon}
            action={{ label: t("clearFilters"), onPress: clearFilters }}
          />
        ) : (
          <>
            <LessonPlansTable
              plans={plans}
              caption={t("title", { count: total })}
              onEdit={(plan) => setOpenDialog({ kind: "edit", lessonPlanId: plan.id })}
              onArchive={(plan) => setOpenDialog({ kind: "archive", lessonPlanId: plan.id })}
              onUnarchive={(plan) => unarchivePlan.mutate({ id: plan.id })}
              unarchivingId={unarchivePlan.isPending ? unarchivePlan.variables?.id : null}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <p className="text-base text-muted">{t("summary", { shown: plans.length, total })}</p>
              {totalPages > 1 ? (
                <Pagination
                  page={Math.min(filters.page, totalPages)}
                  totalPages={totalPages}
                  onPageChange={(next) =>
                    setParams((current) => withLessonPlanFilters(current, { page: String(next) }))
                  }
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
        <LessonPlanFormDialog
          mode="create"
          onClose={closeDialog}
          onSaved={(plan) => navigate(`/lesson-plans/${plan.id}`)}
        />
      ) : null}
      {openDialog?.kind === "edit" ? (
        <LessonPlanFormDialog
          mode="edit"
          lessonPlanId={openDialog.lessonPlanId}
          onClose={closeDialog}
        />
      ) : null}
      {openDialog?.kind === "archive" ? (
        <ArchiveLessonPlanDialog lessonPlanId={openDialog.lessonPlanId} onClose={closeDialog} />
      ) : null}
    </Card>
  );
}
