import type { ReactElement, Ref } from "react";
import { useTranslation } from "react-i18next";

import { Select, TextField, type SelectOption } from "@shared/ui";

import { BankViewChips, type BankViewChipsProps } from "./BankViewChips";

export interface BankFiltersProps extends BankViewChipsProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef: Ref<HTMLInputElement>;
  period: string;
  periodOptions: SelectOption[];
  onPeriodChange: (period: string) => void;
}

/** The filters of the Banco de horas, in the order of the Figma: Buscar membro, Período and Visão. */
export function BankFilters({
  search,
  onSearchChange,
  searchInputRef,
  period,
  periodOptions,
  onPeriodChange,
  ...view
}: BankFiltersProps): ReactElement {
  const { t } = useTranslation("hours");

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="w-full lg:w-70">
        <TextField
          label={t("bank.filters.search")}
          placeholder={t("bank.filters.searchPlaceholder")}
          value={search}
          onChange={onSearchChange}
          inputRef={searchInputRef}
          autoComplete="off"
        />
      </div>
      <div className="w-full sm:w-50">
        <Select
          label={t("bank.filters.period")}
          options={periodOptions}
          value={period}
          onChange={onPeriodChange}
        />
      </div>
      <BankViewChips {...view} />
    </div>
  );
}
