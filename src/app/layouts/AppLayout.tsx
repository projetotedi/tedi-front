import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { SignOutButton } from "@modules/auth";

/**
 * Layout da área autenticada. O menu é montado a partir das rotas dos módulos
 * e filtrado pelo perfil do usuário quando o módulo auth existir.
 * Cabeçalho com nome/perfil do usuário e menu recolhível são GUS-86; aqui só o botão sair.
 */
export function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("app.name")}</h1>
        <SignOutButton />
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
