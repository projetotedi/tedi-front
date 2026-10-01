import { can, type Permission, type PermissionTarget } from "@shared/lib/permissions";

import { useAuth } from "./useAuth";

/**
 * Se o usuário logado pode `permission` (lida do `permissions` do `/auth/me`). Botões e ações
 * usam isto, nunca comparam `user.role` (RNF-22: a autoridade é o back). `target.serverGrant`
 * é a flag que o back calcula para o recurso quando o escopo é department/allocated/lessonTeacher.
 */
export function useCan(permission: Permission, target?: PermissionTarget): boolean {
  const { user } = useAuth();
  return can(user, permission, target);
}
