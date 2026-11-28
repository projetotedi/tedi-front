import { createBrowserRouter, Navigate } from "react-router-dom";

import { assignmentsRoutes } from "@modules/assignments";
import { authRoutes, AuthProvider, createAuthProtectedRoutes, RequireRole } from "@modules/auth";
import { createCatalogRoutes } from "@modules/catalog";
import { createPeopleRoutes } from "@modules/people";
import { createClassesRoutes } from "@modules/classes";
import { hoursRoutes } from "@modules/hours";
import { createLessonsRoutes } from "@modules/lessons";

import { authRouteSlots } from "./auth-slots";
import { catalogRouteSlots } from "./catalog-slots";
import { classesRouteSlots } from "./classes-slots";
import { lessonsRouteSlots } from "./lessons-slots";
import { peopleRouteSlots } from "./people-slots";
import { AppLayout } from "./layouts/AppLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { prototypeRoutes } from "./prototype-routes";

/**
 * Única composição de rotas da aplicação.
 *
 * Cada módulo em src/modules/<modulo>/ exporta suas rotas em `routes.tsx`
 * (re-exportadas pelo index.ts do módulo). Aqui elas só são concatenadas, e o item de
 * menu de cada uma entra em `app/menu.ts`. O `catalog`, o `classes`, o `lessons`, o `people` e o `auth` são a exceção: cada
 * um exporta uma fábrica (`createCatalogRoutes`, `createClassesRoutes`, `createLessonsRoutes`, `createPeopleRoutes`,
 * `createAuthProtectedRoutes`) que recebe os slots com o que as telas dele pedem a outros módulos (`catalog-slots.tsx`,
 * hoje o card "Turmas deste curso" do `classes`; `classes-slots.tsx`, hoje o "+ Nova aula" do `lessons`;
 * `lessons-slots.tsx`, hoje a chamada do `attendance`;
 * `people-slots.tsx`, hoje as horas do Meu perfil, do `hours`; `auth-slots.tsx`, hoje Editar membro e
 * Inativar membro, do `people`, na lista de Membros).
 *
 * Rotas públicas (login, formulário de pré-inscrição) ficam sob PublicLayout;
 * o restante sob AppLayout, atrás de RequireRole (só exige sessão ativa; cada rota que
 * dependa de permissão usa `<RequirePermission permission="...">` por dentro, com a mesma
 * permissão do `MenuItem`).
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
              ...createPeopleRoutes(peopleRouteSlots),
              ...createCatalogRoutes(catalogRouteSlots),
              ...createClassesRoutes(classesRouteSlots),
              ...createLessonsRoutes(lessonsRouteSlots),
              ...assignmentsRoutes,
              ...hoursRoutes,
              ...prototypeRoutes,
              ...createAuthProtectedRoutes(authRouteSlots),
              { path: "*", element: <Navigate to="/" replace /> },
            ],
          },
        ],
      },
    ],
  },
]);
