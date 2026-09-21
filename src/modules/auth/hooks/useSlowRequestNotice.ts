import { useEffect, useState } from "react";

export const SLOW_NOTICE_DELAY_MS = 3000;

export function useSlowRequestNotice(isPending: boolean, delayMs = SLOW_NOTICE_DELAY_MS): boolean {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isPending) return;

    const timer = setTimeout(() => setIsSlow(true), delayMs);

    return () => {
      clearTimeout(timer);
      setIsSlow(false);
    };
  }, [isPending, delayMs]);

  // `isPending &&` evita mostrar o aviso no render entre o fim da requisição e a limpeza do efeito.
  return isPending && isSlow;
}
