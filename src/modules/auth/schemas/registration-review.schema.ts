import { z } from "zod";

import type {
  ApproveMemberRegistrationDto,
  MemberRegistrationResponseDto,
  RejectMemberRegistrationDto,
} from "@api/generated/model";
import {
  approveMemberRegistrationBodyMainFunctionMax,
  approveMemberRegistrationBodyNoteMax,
  rejectMemberRegistrationBodyNoteMax,
} from "@api/generated/zod/people/people";
import { Role } from "@shared/lib/role";

import { INVITABLE_ROLES } from "../lib/role-label";
import { isCalendarDate, toAppCalendarDate, todayInAppTimeZone } from "../lib/registration-format";

/**
 * Valores do formulário de validação do cadastro. O schema é próprio, e não o gerado, porque o
 * formulário difere do DTO: o departamento depende do perfil, a nota só é obrigatória ao recusar e
 * os campos são texto (o que os inputs e o Select entregam), com o perfil `superadmin` fora.
 */
export interface RegistrationReviewFormValues {
  role: string;
  /** Id do departamento, `NO_DEPARTMENT` ("sem departamento") ou "" (nada escolhido). */
  departmentId: string;
  mainFunction: string;
  /** YYYY-MM-DD, o valor do `<input type="date">`. */
  joinedAt: string;
  note: string;
}

/** Valor do Select para "Sem departamento" (só a coordenadora pode ficar sem). Nunca é um id. */
export const NO_DEPARTMENT = "none";

/** Mesmo limite inferior do back para a entrada no projeto: pega erro de digitação do ano. */
export const MIN_JOINED_AT = "2000-01-01";

/** Limites do contrato, para o `maxLength` das mensagens. A nota usa o menor dos dois endpoints. */
export const REGISTRATION_REVIEW_LIMITS = {
  mainFunctionMax: approveMemberRegistrationBodyMainFunctionMax,
  noteMax: Math.min(approveMemberRegistrationBodyNoteMax, rejectMemberRegistrationBodyNoteMax),
} as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const INVITABLE_ROLE_SET: ReadonlySet<string> = new Set(INVITABLE_ROLES);

/** Perfis que a validação pode conceder: os do convite. `superadmin` o back recusa (INVALID_ROLE). */
export function isInvitableRole(value: string): value is InvitableRole {
  return INVITABLE_ROLE_SET.has(value);
}

/**
 * Perfis em que o departamento é opcional. Regra de formulário, não de autorização: ela diz o que
 * a tela exige para enviar (o back repete a conferência), e quem pode abrir a tela é `useCan`.
 */
const DEPARTMENT_OPTIONAL_ROLES: ReadonlySet<string> = new Set<string>([Role.coordinator]);

/** Se o perfil precisa de departamento: membro e diretor sim, coordenadora não. */
export function requiresDepartment(role: string): boolean {
  return !DEPARTMENT_OPTIONAL_ROLES.has(role);
}

function isJoinedAtInRange(value: string, today: string): boolean {
  return isCalendarDate(value) && value >= MIN_JOINED_AT && value <= today;
}

/**
 * Aprovar: perfil convidável, departamento da lista quando o perfil exige, função principal,
 * entrada entre `MIN_JOINED_AT` e `today`, e a observação opcional. `departmentIds` são os
 * departamentos que a tela oferece (vazio enquanto carrega ou quando não há nenhum).
 */
export function createApproveReviewSchema(departmentIds: ReadonlySet<string>, today: string) {
  return z
    .object({
      role: z.string().refine(isInvitableRole, "roleRequired"),
      departmentId: z.string(),
      mainFunction: z
        .string()
        .trim()
        .min(1, "mainFunctionRequired")
        .max(REGISTRATION_REVIEW_LIMITS.mainFunctionMax, "mainFunctionMax"),
      joinedAt: z.string().refine((value) => isJoinedAtInRange(value, today), "joinedAtInvalid"),
      note: z.string().trim().max(REGISTRATION_REVIEW_LIMITS.noteMax, "noteMax"),
    })
    .superRefine((values, context) => {
      if (requiresDepartment(values.role) && !departmentIds.has(values.departmentId)) {
        context.addIssue({ code: "custom", path: ["departmentId"], message: "departmentRequired" });
      }
    });
}

/** Recusar: só a observação conta, e é obrigatória (o membro corrige a partir dela). */
export const rejectReviewSchema = z.object({
  role: z.string(),
  departmentId: z.string(),
  mainFunction: z.string(),
  joinedAt: z.string(),
  note: z.string().trim().min(1, "noteRequired").max(REGISTRATION_REVIEW_LIMITS.noteMax, "noteMax"),
});

/**
 * Corpo de `PATCH /member-registrations/:id/approve` a partir de valores que o schema de aprovar
 * já aceitou. Só envia um departamento que a tela oferece: um id que ficou de antes da lista
 * carregar (o indicado pelo membro) não vai sem a coordenação ter visto, e vira "sem departamento".
 */
export function toApproveBody(
  values: RegistrationReviewFormValues,
  departmentIds: ReadonlySet<string>,
): ApproveMemberRegistrationDto {
  if (!isInvitableRole(values.role)) {
    throw new RangeError(`The role "${values.role}" cannot be granted by the validation.`);
  }
  const note = values.note.trim();

  return {
    role: values.role,
    departmentId: departmentIds.has(values.departmentId) ? values.departmentId : null,
    mainFunction: values.mainFunction.trim(),
    joinedAt: values.joinedAt,
    note: note === "" ? null : note,
  };
}

/** Corpo de `PATCH /member-registrations/:id/reject`. */
export function toRejectBody(values: RegistrationReviewFormValues): RejectMemberRegistrationDto {
  return { note: values.note.trim() };
}

/**
 * O que o formulário mostra ao abrir: o convite sugere o perfil (`requestedRole`, que a
 * coordenação ajusta), o membro indicou departamento e função, e a entrada começa no dia do envio
 * do cadastro (em `APP_TIME_ZONE`) ou, sem ele ou se o relógio do servidor estiver adiantado,
 * hoje. A nota começa vazia.
 */
export function buildReviewDefaults(
  registration: MemberRegistrationResponseDto,
  today: string = todayInAppTimeZone(),
): RegistrationReviewFormValues {
  const { requestedRole, submittedAt } = registration;
  const submittedOn = submittedAt === null ? null : toAppCalendarDate(submittedAt);

  return {
    role: requestedRole !== null && isInvitableRole(requestedRole) ? requestedRole : Role.member,
    departmentId: registration.department?.id ?? "",
    mainFunction: registration.mainFunction ?? "",
    joinedAt: submittedOn !== null && submittedOn <= today ? submittedOn : today,
    note: "",
  };
}
