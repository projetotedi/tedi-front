import { Outlet } from "react-router-dom";

import { HeaderTitleProvider } from "@shared/hooks/header-title";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  return (
    <HeaderTitleProvider>
      <div className="flex min-h-screen flex-col bg-tedi-page lg:flex-row">
        <AppSidebar />
        {/* `min-w-0`: sem ele a tabela larga esticaria a coluna em vez de rolar dentro do cartão. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex flex-1 flex-col px-4 py-6 lg:px-6 lg:py-9 3xl:px-25">
            <Outlet />
          </main>
        </div>
      </div>
    </HeaderTitleProvider>
  );
}
