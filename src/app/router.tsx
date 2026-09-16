import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppLayout } from "./layouts/AppLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { InicioPage } from "./pages/InicioPage";

/**
 * Única composição de rotas da aplicação.
 *
 * Cada módulo em src/modules/<modulo>/ exporta suas rotas em `routes.tsx`
 * (re-exportadas pelo index.ts do módulo). Aqui elas só são concatenadas:
 *
 *   import { pessoasRoutes } from "@modules/pessoas";
 *   ...
 *   children: [...pessoasRoutes, ...turmasRoutes, ...]
 *
 * Rotas públicas (login, formulário de pré-inscrição) ficam sob PublicLayout;
 * o restante sob AppLayout, que exigirá sessão quando o módulo auth existir.
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      // ...authRoutes (login) entram aqui
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <InicioPage /> },
      // ...pessoasRoutes, ...turmasRoutes, ...aulasRoutes, ...alocacoesRoutes,
      // ...presencasRoutes, ...horasRoutes, ...importacaoRoutes, ...relatoriosRoutes, ...auditoriaRoutes
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
