import { useState, type ReactElement, type Ref } from "react";
import { useTranslation } from "react-i18next";

import {
  LessonStatus,
  type ClassListItemDto,
  type CourseListItemDto,
  type LessonPlanListItemDto,
} from "@api/generated/model";
import { DatePicker, Select, TextField, type SelectOption } from "@shared/ui";

import type { LessonFilterKey, LessonFilterValues } from "../lib/lesson-filters";
import { LESSON_STATUS_LABEL_KEYS } from "../lib/lesson-status";

/** The filters a screen can show, in the order it asks for them. */
export type LessonFilterField =
  | "search"
  | "classId"
  | "courseId"
  | "status"
  | "lessonPlanId"
  | "period";

/** The filters that are a choice from a list, each with its own key in the URL. */
type LessonSelectKey = Exclude<LessonFilterKey, "search" | "page" | "from" | "to">;

export interface LessonFiltersProps {
  fields: readonly LessonFilterField[];
  /** The text in the search box, before the debounce. */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** The field of the search, for the screen to give the focus back to it (Limpar filtros). */
  searchInputRef?: Ref<HTMLInputElement>;
  filters: LessonFilterValues;
  options: {
    classes: ClassListItemDto[];
    courses: CourseListItemDto[];
    lessonPlans: LessonPlanListItemDto[];
  };
  onFilterChange: (key: LessonSelectKey, value: string) => void;
  onPeriodChange: (from: string, to: string) => void;
}

interface PeriodFilterProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

/**
 * The period: two dates, De and Até. Each one is kept here while it is typed, and the URL only
 * changes when the two make a period (the end is not before the start): an inverted one shows the
 * error on Até and leaves the URL, and so the list, as it was. The URL is still the truth: when it
 * brings another period (Limpar filtros, Voltar) the fields follow it.
 */
function PeriodFilter({ from, to, onChange }: PeriodFilterProps): ReactElement {
  const { t } = useTranslation("lessons");
  const [range, setRange] = useState({ from, to });
  const [seen, setSeen] = useState({ from, to });

  if (seen.from !== from || seen.to !== to) {
    setSeen({ from, to });
    setRange({ from, to });
  }

  const isInverted = range.from !== "" && range.to !== "" && range.from > range.to;

  function update(next: { from: string; to: string }) {
    setRange(next);
    const isInvertedNext = next.from !== "" && next.to !== "" && next.from > next.to;
    if (isInvertedNext || (next.from === from && next.to === to)) return;
    onChange(next.from, next.to);
  }

  return (
    <div
      role="group"
      aria-label={t("filters.period")}
      className="grid grid-cols-2 gap-3 sm:col-span-2"
    >
      <DatePicker
        label={t("filters.from")}
        value={range.from}
        onChange={(value) => update({ ...range, from: value })}
      />
      <DatePicker
        label={t("filters.to")}
        value={range.to}
        onChange={(value) => update({ ...range, to: value })}
        errorMessage={isInverted ? t("filters.invalidRange") : undefined}
      />
    </div>
  );
}

/**
 * The row of filters of the list and of the calendar of lessons: the search by content, Turma,
 * Curso, Status, Plano de aula and Período, only the ones the screen asks for (`fields`) and in the
 * order it asks. Each select says its name and its value in the trigger ("Turma: todas"), so the
 * label is only for the screen reader; the dates keep their labels, De and Até, because a date has
 * no room for a name inside it.
 *
 * The options come from the pages the screen read (`options`). A class or a plan of the URL that the
 * page does not list (an archived class, from a link of the screen of the class, or a page that has
 * not loaded yet) gets an option of its own, "Turma selecionada" or "Plano selecionado", so the
 * filter never says "todas" while it is filtering.
 */
export function LessonFilters({
  fields,
  search = "",
  onSearchChange,
  searchInputRef,
  filters,
  options,
  onFilterChange,
  onPeriodChange,
}: LessonFiltersProps): ReactElement {
  const { t } = useTranslation("lessons");

  const triggerText =
    (label: string, all: string) =>
    (selected: SelectOption | null): string =>
      `${label}: ${selected === null || selected.id === "" ? all.toLocaleLowerCase() : selected.label}`;

  const withUnknown = (known: SelectOption[], id: string, selectedLabel: string): SelectOption[] =>
    id !== "" && !known.some((option) => option.id === id)
      ? [...known, { id, label: selectedLabel }]
      : known;

  function renderSelect(key: LessonSelectKey): ReactElement {
    switch (key) {
      case "classId":
        return (
          <Select
            key={key}
            label={t("filters.class")}
            isLabelHidden
            value={filters.classId}
            onChange={(value) => onFilterChange(key, value)}
            formatValue={triggerText(t("filters.class"), t("filters.allFeminine"))}
            options={withUnknown(
              [
                { id: "", label: t("filters.allFeminine") },
                ...options.classes.map((item) => ({ id: item.id, label: item.name || item.code })),
              ],
              filters.classId,
              t("filters.selectedClass"),
            )}
          />
        );
      case "courseId":
        return (
          <Select
            key={key}
            label={t("filters.course")}
            isLabelHidden
            value={filters.courseId}
            onChange={(value) => onFilterChange(key, value)}
            formatValue={triggerText(t("filters.course"), t("filters.all"))}
            options={[
              { id: "", label: t("filters.all") },
              ...options.courses.map((course) => ({ id: course.id, label: course.name })),
            ]}
          />
        );
      case "status":
        return (
          <Select
            key={key}
            label={t("filters.status")}
            isLabelHidden
            value={filters.status}
            onChange={(value) => onFilterChange(key, value)}
            formatValue={triggerText(t("filters.status"), t("filters.all"))}
            options={[
              { id: "", label: t("filters.all") },
              ...Object.values(LessonStatus).map((status) => ({
                id: status,
                label: t(LESSON_STATUS_LABEL_KEYS[status]),
              })),
            ]}
          />
        );
      case "lessonPlanId":
        return (
          <Select
            key={key}
            label={t("filters.lessonPlan")}
            isLabelHidden
            value={filters.lessonPlanId}
            onChange={(value) => onFilterChange(key, value)}
            formatValue={triggerText(t("filters.lessonPlan"), t("filters.all"))}
            options={withUnknown(
              [
                { id: "", label: t("filters.all") },
                ...options.lessonPlans.map((plan) => ({ id: plan.id, label: plan.title })),
              ],
              filters.lessonPlanId,
              t("filters.selectedLessonPlan"),
            )}
          />
        );
    }
  }

  function renderField(field: LessonFilterField): ReactElement {
    if (field === "search") {
      return (
        <div key={field} className="sm:col-span-2">
          <TextField
            label={t("list.searchLabel")}
            isLabelHidden
            placeholder={t("list.searchPlaceholder")}
            value={search}
            onChange={(value) => onSearchChange?.(value)}
            inputRef={searchInputRef}
          />
        </div>
      );
    }
    if (field === "period") {
      return (
        <PeriodFilter key={field} from={filters.from} to={filters.to} onChange={onPeriodChange} />
      );
    }
    return renderSelect(field);
  }

  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {fields.map(renderField)}
    </div>
  );
}
