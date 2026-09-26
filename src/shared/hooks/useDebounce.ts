import { useEffect, useState } from "react";

/**
 * Devolve `value` só depois de `delayMs` sem mudanças: cada mudança reinicia a espera. Serve
 * para não disparar uma requisição a cada tecla digitada em um campo de busca.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
