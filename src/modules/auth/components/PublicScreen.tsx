import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface PublicScreenProps {
  cardWidthClassName?: string;
  children: ReactNode;
}

export function PublicScreen({
  cardWidthClassName = "max-w-110",
  children,
}: PublicScreenProps): ReactElement {
  const { t } = useTranslation("auth");

  // O fundo `fixed` fica aqui, e não no `PublicLayout`: ele também serve à pré-inscrição.
  return (
    <div className="fixed inset-0 overflow-y-auto bg-tedi-sky text-tedi-sky-foreground">
      <div className="flex min-h-full flex-col items-center justify-center gap-6 p-4">
        <div
          className={`flex w-full ${cardWidthClassName} flex-col gap-5 rounded-3xl bg-surface p-8 text-foreground shadow-surface`}
        >
          {/* TODO: wordmark provisório em texto até o designer entregar o SVG do logo. */}
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
