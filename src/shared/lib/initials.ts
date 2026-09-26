/** Iniciais para o avatar: primeira letra do primeiro e do último nome ("Beatriz Nunes" → "BN"). Nome de uma palavra só usa as duas primeiras letras. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) return "";

  const letters = words.length === 1 ? first.slice(0, 2) : `${first[0]}${last[0]}`;
  return letters.toLocaleUpperCase("pt-BR");
}
