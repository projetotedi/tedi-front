import { useRef } from "react";

import { useAcceptInvite } from "@api/generated";
import type { AcceptInviteDto } from "@api/generated/model";

import {
  toAcceptFieldError,
  toInviteErrorKey,
  type InviteConflictField,
  type InviteErrorKey,
} from "../lib/invite-error";
import { useSlowRequestNotice } from "./useSlowRequestNotice";

export interface UseInviteAcceptanceOptions {
  /** O back aceitou (204, sem corpo). */
  onAccepted: () => void;
  /** O back respondeu `INVALID_INVITE`: o link foi usado, expirou ou foi revogado. */
  onInvalidInvite: () => void;
  /** O back respondeu 409 de RA ou de e-mail: o campo que recebe o erro e a chave da mensagem. */
  onConflict?: (field: InviteConflictField, key: InviteErrorKey) => void;
}

/**
 * O envio de `POST /auth/invites/accept`, comum ao formulário de cadastro e ao de nova senha: a
 * trava contra envio duplo, o aviso de conexão lenta, a tradução do erro e a propagação do link
 * inválido. O que muda de um formulário para o outro (o corpo, o campo em conflito) fica com quem
 * chama.
 */
export function useInviteAcceptance({
  onAccepted,
  onInvalidInvite,
  onConflict,
}: UseInviteAcceptanceOptions) {
  const accept = useAcceptInvite({
    mutation: {
      onSuccess: () => onAccepted(),
      onError: (error) => {
        const key = toInviteErrorKey(error);
        if (key === "invalidInvite") {
          onInvalidInvite();
          return;
        }
        const field = toAcceptFieldError(key);
        if (field) onConflict?.(field, key);
      },
    },
  });

  // Depois de um sucesso a tela só está esperando o pai trocar de tela: continua travada.
  const isBusy = accept.isPending || accept.isSuccess;
  const showSlowNotice = useSlowRequestNotice(accept.isPending);
  const errorKey: InviteErrorKey | null = accept.isError ? toInviteErrorKey(accept.error) : null;

  // Trava síncrona contra envio duplo. `isPending` só chega ao componente no render seguinte e o
  // handleSubmit valida de forma assíncrona: dois envios seguidos (duplo clique, Enter repetido)
  // passam os dois pela validação antes disso. Verificar e marcar aqui não tem `await` no meio.
  const inFlightRef = useRef(false);

  function submit(data: AcceptInviteDto) {
    if (isBusy || inFlightRef.current) return;
    inFlightRef.current = true;
    accept.mutate(
      { data },
      {
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  return { submit, isBusy, showSlowNotice, errorKey, reset: accept.reset };
}
