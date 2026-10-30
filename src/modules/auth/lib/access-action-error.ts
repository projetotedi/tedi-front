import { readApiErrorShape } from "./api-error";
import { toRequestErrorKey, type RequestErrorKey } from "./request-error";

/** Chave de `access.actionErrors.*` no namespace `auth`. */
export type AccessActionErrorKey =
  | "lastCoordinator"
  | "ownAccount"
  | "notFound"
  | "inviteGone"
  | RequestErrorKey;

/**
 * Erro de uma ação de acesso (perfil, ativar/desativar, redefinir senha, revogar convite) →
 * chave da mensagem. O código vem de `error.error` (ex.: `LAST_COORDINATOR`), não do texto.
 */
export function toAccessActionErrorKey(error: unknown): AccessActionErrorKey {
  const { error: code } = readApiErrorShape(error);

  if (code === "LAST_COORDINATOR") return "lastCoordinator";
  if (code === "OWN_ACCOUNT") return "ownAccount";
  if (code === "INVITE_ALREADY_USED" || code === "INVITE_ALREADY_REVOKED") return "inviteGone";
  if (code === "NOT_FOUND") return "notFound";
  return toRequestErrorKey(error);
}
