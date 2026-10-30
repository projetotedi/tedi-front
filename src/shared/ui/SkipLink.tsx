import type { MouseEvent } from "react";

export interface SkipLinkProps {
  /** Id do elemento que recebe o foco; se não for focável por natureza, precisa de `tabIndex={-1}`. */
  targetId: string;
  /** Texto já traduzido. */
  label: string;
}

/**
 * Visível só com o foco (`sr-only` até lá). Todo o visual vem com o prefixo `focus:`: o
 * `focus:not-sr-only` zera padding e margem, e um `px-*` sem prefixo seria desfeito por ele.
 * Fixo no canto, para aparecer sem empurrar o layout.
 */
const SKIP_LINK_CLASSES = [
  "sr-only focus:not-sr-only focus:fixed focus:top-7 focus:left-4 focus:z-50",
  "focus:min-h-11 focus:rounded-[10px] focus:border-2 focus:border-tedi-sidebar-accent focus:bg-white",
  "focus:px-3.5 focus:py-2.5 focus:text-base focus:font-semibold focus:text-tedi-sidebar-accent",
  "outline-hidden focus-visible:ring-3 focus-visible:ring-tedi-focus-ring",
].join(" ");

/**
 * "Pular para o conteúdo": deve ser o primeiro item da ordem de Tab. Ativar leva o foco ao
 * elemento alvo e não mexe na URL: o `#id` do link entraria no histórico e o roteador o leria
 * como navegação. O `href` fica como fallback, e a ação padrão é bloqueada sempre, até quando
 * o alvo não existe, para que nada mude na URL.
 */
export function SkipLink({ targetId, label }: SkipLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.getElementById(targetId)?.focus();
  }

  return (
    <a href={`#${targetId}`} onClick={handleClick} className={SKIP_LINK_CLASSES}>
      {label}
    </a>
  );
}
