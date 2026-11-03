import type { AcceptInviteDto } from "@api/generated/model";

/**
 * TODO(GUS-120): apagar este arquivo quando o formulário enviar `registration`.
 *
 * Corpo que o aceite de convite de ACESSO ainda envia: o formato de antes da GUS-91, com nome, RA
 * e e-mail no topo. Desde a GUS-91 o back espera esses dados em `registration`
 * (MemberRegistrationFormDto) e responde 400 VALIDATION_FAILED (campo `registration`) a este
 * corpo, sem consumir o convite. É o mesmo comportamento da develop antes desta sincronização.
 *
 * Tipo de requisição escrito à mão, de propósito e por pouco tempo: o AGENTS.md proíbe tipo de
 * resposta escrito à mão, e o espírito da regra é que o contrato venha do Orval. É o único caso no
 * front, e `toAcceptInviteDto` é o único ponto em que ele vira o DTO gerado.
 */
export interface LegacyAcceptInviteBody {
  token: string;
  name: string;
  ra: string;
  email: string;
  password: string;
}

/** O que `useInviteAcceptance().submit` aceita: o DTO gerado (redefinição de senha) ou o corpo legado. */
export type AcceptInviteSubmission = AcceptInviteDto | LegacyAcceptInviteBody;

/** TODO(GUS-120): sem o corpo legado, esta função some e o hook volta a receber `AcceptInviteDto`. */
export function toAcceptInviteDto(submission: AcceptInviteSubmission): AcceptInviteDto {
  // O corpo legado já cabe no AcceptInviteDto (`registration` é opcional no tipo gerado) e vai para
  // a rede como está, sem mudança de comportamento. O tipo próprio existe porque um literal com
  // `name`, `ra` e `email` não passa na checagem de propriedades extras do DTO.
  return submission;
}
