import { useState, type ReactElement } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { ListState } from "@shared/components/ListState";
import { formatHours } from "@shared/lib/format";
import { Badge, Button, Card, Pagination, Select, TextField } from "@shared/ui";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import graduationCapIcon from "../../../assets/icons/graduation-cap.svg";

import { ArchiveLessonPlanDialog } from "../components/ArchiveLessonPlanDialog";
import { LessonPlanFormDialog } from "../components/LessonPlanFormDialog";
import {
  DURATION_FILTERS,
  filterLessonPlans,
  getDurationFilter,
  getDurationRange,
  normalizePage,
} from "../lib/lesson-plan-filters";
import { MOCK_LESSON_PLANS, type LessonPlanMock } from "../mocks/lesson-plans.mock";

const PAGE_SIZE = 7;
const NEW_PLAN_PREVIEW = MOCK_LESSON_PLANS.find((plan) => plan.id === "lesson-plan-04") ?? null;

export function LessonPlansPage(): ReactElement {
  const { t } = useTranslation("catalog");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const canManage = useCan("lessonPlans.manage");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<LessonPlanMock | null>(null);
  const [archivingPlan, setArchivingPlan] = useState<LessonPlanMock | null>(null);

  const search = params.get("search") ?? "";
  const content = params.get("content") ?? "";
  const usage = params.get("usage") ?? "";
  const page = normalizePage(params.get("page"));
  const durationFilterId = getDurationFilter(params);
  const mockState = params.get("mockState");
  const filtered = filterLessonPlans(MOCK_LESSON_PLANS, {
    search,
    content,
    usage,
    minDuration: params.get("minDuration") ?? undefined,
    maxDuration: params.get("maxDuration") ?? undefined,
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateParams(updates: Record<string, string | undefined>, resetPage = true) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(updates)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (resetPage) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    updateParams({
      search: undefined,
      content: undefined,
      usage: undefined,
      minDuration: undefined,
      maxDuration: undefined,
      mockState: undefined,
    });
  }

  function openCreateDialog() {
    setSelectedPlan(NEW_PLAN_PREVIEW);
    setFormMode("create");
  }

  function closeFormDialog() {
    setFormMode(null);
    setSelectedPlan(null);
  }

  const contentOptions = [...new Set(MOCK_LESSON_PLANS.flatMap((plan) => plan.contents))].sort(
    (left, right) => left.localeCompare(right),
  );
  const durationOptions = DURATION_FILTERS.map((filter) => ({
    id: filter.id,
    label: filter.id
      ? t(
          `duration${filter.id === "up-to-90" ? "UpTo90" : filter.id === "91-to-120" ? "91To120" : "Over120"}`,
        )
      : t("durationAll"),
  }));
  const usageOptions = [
    { id: "", label: t("all").toLocaleLowerCase() },
    { id: "in_use", label: t("inUse") },
    { id: "unused", label: t("unused") },
    { id: "archived", label: t("archived") },
  ];

  const columns: Column<LessonPlanMock>[] = [
    {
      header: t("lessonPlan").toLocaleUpperCase(),
      headerClassName: "w-[22%]",
      cellClassName:
        "relative w-[22%] pl-0 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent before:opacity-0 before:content-[''] group-hover:before:opacity-100",
      render: (plan) => (
        <Link
          to={`/lesson-plans/${plan.id}`}
          className="font-medium text-foreground hover:underline focus-visible:underline"
          title={plan.title}
        >
          {plan.title}
        </Link>
      ),
    },
    {
      header: t("contents").toLocaleUpperCase(),
      headerClassName: "w-[18%]",
      cellClassName: "w-[18%]",
      render: (plan) => <span>{plan.contents.join(", ")}</span>,
    },
    {
      header: t("duration").toLocaleUpperCase(),
      headerClassName: "w-[9%]",
      cellClassName: "w-[9%] whitespace-nowrap",
      render: (plan) => <span>{formatHours(plan.expectedDurationMinutes)}</span>,
    },
    {
      header: t("coursesUsing").toLocaleUpperCase(),
      headerClassName: "w-[10%]",
      cellClassName: "w-[10%] whitespace-nowrap",
      render: (plan) =>
        plan.courseCount > 0 ? t("courseCount", { count: plan.courseCount }) : "—",
    },
    {
      header: t("classesUsed").toLocaleUpperCase(),
      headerClassName: "w-[12%]",
      cellClassName: "w-[12%]",
      render: (plan) =>
        plan.classesUsedCount == null ? (
          <span aria-label={t("classesCountUnavailable")}>—</span>
        ) : (
          t("classesUsedCount", { count: plan.classesUsedCount })
        ),
    },
    {
      header: t("material").toLocaleUpperCase(),
      headerClassName: "w-[8%]",
      cellClassName: "w-[8%] whitespace-nowrap",
      render: (plan) => (
        <a
          href={plan.materialUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="text-sky-800 underline-offset-2 hover:underline focus-visible:underline"
          aria-label={t("openMaterial", { title: plan.title })}
        >
          {t("openMaterialLabel")}
        </a>
      ),
    },
    {
      header: t("status").toLocaleUpperCase(),
      headerClassName: "w-[11%]",
      cellClassName: "w-[11%]",
      render: (plan) => (
        <Badge tone={plan.usage === "in_use" ? "success" : "neutral"}>
          {t(plan.usage === "in_use" ? "inUse" : plan.usage === "archived" ? "archived" : "unused")}
        </Badge>
      ),
    },
    {
      header: t("actions").toLocaleUpperCase(),
      headerClassName: "w-[10%]",
      cellClassName: "w-[10%]",
      render: (plan) =>
        canManage ? (
          <div className="flex items-center gap-3">
            <span title={t("edit", { title: plan.title })}>
              <Button
                variant="ghost"
                isIconOnly
                aria-label={t("edit", { title: plan.title })}
                onPress={() => {
                  setSelectedPlan(plan);
                  setFormMode("edit");
                }}
              >
                <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
              </Button>
            </span>
            <span title={t("archiveAction", { title: plan.title })}>
              <Button
                variant="ghost"
                isIconOnly
                aria-label={t("archiveAction", { title: plan.title })}
                className="text-danger"
                onPress={() => setArchivingPlan(plan)}
              >
                <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
              </Button>
            </span>
          </div>
        ) : null,
    },
  ];

  const showingEmpty = mockState === "empty";
  const isLoading = mockState === "loading";
  const hasError = mockState === "error";
  const noResults = !isLoading && !hasError && !showingEmpty && filtered.length === 0;
  const visibleCount = isLoading || hasError || showingEmpty || noResults ? 0 : rows.length;
  const totalCount = showingEmpty ? 0 : filtered.length;
  const headingCount = showingEmpty ? 0 : filtered.length;

  return (
    <section
      aria-labelledby="lesson-plans-title"
      className="-mx-4 -my-6 min-h-[calc(100vh-8.75rem)] bg-sky-50 px-4 py-6 lg:-mx-10 lg:-my-8 lg:px-10 lg:py-8"
    >
      <Card
        className="min-h-[calc(100vh-9rem)] rounded-3xl"
        title={<span id="lesson-plans-title">{t("title", { count: headingCount })}</span>}
        aside={canManage ? <Button onPress={openCreateDialog}>{t("newPlan")}</Button> : null}
      >
        <div className="flex min-h-[calc(100vh-15rem)] flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1fr]">
            <TextField
              label={t("search")}
              isLabelHidden
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(value) => updateParams({ search: value })}
            />
            <Select
              label={t("content")}
              isLabelHidden
              value={content}
              onChange={(value) => updateParams({ content: value })}
              formatValue={(selected) =>
                `${t("content")}: ${selected?.label ?? t("all").toLocaleLowerCase()}`
              }
              options={[
                { id: "", label: t("all").toLocaleLowerCase() },
                ...contentOptions.map((item) => ({ id: item, label: item })),
              ]}
            />
            <Select
              label={t("duration")}
              isLabelHidden
              value={durationFilterId}
              onChange={(value) => {
                const range = getDurationRange(value);
                updateParams({
                  minDuration:
                    range.minDuration === undefined ? undefined : String(range.minDuration),
                  maxDuration:
                    range.maxDuration === undefined ? undefined : String(range.maxDuration),
                });
              }}
              formatValue={(selected) =>
                `${t("duration")}: ${selected?.label ?? t("durationAll").toLocaleLowerCase()}`
              }
              options={durationOptions}
            />
            <Select
              label={t("usage")}
              isLabelHidden
              value={usage}
              onChange={(value) => updateParams({ usage: value })}
              formatValue={(selected) =>
                `${t("usage")}: ${selected?.label ?? t("all").toLocaleLowerCase()}`
              }
              options={usageOptions}
            />
          </div>

          <hr className="border-tedi-divider" />
          <DataTable
            columns={columns}
            rows={isLoading || hasError || showingEmpty || noResults ? [] : rows}
            rowKey={(plan) => plan.id}
            caption={t("title", { count: totalCount })}
            onRowClick={(plan) => navigate(`/lesson-plans/${plan.id}`)}
          />

          {isLoading ? (
            <ListState variant="loading" title={t("loading")} />
          ) : hasError ? (
            <ListState
              variant="error"
              title={t("error")}
              description={t("errorDescription")}
              action={{
                label: t("retry"),
                onPress: () => updateParams({ mockState: undefined }, false),
              }}
            />
          ) : showingEmpty ? (
            <ListState
              variant="empty"
              title={t("empty")}
              description={t("emptyDescription")}
              icon={graduationCapIcon}
              action={canManage ? { label: t("newPlan"), onPress: openCreateDialog } : undefined}
            />
          ) : noResults ? (
            <ListState
              variant="noResults"
              title={t("noResults")}
              icon={graduationCapIcon}
              action={{ label: t("clearFilters"), onPress: clearFilters }}
            />
          ) : null}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
            <p className="text-base text-muted">
              {t("summary", { shown: visibleCount, total: totalCount })}
            </p>
            {!isLoading && !hasError && !showingEmpty && totalPages > 1 ? (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={(nextPage) => updateParams({ page: String(nextPage) }, false)}
                label={t("actions")}
                previousLabel={t("previous")}
                nextLabel={t("next")}
                pageLabel={(number) => t("page", { page: number })}
              />
            ) : null}
          </div>
        </div>

        {formMode && (
          <LessonPlanFormDialog mode={formMode} plan={selectedPlan} onClose={closeFormDialog} />
        )}
        {archivingPlan && (
          <ArchiveLessonPlanDialog plan={archivingPlan} onClose={() => setArchivingPlan(null)} />
        )}
      </Card>
    </section>
  );
}
