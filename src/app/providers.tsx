import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@api/query-client";

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Providers globais da aplicação. Provider de sessão (módulo auth) entra aqui
 * quando o módulo existir. i18n é inicializado por import em main.tsx.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
