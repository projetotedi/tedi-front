import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { can, type Permission } from "@shared/lib/permissions";

import { useAuth } from "../hooks/useAuth";
import { buildLoginPath } from "../lib/return-to";
import { ForbiddenPage } from "../pages/ForbiddenPage";

export interface RequirePermissionProps {
  /** Permissão exigida; deve bater com o `MenuItem.permission` da rota e com o `@RequirePermission` do back. */
  permission: Permission;
  /** Conteúdo protegido. Omitido = renderiza <Outlet /> (uso como rota-layout). */
  children?: ReactNode;
}

/**
 * Protege uma rota (ou subárvore) por permissão. Ordem de decisão:
 * 1. sessão carregando → mensagem de carregamento, sem redirecionar nem renderizar o filho;
 * 2. anônimo → /login?returnTo=<rota atual>;
 * 3. sem a permissão → ForbiddenPage no lugar, sem deslogar e sem trocar a URL (decisão 18);
 * 4. do contrário, libera o conteúdo.
 */
export function RequirePermission({ permission, children }: RequirePermissionProps): ReactElement {
  const { status, user } = useAuth();
  const { t } = useTranslation("auth");
  const location = useLocation();

  if (status === "loading") {
    return <p role="status">{t("session.loading")}</p>;
  }

  if (status === "anonymous") {
    return <Navigate to={buildLoginPath(location)} replace />;
  }

  if (!can(user, permission)) {
    return <ForbiddenPage />;
  }

  return <>{children ?? <Outlet />}</>;
}
