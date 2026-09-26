import { Pagination as HeroPagination } from "@heroui/react";
import type { ReactElement } from "react";

import arrowLeftUrl from "../assets/icons/arrow-left.svg";
import arrowRightUrl from "../assets/icons/arrow-right.svg";
import { getPageItems } from "../lib/pagination";

export interface PaginationProps {
  /** Página atual, a partir de 1. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Nome da região de navegação (`nav`). */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** Nome acessível do botão de um número (ex.: "Página 3"). */
  pageLabel: (page: number) => string;
}

// Alvo de toque de 44px e texto de 16px (o Figma tem 32px e 13px). A página atual usa o tom
// suave do Figma, que passa em 4,5:1.
const BUTTON_CLASS =
  "min-h-11 min-w-11 rounded-[10px] text-base font-medium text-foreground data-[active=true]:bg-tedi-page-current data-[active=true]:text-tedi-page-current-foreground";

/**
 * Paginação numerada (anterior, números com reticências, próxima) sobre o `Pagination` do
 * HeroUI. Não guarda estado: a página atual e a mudança vêm de quem chama.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  label,
  previousLabel,
  nextLabel,
  pageLabel,
}: PaginationProps): ReactElement {
  return (
    <HeroPagination aria-label={label} className="w-auto">
      <HeroPagination.Content className="gap-1">
        <HeroPagination.Item>
          <HeroPagination.Previous
            aria-label={previousLabel}
            isDisabled={page <= 1}
            onPress={() => onPageChange(page - 1)}
            className={BUTTON_CLASS}
          >
            <img src={arrowLeftUrl} alt="" aria-hidden="true" width={16} height={16} />
          </HeroPagination.Previous>
        </HeroPagination.Item>

        {getPageItems(page, totalPages).map((item) =>
          typeof item === "number" ? (
            <HeroPagination.Item key={item}>
              <HeroPagination.Link
                aria-label={pageLabel(item)}
                isActive={item === page}
                onPress={() => onPageChange(item)}
                className={BUTTON_CLASS}
              >
                {item}
              </HeroPagination.Link>
            </HeroPagination.Item>
          ) : (
            <HeroPagination.Item key={item}>
              <HeroPagination.Ellipsis />
            </HeroPagination.Item>
          ),
        )}

        <HeroPagination.Item>
          <HeroPagination.Next
            aria-label={nextLabel}
            isDisabled={page >= totalPages}
            onPress={() => onPageChange(page + 1)}
            className={BUTTON_CLASS}
          >
            <img src={arrowRightUrl} alt="" aria-hidden="true" width={16} height={16} />
          </HeroPagination.Next>
        </HeroPagination.Item>
      </HeroPagination.Content>
    </HeroPagination>
  );
}
