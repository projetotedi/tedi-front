import type { ReactElement, Ref } from "react";
import { useTranslation } from "react-i18next";

import { Select, TextField, type SelectOption } from "@shared/ui";

import type { MemberFilterKey, MemberRoleFilter, MemberStatusFilter } from "../lib/member-filters";
import { INVITABLE_ROLES } from "../lib/role-label";

export interface AccessFiltersProps {
  /** The text in the search box, before the debounce. */
  search: string;
  onSearchChange: (value: string) => void;
  role: MemberRoleFilter;
  status: MemberStatusFilter;
  /** The empty string is "Todos". */
  onFilterChange: (key: Extract<MemberFilterKey, "role" | "status">, value: string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
}

/**
 * The row of filters of the list of members: the search (name or RA), Papel and Status. The Figma
 * also has Turma and Data da aula, which this list does not offer. Status has "A validar", the
 * registrations waiting for validation. Each select says its name and its value in the trigger, so
 * the label is only for the screen reader.
 */
export function AccessFilters({
  search,
  onSearchChange,
  role,
  status,
  onFilterChange,
  searchInputRef,
}: AccessFiltersProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);

  const roleOptions: SelectOption[] = [
    { id: "", label: t("access.people.filters.role.all") },
    ...INVITABLE_ROLES.map((value) => ({
      id: value,
      label: t(`roles.${value}`, { ns: "common" }),
    })),
  ];
  const statusOptions: SelectOption[] = [
    { id: "", label: t("access.people.filters.status.all") },
    { id: "active", label: t("access.people.status.active") },
    { id: "inactive", label: t("access.people.status.inactive") },
    { id: "pending", label: t("access.people.status.pending") },
  ];

  return (
    <form
      role="search"
      aria-label={t("access.people.filters.label")}
      // The search already runs as the user types: Enter in the field must not reload the page.
      onSubmit={(event) => event.preventDefault()}
      className="flex flex-wrap items-end gap-3 p-1"
    >
      <div className="w-full sm:w-95">
        <TextField
          isLabelHidden
          label={t("access.people.search.label")}
          placeholder={t("access.people.search.placeholder")}
          value={search}
          onChange={onSearchChange}
          inputRef={searchInputRef}
        />
      </div>
      <div className="w-45">
        <Select
          isLabelHidden
          label={t("access.people.filters.role.label")}
          options={roleOptions}
          value={role}
          formatValue={(selected) =>
            selected && selected.id !== ""
              ? t("access.people.filters.role.value", { value: selected.label })
              : t("access.people.filters.role.allValue")
          }
          onChange={(value) => onFilterChange("role", value)}
        />
      </div>
      <div className="w-[190px]">
        <Select
          isLabelHidden
          label={t("access.people.filters.status.label")}
          options={statusOptions}
          value={status}
          formatValue={(selected) =>
            selected && selected.id !== ""
              ? t("access.people.filters.status.value", { value: selected.label })
              : t("access.people.filters.status.allValue")
          }
          onChange={(value) => onFilterChange("status", value)}
        />
      </div>
    </form>
  );
}
