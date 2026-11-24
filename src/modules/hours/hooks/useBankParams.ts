import { useSearchParams } from "react-router-dom";

import { resolvePeriod } from "../lib/bank-period";

/**
 * What the Banco de horas keeps in the URL: the month (`?period=AAAA-MM`) and the member of the view
 * (`?member=<personId>`, absent in the view of everyone). A new month replaces the entry of the
 * history; opening or closing a member pushes one, so the Back of the browser returns to Todos. The
 * other parameters stay.
 */
export function useBankParams() {
  const [params, setParams] = useSearchParams();
  const period = resolvePeriod(params.get("period"));
  const memberParam = params.get("member");
  const memberId = memberParam === null || memberParam === "" ? null : memberParam;

  function update(change: (next: URLSearchParams) => void, replace: boolean) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        change(next);
        return next;
      },
      { replace },
    );
  }

  return {
    period,
    memberId,
    setPeriod: (next: string) => update((current) => current.set("period", next), true),
    openMember: (personId: string) => update((current) => current.set("member", personId), false),
    closeMember: () => update((current) => current.delete("member"), false),
  };
}
