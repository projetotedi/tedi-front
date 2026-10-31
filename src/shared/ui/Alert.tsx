import { Alert as HeroAlert } from "@heroui/react";
import type { ReactNode } from "react";

export interface AlertProps {
  /**
   * `info` fica sempre montado e vazio: leitores de tela não anunciam uma região viva que nasce
   * preenchida. `warning` e `danger` são estáticas (sem `role` nem região viva): nascem já
   * preenchidas junto com o conteúdo que avisam, e o anúncio vem do foco que se move para perto
   * delas. `danger` tem o visual de `error`, mas é aviso permanente de uma ação destrutiva
   * (ex.: "Desativar acesso"), não uma falha: quem avisa de falha é `error`, que anuncia na hora.
   *
   * O texto principal é `children` (título, em destaque) e `description` é o complemento. Um aviso
   * de uma frase ou parágrafo longo pode vir só em `description`, sem título, em peso normal.
   */
  variant: "danger" | "error" | "info" | "warning";
  children?: ReactNode;
  description?: ReactNode;
  id?: string;
}

// A cor do texto vai na caixa e a descrição a herda: o `text-muted` do HeroUI (#71717a) dá 4,3:1 sobre
// o âmbar e 3,8:1 sobre o rosa (mínimo 4,5:1); #a43532 sobre o rosa dá 5,3:1.
const VARIANTS = {
  danger: {
    status: "danger",
    className: "border border-danger bg-danger-soft text-danger-soft-foreground",
  },
  error: {
    status: "danger",
    className: "border border-danger bg-danger-soft text-danger-soft-foreground",
  },
  info: {
    status: "accent",
    className: "border border-accent bg-accent-soft text-accent-soft-foreground",
  },
  warning: {
    status: "warning",
    className: "border border-tedi-warning-foreground bg-tedi-warning text-tedi-warning-foreground",
  },
} as const;

function isEmpty(children: ReactNode): boolean {
  return children === null || children === undefined || children === false || children === "";
}

export function Alert({ variant, children, description, id }: AlertProps) {
  const { status, className } = VARIANTS[variant];
  const isError = variant === "error";
  const isStatic = variant === "warning" || variant === "danger";

  const hasTitle = !isEmpty(children);
  const hasDescription = !isEmpty(description);

  const box =
    !hasTitle && !hasDescription ? null : (
      <HeroAlert
        id={isError || isStatic ? id : undefined}
        status={status}
        role={isError ? "alert" : undefined}
        className={`rounded-xl ${className}`}
      >
        <HeroAlert.Indicator aria-hidden="true" />
        <HeroAlert.Content>
          {hasTitle ? <HeroAlert.Title className="text-base">{children}</HeroAlert.Title> : null}
          {hasDescription ? (
            <HeroAlert.Description className="text-base text-inherit">
              {description}
            </HeroAlert.Description>
          ) : null}
        </HeroAlert.Content>
      </HeroAlert>
    );

  if (isError || isStatic) return box;

  // Vazia, sai do fluxo por `sr-only`. Nunca `display: none`: isso a tira da árvore de acessibilidade.
  return (
    <div id={id} role="status" aria-live="polite" className="empty:sr-only">
      {box}
    </div>
  );
}
