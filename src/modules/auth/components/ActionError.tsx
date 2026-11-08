import { useEffect, useRef, type ReactElement } from "react";

import { Alert } from "@shared/ui";

export interface ActionErrorProps {
  /** Mensagem já traduzida da última tentativa; `null` quando não há falha. */
  message: string | null;
}

/**
 * Falha de uma ação dentro de um diálogo: alerta de erro (`role="alert"`, anunciado na hora) e o
 * foco levado até ele, para quem usa teclado não ficar no botão que acabou de falhar sem saber.
 */
export function ActionError({ message }: ActionErrorProps): ReactElement | null {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);

  if (!message) return null;

  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <Alert variant="error">{message}</Alert>
    </div>
  );
}
