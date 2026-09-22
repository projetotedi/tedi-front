import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Button, Dialog } from "@shared/ui";

import { CreateInviteForm } from "./CreateInviteForm";

export interface CreateInviteDialogProps {
  onCreated?: () => void;
}

/**
 * Botão "Gerar convite" + diálogo de criação. O conteúdo (`CreateInviteForm`) só existe
 * enquanto o diálogo está aberto: fechar desmonta o formulário, e com ele o link gerado —
 * reabrir nunca mostra o link de novo. O foco volta ao botão ao fechar (React Aria).
 */
export function CreateInviteDialog({ onCreated }: CreateInviteDialogProps): ReactElement {
  const { t } = useTranslation("auth");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onPress={() => setIsOpen(true)}>{t("access.createInvite.trigger")}</Button>
      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t("access.createInvite.title")}
        description={t("access.createInvite.description")}
        closeLabel={t("access.createInvite.close")}
      >
        {isOpen ? <CreateInviteForm onCreated={onCreated} onDone={() => setIsOpen(false)} /> : null}
      </Dialog>
    </>
  );
}
