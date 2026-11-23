import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useListMembers } from "@api/generated/people/people";
import { ListState } from "@shared/components/ListState";
import { useDebounce } from "@shared/hooks/useDebounce";
import { resolveListState } from "@shared/lib/list-state";
import { Card, Pagination } from "@shared/ui";

import personsIcon from "../../../assets/icons/persons.svg";
import { AccessFilters } from "../components/AccessFilters";
import { AccessTable } from "../components/AccessTable";
import { CreateInviteDialog } from "../components/CreateInviteDialog";
import { PendingInvitesButton } from "../components/PendingInvitesButton";
import { useCan } from "../hooks/useCan";
import {
  hasActiveMemberFilters,
  MEMBER_SEARCH_DEBOUNCE_MS,
  MEMBERS_PAGE_SIZE,
  readMemberFilters,
  toListMembersParams,
  withMemberFilter,
  withoutMemberFilters,
} from "../lib/member-filters";

/**
 * Membros (GUS-87, GUS-150): the members of the project from `listMembers`, with their department,
 * main function and status ("A validar" for a registration waiting for validation). The search, the
 * Papel and Status filters and the page live in the URL, so a link or a reload brings the same list
 * back. Any filter sends the list back to page 1, and the page on the screen stays while the next
 * one loads (`keepPreviousData`).
 *
 * Whoever has `members.list` sees the list (the route asks for it); the invite buttons are only for
 * who manages invites (`invites.manage`).
 *
 * The title of the page (h1) and the title of the tab come from the AppLayout through the
 * `handle.title` of the route (GUS-86); this page neither calls `useDocumentTitle` nor renders an
 * `<h1>` of its own.
 */
export function AccessPage(): ReactElement {
  const { t } = useTranslation("auth");
  const titleId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Row actions (GUS-88) must use `useCan("access.manage")` and the own-account rule (decision 23).
  const canInvite = useCan("invites.manage");
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const [params, setParams] = useSearchParams();
  const filters = readMemberFilters(params);

  // The box keeps what is typed; the URL gets it once the typing stops. An emptied box applies at
  // once: waiting would keep the old term in the applied filters.
  const [searchText, setSearchText] = useState(filters.search);
  const typedSearch = searchText.trim();
  const debouncedSearch = useDebounce(
    typedSearch,
    typedSearch === "" ? 0 : MEMBER_SEARCH_DEBOUNCE_MS,
  );
  const lastUrlSearch = useRef(filters.search);

  useEffect(() => {
    if (filters.search !== lastUrlSearch.current) {
      // The URL moved without the box (Back, the Membros link of the menu, Limpar filtros): the
      // box follows it, and nothing is written back.
      lastUrlSearch.current = filters.search;
      setSearchText(filters.search);
      return;
    }
    // Only once the debounce caught up with the box: right after Limpar filtros it still holds the
    // old term for a moment, and would write it back to the URL.
    if (debouncedSearch !== typedSearch || typedSearch === filters.search.trim()) return;
    lastUrlSearch.current = typedSearch;
    setParams((current) => withMemberFilter(current, "search", typedSearch), { replace: true });
  }, [filters.search, debouncedSearch, typedSearch, setParams]);

  const query = useListMembers(toListMembersParams(filters, MEMBERS_PAGE_SIZE), {
    query: { placeholderData: keepPreviousData },
  });

  function setFilter(key: "role" | "status" | "page", value: string) {
    setParams((current) => withMemberFilter(current, key, value));
  }

  function clearFilters() {
    setSearchText("");
    setParams((current) => withoutMemberFilters(current), { replace: true });
    searchInputRef.current?.focus();
  }

  const total = query.data?.total;
  const limit = query.data?.limit ?? MEMBERS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / limit));
  const cardTitle =
    total === undefined ? t("access.people.titlePending") : t("access.people.title", { total });

  // The refetch of a query in error and with no data goes back to status "pending"; keeping the
  // error panel (the button loading) keeps the button mounted and the focus on it.
  const isRetrying = query.isPending && query.isFetching && query.errorUpdateCount > 0;

  const listState = resolveListState({
    // With no rows, the placeholder has nothing to keep on the screen and, read with the new
    // filters, would show the wrong state (empty right after Limpar filtros): wait on loading.
    isPending: (query.isPending && !isRetrying) || (query.isPlaceholderData && total === 0),
    isError: query.isError || isRetrying,
    total,
    hasActiveFilters: hasActiveMemberFilters(filters),
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
            description={
              canInvite
                ? t("access.people.states.empty.description")
                : t("access.people.states.empty.descriptionReadOnly")
            }
            icon={personsIcon}
            action={
              canInvite
                ? {
                    label: t("access.createInvite.trigger"),
                    onPress: () => setIsInviteOpen(true),
                  }
                : undefined
            }
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
    // <Card> has no aria-labelledby/role of its own (shared/ui, GUS-86): the region is here, with
    // the id pointing to the text of the title that the Card draws inside its <h2>.
    <section aria-labelledby={titleId}>
      <Card
        title={<span id={titleId}>{cardTitle}</span>}
        aside={
          canInvite ? (
            <div className="flex flex-wrap gap-2">
              <PendingInvitesButton />
              <CreateInviteDialog isOpen={isInviteOpen} onOpenChange={setIsInviteOpen} />
            </div>
          ) : undefined
        }
      >
        <AccessFilters
          search={searchText}
          onSearchChange={setSearchText}
          role={filters.role}
          status={filters.status}
          onFilterChange={setFilter}
          searchInputRef={searchInputRef}
        />

        <hr className="my-1.5 border-tedi-divider" />

        <div
          data-testid="access-list"
          aria-busy={query.isPlaceholderData || undefined}
          className={query.isPlaceholderData ? "opacity-75" : undefined}
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
                page={Math.min(filters.page, totalPages)}
                totalPages={totalPages}
                onPageChange={(next) => setFilter("page", String(next))}
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
