import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import chevronDownMutedUrl from "@shared/assets/icons/chevron-down-muted.svg";
import { Menu } from "@shared/ui";

import { useAuth } from "../hooks/useAuth";
import { roleLabelKey } from "../lib/role-label";

/**
 * Menu de perfil do cabeçalho: avatar com as iniciais, o rótulo do perfil de quem está logado
 * ("Coordenadora") e, ao abrir, a ação "Sair". Nada sem sessão ativa (telas públicas ou sessão
 * ainda carregando). As iniciais são as duas primeiras letras do rótulo do perfil, como no Figma
 * ("CO"); `superadmin` aparece como Coordenadora.
 */
export function UserMenu(): ReactElement | null {
  const { status, user, signOut } = useAuth();
  const { t } = useTranslation("auth");

  if (status !== "authenticated" || !user) return null;

  const roleLabel = t(roleLabelKey(user.role) ?? "roles.member");
  const initials = roleLabel.slice(0, 2).toLocaleUpperCase("pt-BR");

  return (
    <Menu
      triggerLabel={t("userMenu.trigger", { role: roleLabel })}
      menuLabel={t("userMenu.menu")}
      items={[{ id: "sign-out", label: t("signOut.label"), onAction: () => void signOut() }]}
      trigger={
        <>
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-3xl bg-default text-xs font-medium text-tedi-avatar-foreground"
          >
            {initials}
          </span>
          <span className="text-base font-medium">{roleLabel}</span>
          <img src={chevronDownMutedUrl} alt="" aria-hidden="true" width={16} height={16} />
        </>
      }
    />
  );
}
