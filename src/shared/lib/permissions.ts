import type { MeResponseDto, PermissionsDto, Scope } from "@api/generated/model";

/** Chave de permissão, derivada do contrato (`permissions` do `/auth/me`). */
export type Permission = keyof PermissionsDto;
export type { Scope };

/** O mínimo do usuário logado que `can` precisa. */
export type PermissionSubject = Pick<MeResponseDto, "id" | "permissions">;

export interface PermissionTarget {
  /** Pessoa alvo: resolve "own" e a regra "ninguém confirma a própria presença". */
  personId?: string;
  /**
   * Flag calculada pelo back para o recurso (ex.: lesson.canTakeAttendance, canConfirmMembers,
   * member.canEdit). Resolve department / allocated / lessonTeacher, que o front não sabe calcular.
   */
  serverGrant?: boolean;
}

/** Escopo que o back concedeu ao usuário para a permissão; "none" sem sessão. */
export function scopeOf(user: PermissionSubject | null | undefined, permission: Permission): Scope {
  return user?.permissions?.[permission] ?? "none";
}

/**
 * Se o usuário pode a ação. Sem `target`, responde "o perfil tem alguma chance?" (menu, rota,
 * botão de criar). Com `target`, escopos que o front não calcula (department, allocated,
 * lessonTeacher) seguem `serverGrant`. O front nunca repete a matriz: o back é a autoridade (RNF-22).
 */
export function can(
  user: PermissionSubject | null | undefined,
  permission: Permission,
  target?: PermissionTarget,
): boolean {
  if (!user) return false;

  const scope = scopeOf(user, permission);
  if (scope === "none") return false;

  // Regra fixa: ninguém confirma a própria presença, nem com escopo "all".
  if (permission === "attendance.confirmMember" && target?.personId === user.id) return false;

  if (scope === "all") return true;
  if (!target) return true;
  if (scope === "own") return target.personId === user.id;
  return target.serverGrant === true;
}
