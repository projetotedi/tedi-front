import type { ReactElement } from "react";

import { Skeleton } from "@shared/ui";

export interface LoadingPlaceholderProps {
  /** What a screen reader says while the content is on its way (the skeleton is only for who sees). */
  label: string;
}

/**
 * The loading state of the cards of the module that ask the API by themselves ("Turmas deste curso"
 * and "Curso de origem"): three rows of skeleton under the title of the card, announced as a status.
 */
export function LoadingPlaceholder({ label }: LoadingPlaceholderProps): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-3">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}
