import { createBrowserRouter, Navigate } from "react-router-dom";

import { authRoutes, AuthProvider, RequireRole } from "@modules/auth";

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
 * o restante sob AppLayout, atrás de RequireRole (só exige sessão ativa; cada
 * rota que precisar de um perfil mínimo usa `<RequireRole minRole={...}>` por dentro).
 *
 * AuthProvider entra como rota-layout raiz (e não em app/providers.tsx) porque precisa de
 * useNavigate/useLocation, que só existem dentro do RouterProvider.
 */
export const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    children: [
      {
        element: <PublicLayout />,
        children: [...authRoutes],
      },
      {
        element: <RequireRole />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <InicioPage /> },
              // ...pessoasRoutes, ...turmasRoutes, ...aulasRoutes, ...alocacoesRoutes,
              // ...presencasRoutes, ...horasRoutes, ...importacaoRoutes, ...relatoriosRoutes, ...auditoriaRoutes
              { path: "*", element: <Navigate to="/" replace /> },
            ],
          },
        ],
      },
    ],
  },
]);
