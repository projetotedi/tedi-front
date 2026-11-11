import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

export interface DetailsField {
  label: string;
  /** `null`, `undefined` and `""` render as a dash: the field has no value. */
  value: ReactNode;
  /** Ocupa as duas colunas (ex.: endereço). */
  wide?: boolean;
}

interface DetailsCardProps {
  title: string;
  fields: DetailsField[];
  footer?: ReactNode;
}

function hasNoValue(value: ReactNode): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Label/value pairs in two columns, like the side cards of the profile. It is the only place that
 * decides what shows when a value is missing: a dash hidden from screen readers, which read a
 * "not provided" label instead (the same pattern as the dash of the hours by category table).
 */
export function DetailsCard({ title, fields, footer }: DetailsCardProps) {
  const { t } = useTranslation("people");

  return (
    <Card title={title}>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className={field.wide ? "sm:col-span-2" : undefined}>
            <dt className="text-sm font-medium text-muted uppercase">{field.label}</dt>
            <dd className="break-words">
              {hasNoValue(field.value) ? (
                <>
                  <span aria-hidden="true">{t("profile.empty")}</span>
                  <span className="sr-only">{t("profile.notProvided")}</span>
                </>
              ) : (
                field.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-4">{footer}</div>}
    </Card>
  );
}
