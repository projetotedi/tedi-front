import type { AccessResponseDto, MemberListItemResponseDto } from "@api/generated/model";

/**
 * Campos de acesso compartilhados entre a linha de `GET /members` (`MemberListItemResponseDto`) e
 * o retorno das mutações de acesso (`AccessResponseDto`).
 */
export type MemberAccessTarget = Pick<
  MemberListItemResponseDto,
  "id" | "name" | "role" | "accessEnabled"
> & {
  ra: MemberListItemResponseDto["ra"] | AccessResponseDto["ra"];
  email?: AccessResponseDto["email"];
};

/**
 * `ra` e `email` do `AccessResponseDto` saem tipados como objeto pelo Orval (o Swagger do back os
 * descreve mal), mas chegam como texto. Devolve o texto ou `null` se não houver nada para mostrar.
 */
export function accessText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Data e hora curtas de um convite, como no Figma: "22/09 · 09:00" em pt-BR. Sem ano: um convite
 * vale poucos dias. `timeZone` só existe para os testes fixarem o fuso; no app vale o do navegador.
 */
export function formatInviteDateTime(iso: string, locale: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const day = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", timeZone });
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });

  return `${day.format(date)} · ${time.format(date)}`;
}
