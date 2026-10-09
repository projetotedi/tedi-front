import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Dialog } from "@shared/ui";

import { INVITE_VALIDITY_HOURS } from "../lib/invite-validity";

/** Só orienta: sem recuperação automática por e-mail, quem gera o link de redefinição é a coordenação. */
export function ForgotPasswordDialog(): ReactElement {
  const { t } = useTranslation("auth");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          className="px-0 text-accent"
          onPress={() => setIsOpen(true)}
        >
          {t("login.forgotPassword")}
        </Button>
      </div>
      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t("forgotPassword.title")}
        description={t("forgotPassword.description")}
        closeLabel={t("forgotPassword.close")}
        footer={<Button onPress={() => setIsOpen(false)}>{t("forgotPassword.confirm")}</Button>}
      >
        <Alert variant="warning">
          {t("forgotPassword.notice", { hours: INVITE_VALIDITY_HOURS })}
        </Alert>
      </Dialog>
    </>
  );
}
