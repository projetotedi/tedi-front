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
  onAccepted: () => void;
  onInvalidInvite: () => void;
  onConflict?: (field: InviteConflictField, key: InviteErrorKey) => void;
}

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

  // Trava síncrona por ref: `isPending` só chega no render seguinte e o handleSubmit valida de
  // forma assíncrona, então dois envios seguidos (duplo clique, Enter repetido) passariam os dois.
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
