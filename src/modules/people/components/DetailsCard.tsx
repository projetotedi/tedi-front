import type { ReactNode } from "react";

import { Card } from "@shared/ui";

import { EmptyValue } from "./EmptyValue";

export interface DetailsField {
  label: string;
  /** `null`, `undefined` and `""` render as a dash: the field has no value. */
  value: ReactNode;
  /** Takes the whole row (e.g. an address), whatever the number of columns. */
  wide?: boolean;
}

export type DetailsColumns = 1 | 2 | 3;

interface DetailsCardProps {
  title: string;
  fields: DetailsField[];
  footer?: ReactNode;
  /**
   * How many columns the fields use. 2 is the default, like the side cards of the profile. 3 is for
   * a card of the main column: one column on a phone, two from `sm` and three from `lg`. 1 stacks
   * the fields, for the short cards of a side column.
   */
  columns?: DetailsColumns;
}

// Whole class names, so that Tailwind can find them in the source.
const GRID_CLASS: Record<DetailsColumns, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

function hasNoValue(value: ReactNode): boolean {
  return (
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")
  );
}

/**
 * Label/value pairs in columns, like the side cards of the profile. A field with no value shows
 * the `EmptyValue`: a dash hidden from screen readers, which read a "not provided" label instead
 * (the same pattern as the dash of the hours by category table).
 */
export function DetailsCard({ title, fields, footer, columns = 2 }: DetailsCardProps) {
  return (
    <Card title={title}>
      <dl className={`grid gap-x-4 gap-y-3 ${GRID_CLASS[columns]}`}>
        {fields.map((field) => (
          <div key={field.label} className={field.wide ? "sm:col-span-full" : undefined}>
            <dt className="text-sm font-medium text-muted uppercase">{field.label}</dt>
            <dd className="break-words">
              {hasNoValue(field.value) ? <EmptyValue /> : field.value}
            </dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-4">{footer}</div>}
    </Card>
  );
}
