import type { RouteObject } from "react-router-dom";

import { Role } from "@shared/lib/role";

import { RequireRole } from "./components/RequireRole";
import { InvitePage } from "./pages/InvitePage";
import { LoginPage } from "./pages/LoginPage";

/** Rotas públicas do módulo, montadas sob PublicLayout em app/router.tsx. */
export const authRoutes: RouteObject[] = [
  { path: "login", element: <LoginPage /> },
  { path: "invite", element: <InvitePage /> },
  // O back gera /invite?token=... (cadastro) e /reset-password?token=... (senha): mesma página.
  { path: "reset-password", element: <InvitePage /> },
];

/** Rotas autenticadas do módulo, montadas sob AppLayout em app/router.tsx. */
export const authProtectedRoutes: RouteObject[] = [
  {
    path: "access",
    element: <RequireRole minRole={Role.coordinator} />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { AccessPage } = await import("./pages/AccessPage");
          return { Component: AccessPage };
        },
      },
    ],
  },
];
