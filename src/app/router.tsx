import { createBrowserRouter, Navigate } from "react-router-dom";

import { authProtectedRoutes, authRoutes, AuthProvider, RequireRole } from "@modules/auth";
import { peopleRoutes } from "@modules/people";

import { AppLayout } from "./layouts/AppLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { prototypeRoutes } from "./prototype-routes";

/**
 * Única composição de rotas da aplicação.
 *
 * Cada módulo em src/modules/<modulo>/ exporta suas rotas em `routes.tsx`
 * (re-exportadas pelo index.ts do módulo). Aqui elas só são concatenadas, e o item de
 * menu de cada uma entra em `app/menu.ts`.
 *
 * Rotas públicas (login, formulário de pré-inscrição) ficam sob PublicLayout;
 * o restante sob AppLayout, atrás de RequireRole (só exige sessão ativa; cada
 * rota que precisar de um perfil mínimo usa `<RequireRole minRole={...}>` por dentro).
 * Rotas autenticadas declaram `handle: { title }`, que vira o título da topbar.
 * `prototypeRoutes` são as áreas do protótipo ainda sem módulo ("Em breve").
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
              // Após o login, a tela padrão é "Meu perfil".
              { index: true, element: <Navigate to="/profile" replace /> },
              ...peopleRoutes,
              ...prototypeRoutes,
              ...authProtectedRoutes,
              { path: "*", element: <Navigate to="/" replace /> },
            ],
          },
        ],
      },
    ],
  },
]);
