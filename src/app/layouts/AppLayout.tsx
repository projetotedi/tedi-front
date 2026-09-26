import { Outlet } from "react-router-dom";

import { HeaderTitleProvider } from "@shared/hooks/header-title";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

/**
 * Layout da área autenticada: menu lateral, cabeçalho com o título da página e o menu de perfil,
 * e o conteúdo da rota. O menu é montado a partir dos itens que os módulos declaram. Nesta versão
 * (GUS-87) a sidebar tem só o item de Membros; o menu completo por perfil e a remoção da página
 * inicial provisória são da GUS-86.
 */
export function AppLayout() {
  return (
    <HeaderTitleProvider>
      <div className="flex min-h-screen flex-col bg-tedi-page lg:flex-row">
        <AppSidebar />
        {/* `min-w-0`: sem ele a tabela larga esticaria a coluna em vez de rolar dentro do cartão. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          {/* Coluna flex: telas que ocupam o espaço todo (a 403, centralizada) usam `flex-1`. */}
          <main className="flex flex-1 flex-col px-4 py-6 lg:px-6 lg:py-9 3xl:px-25">
            <Outlet />
          </main>
        </div>
      </div>
    </HeaderTitleProvider>
  );
}
