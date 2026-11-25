import { useCallback } from "react";

import { can, type Permission, type PermissionTarget } from "@shared/lib/permissions";

import { useAuth } from "./useAuth";

/**
 * A pergunta do `useCan` como função, para fazer quantas vezes precisar no mesmo render: uma lista
 * em que cada linha tem a própria resposta (o "selecionar todos" de uma tabela) não pode chamar um
 * hook por linha. Lê o `permissions` do `/auth/me`, como o `useCan`; nunca compara `user.role`.
 */
export function usePermissionCheck(): (
  permission: Permission,
  target?: PermissionTarget,
) => boolean {
  const { user } = useAuth();
  return useCallback(
    (permission: Permission, target?: PermissionTarget) => can(user, permission, target),
    [user],
  );
}
