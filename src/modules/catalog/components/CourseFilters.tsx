import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { CourseCategory, CourseStatus } from "@api/generated/model";
import { Select, TextField, type SelectOption } from "@shared/ui";

import type { CourseFilterValues } from "../lib/course-filters";

export interface CourseFiltersProps {
  /** The text in the search box, before the debounce. */
  search: string;
  onSearchChange: (value: string) => void;
  filters: CourseFilterValues;
  onFilterChange: (key: "category" | "status" | "prerequisite", value: string) => void;
}

/**
 * The row of filters of the list of courses, as in the Figma: "Buscar curso por nome...",
 * "Categoria: todas", "Pré-requisito: todos" and "Status: todos". Each select says its name and
 * its value in the trigger, so the label is only for the screen reader.
 */
export function CourseFilters({
  search,
  onSearchChange,
  filters,
  onFilterChange,
}: CourseFiltersProps): ReactElement {
  const { t } = useTranslation("catalog");

  const triggerText =
    (label: string, all: string) =>
    (selected: SelectOption | null): string =>
      `${label}: ${(selected === null || selected.id === "" ? all : selected.label).toLocaleLowerCase()}`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
      <TextField
        label={t("courses.search")}
        isLabelHidden
        placeholder={t("courses.searchPlaceholder")}
        value={search}
        onChange={onSearchChange}
      />
      <Select
        label={t("courses.filters.category")}
        isLabelHidden
        value={filters.category}
        onChange={(value) => onFilterChange("category", value)}
        formatValue={triggerText(t("courses.filters.category"), t("courses.filters.allFeminine"))}
        options={[
          { id: "", label: t("courses.filters.allFeminine") },
          ...Object.values(CourseCategory).map((category) => ({
            id: category,
            label: t(`category.${category}`),
          })),
        ]}
      />
      <Select
        label={t("courses.filters.prerequisite")}
        isLabelHidden
        value={filters.prerequisite}
        onChange={(value) => onFilterChange("prerequisite", value)}
        formatValue={triggerText(t("courses.filters.prerequisite"), t("courses.filters.all"))}
        options={[
          { id: "", label: t("courses.filters.all") },
          { id: "with", label: t("courses.filters.withPrerequisite") },
          { id: "without", label: t("courses.filters.withoutPrerequisite") },
        ]}
      />
      <Select
        label={t("courses.filters.status")}
        isLabelHidden
        value={filters.status}
        onChange={(value) => onFilterChange("status", value)}
        formatValue={triggerText(t("courses.filters.status"), t("courses.filters.all"))}
        options={[
          { id: "", label: t("courses.filters.all") },
          { id: CourseStatus.active, label: t("course.status.active") },
          { id: CourseStatus.archived, label: t("course.status.archived") },
        ]}
      />
    </div>
  );
}
