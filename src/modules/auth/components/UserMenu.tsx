import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import chevronDownMutedUrl from "@shared/assets/icons/chevron-down-muted.svg";
import { getInitials } from "@shared/lib/initials";
import { Menu } from "@shared/ui";

import { useAuth } from "../hooks/useAuth";

/**
 * Menu de perfil do cabeçalho: avatar com as iniciais, o nome de quem está logado ("Beatriz
 * Nunes", como no frame do 403) e, ao abrir, a ação "Sair". Nada sem sessão ativa (telas públicas
 * ou sessão ainda carregando).
 */
export function UserMenu(): ReactElement | null {
  const { status, user, signOut } = useAuth();
  const { t } = useTranslation("auth");

  if (status !== "authenticated" || !user) return null;

  const initials = getInitials(user.name);

  return (
    <Menu
      triggerLabel={t("userMenu.trigger", { name: user.name })}
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
          <span className="text-base font-medium">{user.name}</span>
          <img src={chevronDownMutedUrl} alt="" aria-hidden="true" width={16} height={16} />
        </>
      }
    />
  );
}
