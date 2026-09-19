import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { type Role, roleSatisfies } from "@shared/lib/role";

import { useAuth } from "../hooks/useAuth";
import { buildLoginPath } from "../lib/return-to";
import { ForbiddenPage } from "../pages/ForbiddenPage";

export interface RequireRoleProps {
  /** Perfil mínimo (member < director < coordinator < superadmin). Omitido = exige apenas sessão ativa. */
  minRole?: Role;
  /** Conteúdo protegido. Omitido = renderiza <Outlet /> (uso como rota-layout). */
  children?: ReactNode;
}

/**
 * Protege uma rota (ou subárvore) pela hierarquia de perfil. Ordem de decisão:
 * 1. sessão carregando → mensagem de carregamento, sem redirecionar nem renderizar o filho;
 * 2. anônimo → /login?returnTo=<rota atual>;
 * 3. perfil insuficiente → ForbiddenPage no lugar, sem deslogar e sem trocar a URL (decisão 18);
 * 4. do contrário, libera o conteúdo.
 */
export function RequireRole({ minRole, children }: RequireRoleProps): ReactElement {
  const { status, user } = useAuth();
  const { t } = useTranslation("auth");
  const location = useLocation();

  if (status === "loading") {
    return <p role="status">{t("session.loading")}</p>;
  }

  if (status === "anonymous") {
    return <Navigate to={buildLoginPath(location)} replace />;
  }

  if (minRole && !roleSatisfies(user?.role, minRole)) {
    return <ForbiddenPage />;
  }

  return <>{children ?? <Outlet />}</>;
}
