import { useRef, type ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useCreatePasswordReset } from "@api/generated";
import type { AccessResponseDto } from "@api/generated/model";
import { Button, Dialog } from "@shared/ui";

import { toAccessActionErrorKey } from "../lib/access-action-error";
import { invalidatePendingInvites } from "../lib/access-queries";
import { INVITE_VALIDITY_HOURS } from "../lib/invite-validity";
import { ActionError } from "./ActionError";
import { GeneratedLink } from "./GeneratedLink";
import { MemberSummary } from "./MemberSummary";

export interface PasswordResetDialogProps {
  access: AccessResponseDto;
  onClose: () => void;
}

/**
 * Gera o link de redefinição de senha de um membro. Quem usa o monta só enquanto está aberto: o
 * link vive na mutação deste componente e morre com ele, então fechar e reabrir não o mostra.
 * O POST só sai depois de "Gerar link" (a confirmação); o link novo não invalida o anterior.
 */
export function PasswordResetDialog({ access, onClose }: PasswordResetDialogProps): ReactElement {
  const { t } = useTranslation("auth");
  const queryClient = useQueryClient();
  // Trava síncrona contra clique duplo: `isPending` só chega no próximo render.
  const inFlightRef = useRef(false);

  const createReset = useCreatePasswordReset({
    mutation: {
      // O token só existe na resposta desta mutação: não deve sobreviver ao desmonte do diálogo.
      gcTime: 0,
      // O link novo é um convite pendente: a contagem de "Convites pendentes" sobe.
      onSuccess: () => {
        void invalidatePendingInvites(queryClient);
      },
    },
  });
  const isPending = createReset.isPending;

  function generate() {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    createReset.mutate(
      { id: access.id },
      {
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  const errorMessage = createReset.isError
    ? t(`access.actionErrors.${toAccessActionErrorKey(createReset.error)}`)
    : null;

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("access.passwordReset.title")}
      description={createReset.isSuccess ? undefined : t("access.passwordReset.description")}
      closeLabel={t("access.passwordReset.close")}
      // Fechar no meio do POST perderia o link gerado: a mutação não se cancela.
      isDismissable={!isPending}
      footer={
        createReset.isSuccess ? undefined : (
          <>
            <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
              {t("access.passwordReset.back")}
            </Button>
            <Button isLoading={isPending} onPress={generate}>
              {isPending
                ? t("access.passwordReset.generating")
                : t("access.passwordReset.generate")}
            </Button>
          </>
        )
      }
    >
      {createReset.isSuccess ? (
        <GeneratedLink
          url={createReset.data.url}
          linkLabel={t("access.passwordReset.link.label")}
          validityTitle={t("access.passwordReset.validityTitle")}
          validityDescription={t("access.passwordReset.validity", {
            hours: INVITE_VALIDITY_HOURS,
          })}
          layout="inline"
          onDone={onClose}
        >
          <MemberSummary access={access} />
        </GeneratedLink>
      ) : (
        <div aria-busy={isPending} className="flex flex-col gap-4">
          <MemberSummary access={access} />
          <ActionError message={errorMessage} />
        </div>
      )}
    </Dialog>
  );
}
