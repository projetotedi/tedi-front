import type { RouteObject } from "react-router-dom";

import type { RouteHandle } from "@shared/lib/route-handle";

import { RequirePermission } from "./components/RequirePermission";
import { AccessPage, type AccessPageProps } from "./pages/AccessPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { InvitePage } from "./pages/InvitePage";
import { LoginPage } from "./pages/LoginPage";

/**
 * What the screens of `auth` take from other modules. Editar membro and Inativar membro belong to
 * `people`, which already imports `auth`: `auth` importing `people` back would close a cycle, so
 * the list of members asks for them by slot and `app/auth-slots.tsx` fills the slots.
 */
export interface AuthRouteSlots {
  /** Editar membro for a row of the list (its pencil). `onClose` takes the dialog away. */
  renderEditMemberDialog: AccessPageProps["renderEditMemberDialog"];
  /**
   * Inativar membro for a row of the list (its bin). `onDeactivated` tells the list the member was
   * deactivated, before `onClose`: the bin leaves the row, so the focus goes to the title of the
   * list instead.
   */
  renderDeactivateMemberDialog: AccessPageProps["renderDeactivateMemberDialog"];
}

/** Rotas públicas do módulo, montadas sob PublicLayout em app/router.tsx. */
export const authRoutes: RouteObject[] = [
  { path: "login", element: <LoginPage /> },
  { path: "invite", element: <InvitePage /> },
  // O back gera /invite?token=... (cadastro) e /reset-password?token=... (senha): mesma página.
  { path: "reset-password", element: <InvitePage /> },
  // Troca obrigatória no primeiro acesso (GUS-142): layout público, mas a própria página exige sessão.
  { path: "change-password", element: <ChangePasswordPage /> },
];

/**
 * Rotas autenticadas do módulo, montadas sob AppLayout em app/router.tsx.
 * `/members` é o item "Membros" do grupo Pessoas do menu: a gestão de acessos (GUS-87) é a
 * tela real por trás dele, não uma rota separada. Pede `members.list` (GUS-150): a tela lê
 * `GET /members`, que a coordenação e o diretor listam; o membro não.
 */
export function createAuthProtectedRoutes(slots: AuthRouteSlots): RouteObject[] {
  return [
    {
      path: "members",
      handle: { title: "common:nav.members" } satisfies RouteHandle,
      element: (
        <RequirePermission permission="members.list">
          <AccessPage
            renderEditMemberDialog={slots.renderEditMemberDialog}
            renderDeactivateMemberDialog={slots.renderDeactivateMemberDialog}
          />
        </RequirePermission>
      ),
    },
  ];
}
