import type { ReactElement, ReactNode } from "react";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { DropIndicator, useDragAndDrop } from "react-aria-components/useDragAndDrop";

import gripIconUrl from "../assets/icons/grip-vertical.svg";
import { dropIndex } from "../lib/reorder";
import { Button } from "./Button";

export interface SortableListProps<T> {
  /** Nome da lista para leitores de tela (texto já traduzido). */
  "aria-label": string;
  items: readonly T[];
  /** Identificador estável do item; é o que o arrasto devolve em `onMove`. */
  getKey: (item: T) => string;
  /** Texto do item para a navegação por digitação e para o arrasto (já traduzido). */
  getTextValue: (item: T) => string;
  /** Nome acessível da alça de arrasto do item, por exemplo "Arrastar X para reordenar" (já traduzido). */
  dragLabel: (item: T) => string;
  /** O item `key` foi solto na posição `toIndex` (índice final, pronto para `moveItem`). */
  onMove: (key: string, toIndex: number) => void;
  /** Conteúdo da linha, à direita da alça de arrasto. Botões e links dentro dela entram na ordem de Tab. */
  renderItem: (item: T, index: number) => ReactNode;
  renderEmptyState?: () => ReactNode;
}

/**
 * A linha em si: o fundo e o espaçamento do Figma (raio 10, `px-3 py-2.5`). O fundo é o
 * `surface-secondary` do tema, a superfície sutil mais próxima do `surface-subtle` do design.
 * O anel de foco aparece quando a linha ganha o foco pelo teclado (setas); os botões de dentro
 * desenham o próprio foco.
 */
const ROW_CLASSES = [
  "flex items-center gap-3 rounded-[10px] bg-surface-secondary px-3 py-2.5 outline-hidden",
  "data-[focus-visible]:ring-3 data-[focus-visible]:ring-focus",
  "data-[dragging]:opacity-60",
].join(" ");

/**
 * Traço de 2px entre as linhas, na cor de foco, no lugar onde o item vai cair. O indicador tem
 * altura zero e margem negativa que cancela o `gap-2` da lista: durante o arrasto por teclado o
 * RAC monta um indicador (um botão focável) entre cada par de linhas, e nenhum deles pode empurrar
 * as linhas para baixo.
 */
const DROP_INDICATOR_CLASSES = [
  "relative -my-1 h-0 outline-hidden",
  "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:-translate-y-1/2 before:rounded-full",
  "data-[drop-target]:before:bg-focus",
].join(" ");

/**
 * Lista ordenável por arrasto, sobre o `GridList` do React Aria (`useDragAndDrop`). Não conhece o
 * conteúdo da linha nem o domínio: quem usa desenha cada item (`renderItem`) e guarda a ordem.
 *
 * - Mouse e toque: arrastar a linha. Teclado e leitor de tela: a alça de cada linha (Enter ou
 *   Espaço pega o item, setas escolhem o lugar, Enter solta, Esc cancela), com os anúncios do
 *   próprio React Aria.
 * - `keyboardNavigationBehavior="tab"`: botões e links de dentro da linha entram na ordem de Tab.
 *   Com o padrão `arrow` só seriam alcançados pelas setas esquerda e direita. A lista continua
 *   sendo uma parada única do Tab, como todo grid do React Aria: as setas ↑ e ↓ escolhem a linha,
 *   Tab percorre a alça e os botões da linha em foco, e o Tab seguinte sai da lista.
 * - Não há seleção: a lista só reordena. Quem precisa de uma alternativa ao arrasto (botões ↑ e ↓)
 *   a põe dentro de `renderItem`.
 */
export function SortableList<T>({
  "aria-label": ariaLabel,
  items,
  getKey,
  getTextValue,
  dragLabel,
  onMove,
  renderItem,
  renderEmptyState,
}: SortableListProps<T>): ReactElement {
  const keys = items.map(getKey);
  const textByKey = new Map(items.map((item) => [getKey(item), getTextValue(item)]));

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (draggedKeys) =>
      [...draggedKeys].map((key) => ({ "text/plain": textByKey.get(String(key)) ?? "" })),
    onReorder: ({ keys: draggedKeys, target }) => {
      const [draggedKey] = draggedKeys;
      if (draggedKey === undefined || target.dropPosition === "on") return;

      const key = String(draggedKey);
      const toIndex = dropIndex(keys, key, String(target.key), target.dropPosition);
      // Dropping next to where it already is (the first target of a keyboard drag) moves nothing.
      if (toIndex === keys.indexOf(key)) return;

      onMove(key, toIndex);
    },
    renderDropIndicator: (target) => (
      <DropIndicator target={target} className={DROP_INDICATOR_CLASSES} />
    ),
  });

  return (
    <GridList
      aria-label={ariaLabel}
      layout="stack"
      keyboardNavigationBehavior="tab"
      dragAndDropHooks={dragAndDropHooks}
      renderEmptyState={renderEmptyState}
      className="flex flex-col gap-2 outline-hidden"
    >
      {items.map((item, index) => (
        <GridListItem
          key={getKey(item)}
          id={getKey(item)}
          textValue={getTextValue(item)}
          className={ROW_CLASSES}
        >
          <Button
            slot="drag"
            variant="ghost"
            isIconOnly
            aria-label={dragLabel(item)}
            className="shrink-0 cursor-grab active:cursor-grabbing"
          >
            <img src={gripIconUrl} alt="" aria-hidden="true" width={16} height={16} />
          </Button>
          {renderItem(item, index)}
        </GridListItem>
      ))}
    </GridList>
  );
}
