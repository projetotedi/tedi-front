import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Select, TextField, type SelectOption } from "@shared/ui";

import { isRoleFilter, isStatusFilter, type AccessFilterValues } from "../lib/access-filters";
import { INVITABLE_ROLES, roleLabelKey } from "../lib/role-label";

export interface AccessFiltersProps {
  value: AccessFilterValues;
  onChange: (next: AccessFilterValues) => void;
}

/**
 * Busca por nome ou RA e filtros de Papel e Status da lista de membros. Sem estado próprio: os
 * valores vêm de `AccessPage`, que decide quando buscar (a busca é ao vivo, com debounce).
 * O rótulo dos três controles fica oculto só visualmente, como no Figma: o gatilho do select
 * já mostra o valor contextualizado ("Papel: todos") e o campo de busca tem placeholder.
 */
export function AccessFilters({ value, onChange }: AccessFiltersProps): ReactElement {
  const { t } = useTranslation("auth");

  const roleOptions: SelectOption[] = [
    { id: "all", label: t("access.people.filters.role.all") },
    ...INVITABLE_ROLES.map((role) => ({ id: role, label: t(roleLabelKey(role) ?? "") })),
  ];
  const statusOptions: SelectOption[] = [
    { id: "all", label: t("access.people.filters.status.all") },
    { id: "active", label: t("access.people.status.active") },
    { id: "inactive", label: t("access.people.status.inactive") },
  ];

  return (
    <form
      role="search"
      aria-label={t("access.people.filters.label")}
      // A busca já roda ao digitar: Enter no campo não deve recarregar a página.
      onSubmit={(event) => event.preventDefault()}
      className="flex flex-wrap items-end gap-3 p-1"
    >
      <div className="w-full sm:w-95">
        <TextField
          isLabelHidden
          label={t("access.people.search.label")}
          placeholder={t("access.people.search.placeholder")}
          value={value.search}
          onChange={(search) => onChange({ ...value, search })}
        />
      </div>
      <div className="w-45">
        <Select
          isLabelHidden
          label={t("access.people.filters.role.label")}
          options={roleOptions}
          value={value.role}
          formatValue={(selected) =>
            selected && selected.id !== "all"
              ? t("access.people.filters.role.value", { value: selected.label })
              : t("access.people.filters.role.allValue")
          }
          onChange={(role) => {
            if (isRoleFilter(role)) onChange({ ...value, role });
          }}
        />
      </div>
      <div className="w-[190px]">
        <Select
          isLabelHidden
          label={t("access.people.filters.status.label")}
          options={statusOptions}
          value={value.status}
          formatValue={(selected) =>
            selected && selected.id !== "all"
              ? t("access.people.filters.status.value", { value: selected.label })
              : t("access.people.filters.status.allValue")
          }
          onChange={(status) => {
            if (isStatusFilter(status)) onChange({ ...value, status });
          }}
        />
      </div>
    </form>
  );
}
