import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListClasses } from "@api/generated/classes/classes";
import { AccessibilityNeed, StudentEnrollmentSituation } from "@api/generated/model";
import { Select, TextField, type SelectOption } from "@shared/ui";

import {
  ANY_ACCESSIBILITY,
  usesEnrollmentSource,
  type StudentFilterKey,
  type StudentFilterValues,
} from "../lib/student-filters";

const CLASS_OPTIONS_LIMIT = 100;

export interface StudentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: StudentFilterValues;
  onFilterChange: (key: Exclude<StudentFilterKey, "search" | "page">, value: string) => void;
}

/**
 * The search and the three filters of the list of students, as in the Figma: Turma, Situação and
 * Acessibilidade. Turma and Situação read the list by enrollment, which does not filter by
 * accessibility, so Acessibilidade is off while one of them is on (the hint says why).
 */
export function StudentFilters({
  search,
  onSearchChange,
  filters,
  onFilterChange,
}: StudentFiltersProps): ReactElement {
  const { t } = useTranslation("people");
  const classesQuery = useListClasses({ limit: CLASS_OPTIONS_LIMIT });
  const byEnrollment = usesEnrollmentSource(filters);

  const triggerText =
    (label: string, all: string) =>
    (selected: SelectOption | null): string =>
      `${label}: ${(selected === null || selected.id === "" ? all : selected.label).toLocaleLowerCase()}`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
      <TextField
        label={t("students.search")}
        isLabelHidden
        placeholder={t("students.searchPlaceholder")}
        value={search}
        onChange={onSearchChange}
      />
      <Select
        label={t("students.filters.class")}
        isLabelHidden
        value={filters.classId}
        onChange={(value) => onFilterChange("classId", value)}
        formatValue={triggerText(t("students.filters.class"), t("students.filters.allFeminine"))}
        options={[
          { id: "", label: t("students.filters.allFeminine") },
          ...(classesQuery.data?.data ?? []).map((schoolClass) => ({
            id: schoolClass.id,
            label: `${schoolClass.course.name} — ${schoolClass.name ?? schoolClass.code}`,
          })),
        ]}
      />
      <Select
        label={t("students.filters.situation")}
        isLabelHidden
        value={filters.situation}
        onChange={(value) => onFilterChange("situation", value)}
        formatValue={triggerText(
          t("students.filters.situation"),
          t("students.filters.allFeminine"),
        )}
        options={[
          { id: "", label: t("students.filters.allFeminine") },
          ...Object.values(StudentEnrollmentSituation).map((situation) => ({
            id: situation,
            label: t(`students.situation.${situation}`),
          })),
        ]}
      />
      <Select
        label={t("students.filters.accessibility")}
        isLabelHidden
        value={byEnrollment ? "" : filters.accessibility}
        onChange={(value) => onFilterChange("accessibility", value)}
        isDisabled={byEnrollment}
        description={byEnrollment ? t("students.filters.accessibilityOff") : undefined}
        formatValue={triggerText(
          t("students.filters.accessibility"),
          t("students.filters.allFeminine"),
        )}
        options={[
          { id: "", label: t("students.filters.allFeminine") },
          { id: ANY_ACCESSIBILITY, label: t("students.filters.anyAccessibility") },
          ...Object.values(AccessibilityNeed).map((need) => ({
            id: need,
            label: t(`student.accessibilityNeed.${need}`),
          })),
        ]}
      />
    </div>
  );
}
