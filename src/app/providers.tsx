import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@api/query-client";

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Providers globais da aplicação. AuthProvider (módulo auth) NÃO entra aqui: ele
 * precisa de useNavigate/useLocation, que só existem dentro do RouterProvider — por
 * isso é montado em app/router.tsx, como rota-layout raiz. i18n é inicializado por
 * import em main.tsx.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
