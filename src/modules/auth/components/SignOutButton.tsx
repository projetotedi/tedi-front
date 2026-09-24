import { useTranslation } from "react-i18next";

import { Button } from "@shared/ui";

import { useAuth } from "../hooks/useAuth";

export interface SignOutButtonProps {
  /** Texto do botão; padrão "Sair" (`auth:signOut.label`). */
  label?: string;
}

/** null quando não há sessão ativa — nada a mostrar em telas públicas ou durante o carregamento. */
export function SignOutButton({ label }: SignOutButtonProps) {
  const { status, signOut } = useAuth();
  const { t } = useTranslation("auth");

  if (status !== "authenticated") return null;

  return (
    <Button
      onPress={() => {
        void signOut();
      }}
    >
      {label ?? t("signOut.label")}
    </Button>
  );
}
