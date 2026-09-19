import { useTranslation } from "react-i18next";

import { Button } from "@shared/ui";

import { useAuth } from "../hooks/useAuth";

/** null quando não há sessão ativa — nada a mostrar em telas públicas ou durante o carregamento. */
export function SignOutButton() {
  const { status, signOut } = useAuth();
  const { t } = useTranslation("auth");

  if (status !== "authenticated") return null;

  return (
    <Button
      onPress={() => {
        void signOut();
      }}
    >
      {t("signOut.label")}
    </Button>
  );
}
