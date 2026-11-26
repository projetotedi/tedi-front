import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { buildLoginPath } from "../lib/return-to";

export interface RequireRoleProps {
  /** Conteúdo protegido. Omitido = renderiza <Outlet /> (uso como rota-layout). */
  children?: ReactNode;
}

/**
 * Guarda de sessão: só exige um usuário logado. Permissão por rota é `RequirePermission`.
 * Ordem de decisão:
 * 1. sessão carregando → mensagem de carregamento, sem redirecionar nem renderizar o filho;
 * 2. anônimo → /login?returnTo=<rota atual>;
 * 3. conta que ainda precisa trocar a senha (`mustChangePassword`, GUS-142) → /change-password,
 *    inclusive ao recarregar a página: o back recusa as outras rotas até a troca (GUS-93);
 * 4. do contrário, libera o conteúdo.
 */
export function RequireRole({ children }: RequireRoleProps): ReactElement {
  const { status, user } = useAuth();
  const { t } = useTranslation("auth");
  const location = useLocation();

  if (status === "loading") {
    return <p role="status">{t("session.loading")}</p>;
  }

  if (status === "anonymous") {
    return <Navigate to={buildLoginPath(location)} replace />;
  }

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
