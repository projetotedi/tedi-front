import { useSearchParams } from "react-router-dom";

import { resolvePeriod } from "../lib/bank-period";

/**
 * What the Banco de horas keeps in the URL: the month (`?period=AAAA-MM`). A new month replaces the
 * entry of the history; the other parameters stay.
 */
export function useBankParams() {
  const [params, setParams] = useSearchParams();
  const period = resolvePeriod(params.get("period"));

  function setPeriod(next: string) {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set("period", next);
        return updated;
      },
      { replace: true },
    );
  }

  return { period, setPeriod };
}
