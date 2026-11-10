import type { AcceptInviteDto, MemberRegistrationFormDto } from "@api/generated/model";

import type { AcceptInviteFormOutput } from "../schemas/accept-invite-form.schema";

/**
 * Corpo do POST /auth/invites/accept de um convite de cadastro: `token`, `password` e o objeto
 * `registration` que o back espera desde a GUS-91 (antes, nome, RA e e-mail iam no topo e o
 * ValidationPipe os descartava, com 400 em `registration`).
 *
 * Campo a campo, nunca `...values`: a confirmação da senha não vai para a rede. Opcional sem valor
 * fica de fora, com a chave omitida (e não `null`): o `departmentId` vazio falharia no
 * `@IsUUID`, e `undefined` some no JSON do mesmo jeito.
 *
 * O link `password_reset` não passa por aqui: ele manda só `{ token, password }`, e o back ignora
 * `registration` nesse tipo.
 */
export function toAcceptInviteDto(token: string, values: AcceptInviteFormOutput): AcceptInviteDto {
  const registration: MemberRegistrationFormDto = {
    name: values.name,
    ra: values.ra,
    personalEmail: values.personalEmail,
    birthDate: values.birthDate,
    cpf: values.cpf,
    phone: values.phone,
    institutionalEmail: values.institutionalEmail,
    course: values.course,
    semester: values.semester,
    className: values.className,
  };

  if (values.address !== undefined) registration.address = values.address;
  if (values.city !== undefined) registration.city = values.city;
  if (values.state !== undefined) registration.state = values.state;
  if (values.departmentId !== undefined) registration.departmentId = values.departmentId;
  if (values.volunteerTermUrl !== undefined) {
    registration.volunteerTermUrl = values.volunteerTermUrl;
  }

  return { token, password: values.password, registration };
}
