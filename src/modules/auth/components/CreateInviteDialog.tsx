import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Button, Dialog } from "@shared/ui";

import { CreateInviteForm } from "./CreateInviteForm";

/**
 * Botão "Gerar link de cadastro" + diálogo de criação. O conteúdo (`CreateInviteForm`) só existe
 * enquanto o diálogo está aberto: fechar desmonta o formulário, e com ele o link gerado —
 * reabrir nunca mostra o link de novo. O foco volta ao botão ao fechar (React Aria).
 *
 * Enquanto o POST /invites está em andamento, o diálogo não pode ser fechado por Esc ou pelo X
 * (ver `isDismissable` em `CreateInviteForm.onPendingChange`): fechar não cancela a mutação, só
 * esconderia o link antes de ele aparecer, deixando um convite pendente "órfão" no back.
 */
export function CreateInviteDialog(): ReactElement {
  const { t } = useTranslation("auth");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <Button
        variant="tertiary"
        className="rounded-3xl px-4"
        onPress={() => {
          setIsSubmitting(false);
          setIsOpen(true);
        }}
      >
        {t("access.createInvite.trigger")}
      </Button>
      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t("access.createInvite.title")}
        description={t("access.createInvite.description")}
        closeLabel={t("access.createInvite.close")}
        isDismissable={!isSubmitting}
      >
        {isOpen ? (
          <CreateInviteForm onDone={() => setIsOpen(false)} onPendingChange={setIsSubmitting} />
        ) : null}
      </Dialog>
    </>
  );
}
