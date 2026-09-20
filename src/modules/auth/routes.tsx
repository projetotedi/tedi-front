import type { RouteObject } from "react-router-dom";

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
