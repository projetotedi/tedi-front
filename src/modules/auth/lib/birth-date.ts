/** Mesmo limite inferior do back (people/validators/is-birth-date.validator.ts): pega erro de digitação do ano. */
export const MIN_BIRTH_DATE = "1900-01-01";

/** Fuso do back para "hoje": quem se cadastra à noite no Brasil não pode ficar "no futuro" por causa do UTC. */
const TIME_ZONE = "America/Sao_Paulo";
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "Hoje" em America/Sao_Paulo, como YYYY-MM-DD (que ordena como texto). `now` existe para os testes. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  // Criado a cada chamada, e não ao importar o módulo: um ambiente sem o fuso derrubaria a tela toda.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Data de calendário que existe (rejeita 2023-02-31): refaz a data e confere que nada rolou para outro mês. */
function isRealCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Data de nascimento do back: YYYY-MM-DD, data real, entre 1900-01-01 e hoje em
 * America/Sao_Paulo. É o valor do `<input type="date">`, que já sai nesse formato.
 */
export function isValidBirthDate(value: string, now: Date = new Date()): boolean {
  return isRealCalendarDate(value) && value >= MIN_BIRTH_DATE && value <= todayInSaoPaulo(now);
}
