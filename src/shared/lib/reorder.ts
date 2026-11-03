function isIndex(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

/**
 * Cópia de `items` com o item de `from` movido para o índice `to`, que é o índice em que ele
 * termina: `moveItem([a, b, c], 0, 2)` dá `[b, c, a]`. Nunca altera o array recebido. Índice fora
 * da lista deixa a ordem como estava, então um clique atrasado não perde nem duplica item.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const reordered = [...items];
  if (!isIndex(from, items.length) || !isIndex(to, items.length)) return reordered;

  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return reordered;
}

/**
 * Onde termina o item arrastado quando solto `before` ou `after` de outro, como o índice que
 * `moveItem` espera. As bibliotecas de arrasto contam o alvo na lista como ela está agora, mas o
 * item arrastado sai do lugar primeiro e tudo que vinha depois dele sobe uma posição: este é o
 * desconto que a função faz. Soltar ao lado de onde já está, ou sobre si mesmo, dá o próprio
 * índice (nada se move). Dá -1 quando `draggedKey` não está em `keys`, que `moveItem` entende
 * como nada a mover.
 */
export function dropIndex(
  keys: readonly string[],
  draggedKey: string,
  targetKey: string,
  position: "before" | "after",
): number {
  const from = keys.indexOf(draggedKey);
  if (from === -1 || draggedKey === targetKey) return from;

  const target = keys.filter((key) => key !== draggedKey).indexOf(targetKey);
  if (target === -1) return from;

  return position === "before" ? target : target + 1;
}
