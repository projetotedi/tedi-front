import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { queryClient } from "@api/query-client";
import { ToastProvider } from "@shared/ui";

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
  const { t } = useTranslation();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastProvider regionLabel={t("toast.region")} closeLabel={t("toast.close")} />
    </QueryClientProvider>
  );
}
