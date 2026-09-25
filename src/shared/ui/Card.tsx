import { Card as HeroCard } from "@heroui/react";
import type { ReactNode } from "react";

export interface CardProps {
  /** Título do cartão, renderizado como `<h2>` (o `<h1>` é o título da página na topbar). */
  title?: ReactNode;
  /** Conteúdo à direita do título (link, período). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, aside, children, className = "" }: CardProps) {
  return (
    <HeroCard className={`gap-4 rounded-2xl p-6 ${className}`}>
      {(title || aside) && (
        <HeroCard.Header className="flex flex-row flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {aside}
        </HeroCard.Header>
      )}
      <HeroCard.Content>{children}</HeroCard.Content>
    </HeroCard>
  );
}
