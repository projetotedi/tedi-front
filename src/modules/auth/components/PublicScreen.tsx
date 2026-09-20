import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface PublicScreenProps {
  /**
   * Largura máxima do cartão, como classe do Tailwind (ex.: `max-w-110`). Escreva a classe inteira
   * no ponto de uso: o Tailwind só gera as classes que aparecem literais no código.
   */
  cardWidthClassName?: string;
  children: ReactNode;
}

/**
 * Invólucro das telas públicas do módulo (login, aceite do convite): fundo azul, cartão branco com o
 * wordmark do TEDI e o rodapé. Os filhos entram no cartão, um sob o outro.
 *
 * O fundo cobre a janela toda (`fixed`) porque só estas telas o usam: o `PublicLayout` também serve
 * à pré-inscrição e não deve herdá-lo. `min-h-full` + `overflow-y-auto` deixam o cartão rolar em
 * telas baixas ou com zoom sem cortar o topo. É o único lugar com esse recurso.
 */
export function PublicScreen({
  cardWidthClassName = "max-w-110",
  children,
}: PublicScreenProps): ReactElement {
  const { t } = useTranslation("auth");

  return (
    <div className="fixed inset-0 overflow-y-auto bg-tedi-sky text-tedi-sky-foreground">
      <div className="flex min-h-full flex-col items-center justify-center gap-6 p-4">
        <div
          className={`flex w-full ${cardWidthClassName} flex-col gap-5 rounded-3xl bg-surface p-8 text-foreground shadow-surface`}
        >
          {/* GUS-84: aguardando o SVG do logo com o designer; wordmark provisório em texto. O PNG do
              Figma da GUS-85 traz uma caixa tracejada e um cursor dentro da própria imagem, e não foi
              confirmado com o designer se fazem parte da logo. */}
          <p className="text-center text-5xl font-black tracking-tight">
            {t("publicScreen.brand")}
          </p>
          {children}
        </div>
        <p className="text-center text-sm">{t("publicScreen.footer")}</p>
      </div>
    </div>
  );
}
