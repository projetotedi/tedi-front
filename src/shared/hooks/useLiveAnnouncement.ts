import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveAnnouncement {
  /** O texto da região viva (`role="status"`). Fica vazio entre uma mensagem e a seguinte. */
  message: string;
  /** Diz `message` aos leitores de tela, mesmo que seja igual à anterior. */
  announce: (message: string) => void;
}

/**
 * Texto para uma região viva. O leitor de tela lê a região quando o texto dela muda, e a mesma
 * mensagem duas vezes seguidas não muda nada: um plano que volta, por outro caminho, ao lugar
 * onde acabou de ser anunciado e é movido de novo para o mesmo lugar ficaria em silêncio. Por isso
 * cada mensagem esvazia a região e só a preenche um quadro depois, e assim toda mensagem é uma
 * mudança. Duas mensagens no mesmo quadro deixam só a última.
 */
export function useLiveAnnouncement(): LiveAnnouncement {
  const [message, setMessage] = useState("");
  const frameRef = useRef<number | null>(null);

  const cancelFrame = useCallback(() => {
    if (frameRef.current === null) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const announce = useCallback(
    (next: string) => {
      cancelFrame();
      setMessage("");
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setMessage(next);
      });
    },
    [cancelFrame],
  );

  useEffect(() => cancelFrame, [cancelFrame]);

  return { message, announce };
}
