import { useId, useState, type ReactElement } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useListAccess } from "@api/generated";
import { useDebounce } from "@shared/hooks/useDebounce";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Alert, Button, Pagination, Skeleton } from "@shared/ui";

import { AccessFilters } from "../components/AccessFilters";
import { AccessTable } from "../components/AccessTable";
import { CreateInviteDialog } from "../components/CreateInviteDialog";
import {
  ACCESS_PAGE_SIZE,
  EMPTY_ACCESS_FILTERS,
  SEARCH_DEBOUNCE_MS,
  toListAccessParams,
  type AccessFilterValues,
} from "../lib/access-filters";

/**
 * `/access`, sob `RequireRole minRole={Role.coordinator}`. Um cartão único, como no Figma
 * "Membros e Alocações": título com o total, botão "Gerar link de cadastro", busca e filtros,
 * a tabela de quem tem acesso e o rodapé com o resumo e a paginação numerada.
 *
 * A busca é ao vivo (debounce); qualquer mudança de filtro volta para a página 1. O título da
 * página (`h1`) fica no cabeçalho do layout, que o lê do `handle` da rota.
 */
export function AccessPage(): ReactElement {
  const { t } = useTranslation("auth");
  const titleId = useId();
  const [filters, setFilters] = useState<AccessFilterValues>(EMPTY_ACCESS_FILTERS);
  const [page, setPage] = useState(1);
  const search = useDebounce(filters.search, SEARCH_DEBOUNCE_MS);

  useDocumentTitle(t("access.title"));

  const query = useListAccess(toListAccessParams({ ...filters, search }, page), {
    query: { placeholderData: keepPreviousData },
  });

  function onFiltersChange(next: AccessFilterValues) {
    setFilters(next);
    setPage(1);
  }

  const total = query.data?.total;
  const limit = query.data?.limit ?? ACCESS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / limit));

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-tedi-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-base font-semibold">
          {total === undefined
            ? t("access.people.titlePending")
            : t("access.people.title", { total })}
        </h2>
        {/* Sempre visível: gerar o link não depende da lista (vazia, carregando ou com erro). */}
        <CreateInviteDialog />
      </div>

      <AccessFilters value={filters} onChange={onFiltersChange} />

      <hr className="my-1.5 border-tedi-divider" />

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          <p role="status">{t("access.people.loading")}</p>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("access.people.error")}</Alert>
          <Button variant="secondary" onPress={() => void query.refetch()}>
            {t("access.people.retry")}
          </Button>
        </div>
      ) : (
        <AccessTable rows={query.data.data} />
      )}

      {query.data && query.data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p aria-live="polite" className="text-xs text-muted">
            {t("access.people.summary", { shown: query.data.data.length, total: query.data.total })}
          </p>
          {totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label={t("access.people.pagination.nav")}
              previousLabel={t("access.people.pagination.previous")}
              nextLabel={t("access.people.pagination.next")}
              pageLabel={(number) => t("access.people.pagination.page", { page: number })}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
