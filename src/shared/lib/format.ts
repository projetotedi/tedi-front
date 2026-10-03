/**
 * Duração em minutos no padrão do TEDI: 120 → "2h", 90 → "1h30", 30 → "0h30", 0 → "0h".
 * Negativo leva o sinal na frente do valor absoluto (-90 → "-1h30"); o que arredonda para zero
 * fica sem sinal (-0.4 → "0h").
 */
export function formatHours(minutes: number): string {
  const total = Math.round(minutes);
  const sign = total < 0 ? "-" : "";
  const absolute = Math.abs(total);
  const hours = Math.trunc(absolute / 60);
  const rest = absolute % 60;
  const time = rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
  return `${sign}${time}`;
}
