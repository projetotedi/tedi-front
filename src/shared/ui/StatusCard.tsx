import { useEffect, useRef, type ReactNode } from "react";

export interface StatusCardProps {
  /** `success`: ícone verde com "✓". `warning`: ícone âmbar com "!". */
  variant: "success" | "warning";
  title: string;
  description: ReactNode;
  /** Ação abaixo do texto (em geral um `Button` de largura total). */
  children?: ReactNode;
  /**
   * Anuncia o título e a descrição na hora (`role="alert"`), para o que a pessoa precisa saber
   * já (ex.: link inválido). A ação em `children` fica fora da região anunciada.
   */
  isAlert?: boolean;
  /**
   * Nível do título: 1 quando o cartão é a tela inteira (não há outro título na página) e 2, o
   * padrão, dentro de uma página que já tem o seu.
   */
  headingLevel?: 1 | 2;
  /**
   * Leva o foco ao título ao montar. Para telas que substituem o conteúdo depois de uma ação da
   * pessoa (ex.: o cadastro concluído): o botão que ela usou sai do DOM e o foco se perderia.
   */
  autoFocus?: boolean;
}

const VARIANTS = {
  success: { glyph: "✓", className: "bg-tedi-success text-tedi-success-foreground" },
  warning: { glyph: "!", className: "bg-tedi-warning text-tedi-warning-foreground" },
} as const;

/**
 * Cartão de status de uma tela inteira: ícone redondo, título, descrição e uma ação. O ícone é um
 * glifo de texto decorativo (`aria-hidden`); o significado vem do título e da descrição. Fonte de
 * 16px na descrição.
 */
export function StatusCard({
  variant,
  title,
  description,
  children,
  isAlert = false,
  headingLevel = 2,
  autoFocus = false,
}: StatusCardProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { glyph, className } = VARIANTS[variant];
  const Heading = headingLevel === 1 ? "h1" : "h2";

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div role={isAlert ? "alert" : undefined} className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className={`flex size-14 items-center justify-center rounded-full text-2xl font-bold ${className}`}
        >
          {glyph}
        </div>
        <Heading
          ref={titleRef}
          tabIndex={autoFocus ? -1 : undefined}
          className="rounded-md text-[22px] leading-7 font-semibold text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-focus"
        >
          {title}
        </Heading>
        <p className="text-base text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}
