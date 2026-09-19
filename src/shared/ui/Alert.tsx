import { Alert as HeroAlert } from "@heroui/react";
import type { ReactNode } from "react";

export interface AlertProps {
  /**
   * `error`: falha que a pessoa precisa saber já (`role="alert"`, anunciada na hora).
   * `info`: aviso sem urgência, numa região `role="status"` (`aria-live="polite"`) que fica
   * SEMPRE montada, vazia enquanto não há aviso. Leitores de tela (NVDA/JAWS) só anunciam mudanças
   * em regiões vivas que já estavam no DOM; uma região que nasce já preenchida não é anunciada.
   */
  variant: "error" | "info";
  /**
   * Sem conteúdo, `error` não renderiza nada (uma região `alert` vazia confundiria leitores de
   * tela); `info` mantém a região vazia, fora do fluxo do layout, até o texto chegar.
   */
  children?: ReactNode;
  id?: string;
}

const VARIANTS = {
  error: { status: "danger", className: "border border-danger bg-danger-soft" },
  info: { status: "accent", className: "border border-accent bg-accent-soft" },
} as const;

function isEmpty(children: ReactNode): boolean {
  return children === null || children === undefined || children === false || children === "";
}

/** Aviso do TEDI sobre o Alert do HeroUI: texto de 16px, ícone decorativo e região ARIA por variante. */
export function Alert({ variant, children, id }: AlertProps) {
  const { status, className } = VARIANTS[variant];
  const isError = variant === "error";

  const box = isEmpty(children) ? null : (
    <HeroAlert
      id={isError ? id : undefined}
      status={status}
      role={isError ? "alert" : undefined}
      className={`rounded-xl ${className}`}
    >
      <HeroAlert.Indicator aria-hidden="true" />
      <HeroAlert.Content>
        <HeroAlert.Title className="text-base">{children}</HeroAlert.Title>
      </HeroAlert.Content>
    </HeroAlert>
  );

  if (isError) return box;

  // Vazia, a região sai do fluxo (`sr-only`: absoluta, 1px, recortada) e por isso não ocupa
  // espaço nem cria gap num pai flex. Nunca `display: none`/`hidden`: isso a tira da árvore de
  // acessibilidade e o texto que chegar depois deixa de ser anunciado. Com o texto, `:empty` deixa
  // de valer e ela volta ao fluxo normal. A caixa visual dentro dela não tem role próprio, para
  // não aninhar duas regiões vivas.
  return (
    <div id={id} role="status" aria-live="polite" className="empty:sr-only">
      {box}
    </div>
  );
}
