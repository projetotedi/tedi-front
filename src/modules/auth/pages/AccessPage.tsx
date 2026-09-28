import { useId, useState, type ReactElement } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useListAccess } from "@api/generated";
import { useDebounce } from "@shared/hooks/useDebounce";
import { Alert, Button, Card, Pagination, Skeleton } from "@shared/ui";

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
 * O título da página (h1) e o título da aba vêm do AppLayout via `handle.title` da rota
 * (GUS-86); esta página não chama `useDocumentTitle` nem renderiza um `<h1>` próprio.
 */
export function AccessPage(): ReactElement {
  const { t } = useTranslation("auth");
  const titleId = useId();
  const [filters, setFilters] = useState<AccessFilterValues>(EMPTY_ACCESS_FILTERS);
  const [page, setPage] = useState(1);
  const search = useDebounce(filters.search, SEARCH_DEBOUNCE_MS);

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
  const cardTitle =
    total === undefined ? t("access.people.titlePending") : t("access.people.title", { total });

  return (
    // <Card> não expõe aria-labelledby/role próprios (shared/ui, GUS-86): a região fica aqui,
    // com o id apontando para o texto do título que o Card desenha dentro do seu <h2>.
    <section aria-labelledby={titleId}>
      <Card title={<span id={titleId}>{cardTitle}</span>} aside={<CreateInviteDialog />}>
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
              {t("access.people.summary", {
                shown: query.data.data.length,
                total: query.data.total,
              })}
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
      </Card>
    </section>
  );
}
