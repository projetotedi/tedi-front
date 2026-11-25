import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListEditions } from "@api/generated/classes/classes";
import { ClassStatus, CourseCategory, type ClassCourseResponseDto } from "@api/generated/model";
import { MultiSelect, Select, TextField, type SelectOption } from "@shared/ui";

import { CLASS_STATUS_LABEL_KEYS } from "../lib/class-status";
import type { ClassFilterKey, ClassFilterValues } from "../lib/class-filters";

/** The option of the status filter that is not a status: the archived classes (`archived=true`). */
export const ARCHIVED_OPTION = "archived";

export interface ClassFiltersProps {
  /** The text in the search box, before the debounce. */
  search: string;
  onSearchChange: (value: string) => void;
  filters: ClassFilterValues;
  courses: readonly ClassCourseResponseDto[];
  onFilterChange: (key: Exclude<ClassFilterKey, "search" | "page">, value: string) => void;
  /** Status and Arquivadas change together, so they go in one step. */
  onStatusChange: (statuses: string[], archived: boolean) => void;
}

/**
 * The row of filters of the list of classes, as in the Figma: the search, "Edição: todas",
 * "Curso: todos", "Nível: todos" and "Status: todos". The editions are the ones of the API
 * (`listEditions`), by id. Status takes more than one status and, apart from them, Arquivadas: the
 * API keeps the archived classes out of the list unless asked (`archived=true`). Each select says
 * its name and its value in the trigger, so the label is only for the screen reader.
 */
export function ClassFilters({
  search,
  onSearchChange,
  filters,
  courses,
  onFilterChange,
  onStatusChange,
}: ClassFiltersProps): ReactElement {
  const { t } = useTranslation("classes");
  const editionsQuery = useListEditions();

  const triggerText =
    (label: string, all: string) =>
    (selected: SelectOption | null): string =>
      `${label}: ${(selected === null || selected.id === "" ? all : selected.label).toLocaleLowerCase()}`;

  // The course of the URL can be one this page does not list (a link from the screen of a course
  // whose list has not loaded yet): it gets an option of its own, so the filter never says "todos"
  // while it is filtering.
  const isCourseUnknown =
    filters.courseId !== "" && !courses.some((course) => course.id === filters.courseId);
  const courseOptions = [
    { id: "", label: t("all") },
    ...courses.map((course) => ({ id: course.id, label: course.name })),
    ...(isCourseUnknown ? [{ id: filters.courseId, label: t("selectedCourse") }] : []),
  ];

  const statusOptions = [
    ...Object.values(ClassStatus).map((status) => ({
      id: status,
      label: t(CLASS_STATUS_LABEL_KEYS[status]),
    })),
    { id: ARCHIVED_OPTION, label: t("archived") },
  ];
  const statusValue = [...filters.statuses, ...(filters.archived ? [ARCHIVED_OPTION] : [])];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.05fr_.95fr_1fr]">
      <TextField
        label={t("search")}
        isLabelHidden
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={onSearchChange}
      />
      <Select
        label={t("edition")}
        isLabelHidden
        value={filters.editionId}
        onChange={(value) => onFilterChange("editionId", value)}
        formatValue={triggerText(t("edition"), t("allFeminine"))}
        options={[
          { id: "", label: t("allFeminine") },
          ...(editionsQuery.data ?? []).map((edition) => ({ id: edition.id, label: edition.name })),
        ]}
      />
      <Select
        label={t("course")}
        isLabelHidden
        value={filters.courseId}
        onChange={(value) => onFilterChange("courseId", value)}
        formatValue={(selected) =>
          isCourseUnknown && selected?.id === filters.courseId
            ? selected.label
            : triggerText(t("course"), t("all"))(selected)
        }
        options={courseOptions}
      />
      <Select
        label={t("level")}
        isLabelHidden
        value={filters.category}
        onChange={(value) => onFilterChange("category", value)}
        formatValue={triggerText(t("level"), t("all"))}
        options={[
          { id: "", label: t("all") },
          ...Object.values(CourseCategory).map((category) => ({
            id: category,
            label: t(`levels.${category}`),
          })),
        ]}
      />
      <MultiSelect
        label={t("status")}
        isLabelHidden
        options={statusOptions}
        value={statusValue}
        onChange={(values) =>
          onStatusChange(
            values.filter((value) => value !== ARCHIVED_OPTION),
            values.includes(ARCHIVED_OPTION),
          )
        }
        formatValue={(selected) =>
          `${t("status")}: ${
            selected.length === 0
              ? t("all").toLocaleLowerCase()
              : selected.map((option) => option.label).join(", ")
          }`
        }
      />
    </div>
  );
}
