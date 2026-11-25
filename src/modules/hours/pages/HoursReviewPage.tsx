import type { ReactElement } from "react";

import { PendingEntriesTable } from "../components/PendingEntriesTable";

const WHOLE_QUEUE = {};

/**
 * "Validação de horas" (`/hours/review`, `hours.review`): the whole queue of pending entries, with
 * no period, twenty by page, with the same block the Banco de horas shows (the Figma draws no frame
 * for this route). The title (h1) comes from the route.
 */
export function HoursReviewPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PendingEntriesTable filter={WHOLE_QUEUE} />
    </div>
  );
}
