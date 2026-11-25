import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "../ui/Card";

export interface DetailsField {
  label: string;
  /** `null`, `undefined` and `""` render as a dash: the field has no value. A `0` is a value. */
  value: ReactNode;
  /** Takes the whole row of a card with `columns={4}` (a long value). Has no effect with one column. */
  fullWidth?: boolean;
}

export interface DetailsCardProps {
  title: string;
  fields: DetailsField[];
  /**
   * `1` stacks one label/value pair per line, for the cards of a side column. `4` puts four pairs
   * to a row from `md` up (one per line below it), for the data card of a main column.
   */
  columns?: 1 | 4;
  /** Content on the right of the title, such as a link. */
  aside?: ReactNode;
}

const LAYOUT = {
  1: "flex flex-col gap-4",
  4: "grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-4",
} as const;

function hasNoValue(value: ReactNode): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * A card of label/value pairs: a `<dl>` with the label in small capitals and the value under it.
 * The label is 12px and the value 16px (the Figma asks for 10px and 14px, but the AGENTS.md
 * accessibility rules, a base font of 16px, win).
 *
 * It is the one place that decides what shows when a value is missing: a dash for who sees it and
 * "Não informado" for who hears it, since a lone dash is read as "dash" or not read at all. The
 * screens hand it the value as it came from the API (`null` included) and never write their own
 * placeholder. It does not know the domain: the caller gives the title, the labels and the values
 * already translated and formatted.
 */
export function DetailsCard({ title, fields, columns = 1, aside }: DetailsCardProps): ReactElement {
  const { t } = useTranslation("common");

  return (
    <Card title={title} aside={aside}>
      <dl className={LAYOUT[columns]}>
        {fields.map((field) => (
          <div
            key={field.label}
            className={field.fullWidth && columns === 4 ? "md:col-span-4" : undefined}
          >
            <dt className="text-xs font-semibold text-muted uppercase">{field.label}</dt>
            <dd className="mt-1 text-base break-words">
              {hasNoValue(field.value) ? (
                <>
                  <span aria-hidden="true">{t("details.empty")}</span>
                  <span className="sr-only">{t("details.notInformed")}</span>
                </>
              ) : (
                field.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
