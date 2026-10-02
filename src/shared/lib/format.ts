/** Duração em minutos no padrão do TEDI: 120 → "2h", 90 → "1h30", 30 → "0h30", 0 → "0h". */
export function formatHours(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.trunc(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}
