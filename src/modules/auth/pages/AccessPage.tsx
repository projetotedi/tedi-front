import { useId, useRef, useState, type ReactElement } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useListAccess } from "@api/generated";
import { ListState } from "@shared/components/ListState";
import { useDebounce } from "@shared/hooks/useDebounce";
import { resolveListState } from "@shared/lib/list-state";
import { Card, Pagination } from "@shared/ui";

import personsIcon from "../../../assets/icons/persons.svg";
import { AccessFilters } from "../components/AccessFilters";
import { AccessTable } from "../components/AccessTable";
import { CreateInviteDialog } from "../components/CreateInviteDialog";
import { PendingInvitesButton } from "../components/PendingInvitesButton";
import {
  ACCESS_PAGE_SIZE,
  EMPTY_ACCESS_FILTERS,
  hasActiveFilters,
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<AccessFilterValues>(EMPTY_ACCESS_FILTERS);
  const [page, setPage] = useState(1);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Apagar a busca vale na hora: esperar o debounce manteria o termo antigo nos filtros aplicados.
  const isSearchEmpty = filters.search.trim() === "";
  const debouncedSearch = useDebounce(filters.search, isSearchEmpty ? 0 : SEARCH_DEBOUNCE_MS);
  const appliedFilters: AccessFilterValues = {
    ...filters,
    search: isSearchEmpty ? "" : debouncedSearch,
  };

  const query = useListAccess(toListAccessParams(appliedFilters, page), {
    query: { placeholderData: keepPreviousData },
  });

  function onFiltersChange(next: AccessFilterValues) {
    setFilters(next);
    setPage(1);
  }

  function clearFilters() {
    onFiltersChange(EMPTY_ACCESS_FILTERS);
    searchInputRef.current?.focus();
  }

  const total = query.data?.total;
  const limit = query.data?.limit ?? ACCESS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / limit));
  const cardTitle =
    total === undefined ? t("access.people.titlePending") : t("access.people.title", { total });

  const listState = resolveListState({
    // Sem linhas, o placeholder não tem o que manter na tela e, lido com os filtros novos,
    // mostraria o estado errado (vazio logo depois de Limpar filtros): espera no carregando.
    isPending: query.isPending || (query.isPlaceholderData && total === 0),
    isError: query.isError,
    total,
    hasActiveFilters: hasActiveFilters(appliedFilters),
  });

  function renderListState(): ReactElement | null {
    switch (listState) {
      case "loading":
        return <ListState variant="loading" title={t("access.people.loading")} />;
      case "empty":
        return (
          <ListState
            variant="empty"
            title={t("access.people.states.empty.title")}
            description={t("access.people.states.empty.description")}
            icon={personsIcon}
            action={{
              label: t("access.createInvite.trigger"),
              onPress: () => setIsInviteOpen(true),
            }}
          />
        );
      case "noResults":
        return (
          <ListState
            variant="noResults"
            title={t("access.people.states.noResults.title")}
            description={t("access.people.states.noResults.description")}
            icon={personsIcon}
            action={{ label: t("access.people.states.noResults.clear"), onPress: clearFilters }}
          />
        );
      case "error":
        return (
          <ListState
            variant="error"
            title={t("access.people.states.error.title")}
            description={t("access.people.states.error.description")}
            action={{
              label: t("access.people.states.error.retry"),
              onPress: () => void query.refetch(),
              isLoading: query.isFetching,
            }}
          />
        );
      default:
        return null;
    }
  }

  return (
    // <Card> não expõe aria-labelledby/role próprios (shared/ui, GUS-86): a região fica aqui,
    // com o id apontando para o texto do título que o Card desenha dentro do seu <h2>.
    <section aria-labelledby={titleId}>
      <Card
        title={<span id={titleId}>{cardTitle}</span>}
        aside={
          <div className="flex flex-wrap gap-2">
            <PendingInvitesButton />
            <CreateInviteDialog isOpen={isInviteOpen} onOpenChange={setIsInviteOpen} />
          </div>
        }
      >
        <AccessFilters value={filters} onChange={onFiltersChange} searchInputRef={searchInputRef} />

        <hr className="my-1.5 border-tedi-divider" />

        <div
          data-testid="access-list"
          aria-busy={query.isPlaceholderData || undefined}
          className={query.isPlaceholderData ? "opacity-60" : undefined}
        >
          <AccessTable rows={query.data?.data ?? []} />
          {renderListState()}
        </div>

        {listState === null && query.data ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p aria-live="polite" className="text-xs text-muted">
              {query.isPlaceholderData
                ? t("access.people.loading")
                : t("access.people.summary", {
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
