import type { RouteObject } from "react-router-dom";

import { Role } from "@shared/lib/role";
import type { RouteHandle } from "@shared/lib/route-handle";

import { RequireRole } from "./components/RequireRole";
import { AccessPage } from "./pages/AccessPage";
import { InvitePage } from "./pages/InvitePage";
import { LoginPage } from "./pages/LoginPage";

/** Rotas públicas do módulo, montadas sob PublicLayout em app/router.tsx. */
export const authRoutes: RouteObject[] = [
  { path: "login", element: <LoginPage /> },
  { path: "invite", element: <InvitePage /> },
  // O back gera /invite?token=... (cadastro) e /reset-password?token=... (senha): mesma página.
  { path: "reset-password", element: <InvitePage /> },
];

/**
 * Rotas autenticadas do módulo, montadas sob AppLayout em app/router.tsx.
 * `/members` é o item "Membros e Planejamento" do protótipo do Figma: a gestão de acessos
 * (GUS-87) é a tela real por trás dele, não uma rota separada.
 */
export const authProtectedRoutes: RouteObject[] = [
  {
    path: "members",
    handle: { title: "common:nav.members" } satisfies RouteHandle,
    element: (
      <RequireRole minRole={Role.coordinator}>
        <AccessPage />
      </RequireRole>
    ),
  },
];
