import type { ReactNode } from "react";

import { Card } from "@shared/ui";

export interface DetailsField {
  label: string;
  value: ReactNode;
  /** Ocupa as duas colunas (ex.: endereço). */
  wide?: boolean;
}

interface DetailsCardProps {
  title: string;
  fields: DetailsField[];
  footer?: ReactNode;
}

/** Cartão de pares rótulo/valor em duas colunas, como os cartões laterais do perfil. */
export function DetailsCard({ title, fields, footer }: DetailsCardProps) {
  return (
    <Card title={title}>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className={field.wide ? "sm:col-span-2" : undefined}>
            <dt className="text-sm font-medium text-muted uppercase">{field.label}</dt>
            <dd className="break-words">{field.value}</dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-4">{footer}</div>}
    </Card>
  );
}
