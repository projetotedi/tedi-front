import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@modules/auth";
import { Avatar, Dropdown } from "@shared/ui";

/** Canto direito da topbar: avatar + perfil; o menu mostra o nome e leva ao Perfil ou a Sair. */
export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!user) return null;

  const role = t(`roles.${user.role}`);

  return (
    <Dropdown
      label={t("layout.profileMenu.label", { name: user.name })}
      trigger={
        <>
          <Avatar name={user.name} />
          <span className="font-medium">{role}</span>
        </>
      }
      header={
        <>
          <p className="font-semibold">{user.name}</p>
          <p className="text-muted">{role}</p>
        </>
      }
      items={[
        { id: "profile", label: t("layout.profileMenu.profile") },
        { id: "signOut", label: t("layout.profileMenu.signOut") },
      ]}
      onAction={(id) => {
        if (id === "profile") navigate("/profile");
        if (id === "signOut") void signOut();
      }}
    />
  );
}
