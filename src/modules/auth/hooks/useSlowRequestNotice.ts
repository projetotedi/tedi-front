import { useEffect, useState } from "react";

/** Tempo sem resposta a partir do qual a tela avisa que o servidor pode estar acordando (Render). */
export const SLOW_NOTICE_DELAY_MS = 3000;

/**
 * `true` quando `isPending` fica ligado por mais de `delayMs` sem resposta; volta a `false` assim
 * que a requisição termina (sucesso ou erro). O timer é cancelado quando a requisição termina e
 * quando o componente desmonta.
 */
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
