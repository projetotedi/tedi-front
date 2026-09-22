/**
 * `ra` e `email` saem do Orval tipados como `{ [key: string]: unknown }`: o Swagger do back
 * declara os dois como `type: object` (mesmo problema do `MeResponseDto`, risco 10 do plano
 * da GUS-83). Trata qualquer coisa que não seja uma string não vazia como ausente.
 */
export function toDisplayText(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : "—";
}
