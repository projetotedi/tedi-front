import { useRef } from "react";

import { useAcceptInvite } from "@api/generated";
import type { AcceptInviteDto } from "@api/generated/model";

import {
  toInviteErrorKey,
  toRegistrationFieldErrors,
  type InviteErrorKey,
  type RegistrationFieldError,
} from "../lib/invite-error";
import { useSlowRequestNotice } from "./useSlowRequestNotice";

/** O aviso geral do formulário: erro que não aponta um campo. Os que apontam vão por `onFieldErrors`. */
export type GeneralInviteErrorKey = "network" | "unknown" | "invalidData";

export interface UseInviteAcceptanceOptions {
  onAccepted: () => void;
  onInvalidInvite: () => void;
  /** Erros que o servidor ligou a campos do cadastro; só o formulário do convite de cadastro passa isto. */
  onFieldErrors?: (errors: RegistrationFieldError[]) => void;
}

function toGeneralErrorKey(error: unknown): GeneralInviteErrorKey | null {
  const key = toInviteErrorKey(error);
  if (key === "network" || key === "unknown") return key;
  // 400 VALIDATION_FAILED que não nomeia campo do formulário (ou nomeia só `registration`).
  if (key === "invalidData" && toRegistrationFieldErrors(error).length === 0) return key;
  return null;
}

export function useInviteAcceptance({
  onAccepted,
  onInvalidInvite,
  onFieldErrors,
}: UseInviteAcceptanceOptions) {
  const accept = useAcceptInvite({
    mutation: {
      onSuccess: () => onAccepted(),
      onError: (error) => {
        if (toInviteErrorKey(error) === "invalidInvite") {
          onInvalidInvite();
          return;
        }
        const fieldErrors = toRegistrationFieldErrors(error);
        if (fieldErrors.length > 0) onFieldErrors?.(fieldErrors);
      },
    },
  });

  // Depois de um sucesso a tela só está esperando o pai trocar de tela: continua travada.
  const isBusy = accept.isPending || accept.isSuccess;
  const showSlowNotice = useSlowRequestNotice(accept.isPending);
  const errorKey: InviteErrorKey | null = accept.isError ? toInviteErrorKey(accept.error) : null;
  const generalErrorKey: GeneralInviteErrorKey | null = accept.isError
    ? toGeneralErrorKey(accept.error)
    : null;

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

  return { submit, isBusy, showSlowNotice, errorKey, generalErrorKey, reset: accept.reset };
}
