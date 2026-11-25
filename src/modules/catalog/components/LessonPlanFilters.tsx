import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListLessonPlanContents } from "@api/generated/catalog/catalog";
import { LessonPlanUsageFilter } from "@api/generated/model";
import { useDebounce } from "@shared/hooks/useDebounce";
import { Combobox, Select, TextField, type SelectOption } from "@shared/ui";

import { DURATION_FILTERS, type LessonPlanFilterValues } from "../lib/lesson-plan-filters";

const SUGGESTIONS_DEBOUNCE_MS = 300;

const DURATION_LABEL_KEYS: Record<string, string> = {
  "": "durationAll",
  "up-to-90": "durationUpTo90",
  "91-to-120": "duration91To120",
  "over-120": "durationOver120",
};

export interface LessonPlanFiltersProps {
  /** The text in the search box, before the debounce. */
  search: string;
  onSearchChange: (value: string) => void;
  /** The text in the field Conteúdo, before the debounce. */
  content: string;
  onContentChange: (value: string) => void;
  filters: LessonPlanFilterValues;
  onUsageChange: (value: string) => void;
  onDurationChange: (id: string) => void;
}

/**
 * The row of filters of the list of lesson plans, as in the Figma: the search by title, Conteúdo,
 * Duração and Uso. Conteúdo is a text field with suggestions: as the person types, it lists the
 * contents of the catalog that contain the text (`listLessonPlanContents`), and picking one puts it
 * in the field; whatever is in the field filters the list. Each select says its name and its value
 * in the trigger, so the label is only for the screen reader.
 */
export function LessonPlanFilters({
  search,
  onSearchChange,
  content,
  onContentChange,
  filters,
  onUsageChange,
  onDurationChange,
}: LessonPlanFiltersProps): ReactElement {
  const { t } = useTranslation("catalog");
  const suggestionSearch = useDebounce(content.trim(), SUGGESTIONS_DEBOUNCE_MS);
  const suggestionsQuery = useListLessonPlanContents(
    suggestionSearch ? { search: suggestionSearch } : undefined,
  );

  const triggerText =
    (label: string, all: string) =>
    (selected: SelectOption | null): string =>
      `${label}: ${(selected === null || selected.id === "" ? all : selected.label).toLocaleLowerCase()}`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1fr]">
      <TextField
        label={t("search")}
        isLabelHidden
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={onSearchChange}
      />
      <Combobox
        label={t("content")}
        isLabelHidden
        placeholder={t("contentPlaceholder")}
        options={suggestionsQuery.data ?? []}
        value={content}
        onChange={onContentChange}
      />
      <Select
        label={t("duration")}
        isLabelHidden
        value={filters.duration}
        onChange={onDurationChange}
        formatValue={triggerText(t("duration"), t("durationAll"))}
        options={DURATION_FILTERS.map((filter) => ({
          id: filter.id,
          label: t(DURATION_LABEL_KEYS[filter.id]),
        }))}
      />
      <Select
        label={t("usage")}
        isLabelHidden
        value={filters.usage}
        onChange={onUsageChange}
        formatValue={triggerText(t("usage"), t("all"))}
        options={[
          { id: "", label: t("all") },
          { id: LessonPlanUsageFilter.in_use, label: t("inUse") },
          { id: LessonPlanUsageFilter.unused, label: t("unused") },
          { id: LessonPlanUsageFilter.archived, label: t("archived") },
        ]}
      />
    </div>
  );
}
