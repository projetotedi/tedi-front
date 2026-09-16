import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * Layout da área autenticada. O menu é montado a partir das rotas dos módulos
 * e filtrado pelo perfil do usuário quando o módulo auth existir.
 */
export function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">{t("app.name")}</h1>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
