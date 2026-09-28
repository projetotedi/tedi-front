import type { RouteObject } from "react-router-dom";

import { Role } from "@shared/lib/role";
import type { RouteHandle } from "@shared/lib/route-handle";

import { RequireRole } from "./components/RequireRole";
import { AccessPage } from "./pages/AccessPage";
import { InvitePage } from "./pages/InvitePage";
import { LoginPage } from "./pages/LoginPage";

/**
 * Rotas públicas do módulo, montadas sob PublicLayout em app/router.tsx.
 * Rotas autenticadas do módulo (tela de Acessos, GUS-87) entram depois em um export
 * separado (authProtectedRoutes) — authRoutes continua significando "área pública".
 */
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
    handle: { title: "auth:access.title" } satisfies RouteHandle,
    element: (
      <RequireRole minRole={Role.coordinator}>
        <AccessPage />
      </RequireRole>
    ),
  },
];
