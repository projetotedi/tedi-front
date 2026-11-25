import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { MemberListItemResponseDto } from "@api/generated/model";
import { useListMembers } from "@api/generated/people/people";
import { ListState } from "@shared/components/ListState";
import { useDebounce } from "@shared/hooks/useDebounce";
import { resolveListState } from "@shared/lib/list-state";
import { Card, Pagination } from "@shared/ui";

import personsIcon from "../../../assets/icons/persons.svg";
import { AccessFilters } from "../components/AccessFilters";
import { AccessTable } from "../components/AccessTable";
import { CreateInviteDialog } from "../components/CreateInviteDialog";
import { EditMemberDialog } from "../components/EditMemberDialog";
import { PendingInvitesButton } from "../components/PendingInvitesButton";
import { ValidateRegistrationDialog } from "../components/ValidateRegistrationDialog";
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
import { memberDetailPath } from "../lib/member-path";

/**
 * Membros (GUS-87, GUS-150): the members of the project from `listMembers`, with their department,
 * main function and status ("A validar" for a registration waiting for validation). The search, the
 * Papel and Status filters and the page live in the URL, so a link or a reload brings the same list
 * back. Any filter sends the list back to page 1, and the page on the screen stays while the next
 * one loads (`keepPreviousData`).
 *
 * Whoever has `members.list` sees the list (the route asks for it); the invite buttons and Validar
 * are only for who manages invites (`invites.manage`). Validar, on a registration waiting for
 * validation, opens the modal of GUS-125 over the list, and the list stays where it was: deciding
 * refreshes it (the modal invalidates `/members`).
 *
 * The title of the page (h1) and the title of the tab come from the AppLayout through the
 * `handle.title` of the route (GUS-86); this page neither calls `useDocumentTitle` nor renders an
 * `<h1>` of its own.
 */
export function AccessPage(): ReactElement {
  const { t } = useTranslation("auth");
  const titleId = useId();
  const titleRef = useRef<HTMLSpanElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const canInvite = useCan("invites.manage");
  const canValidate = useCan("invites.manage");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberListItemResponseDto | null>(null);
  // The id of the registration being validated (the id of the person); the modal exists only while
  // there is one.
  const [validatingId, setValidatingId] = useState<string | null>(null);
  // Set by the modal when it reports a decision (approved or rejected).
  const hasReviewedRef = useRef(false);

  // After the modal is unmounted. The decision takes the row out of "A validar", so the Validar
  // button that opened the modal goes away, and the focus that the modal gives back on closing only
  // acts when the focus was lost, not when it was moved on purpose: it goes to the title of the
  // list, which stays. Closing with Voltar or Esc keeps the default: the focus returns to the button.
  useEffect(() => {
    if (validatingId !== null || !hasReviewedRef.current) return;
    hasReviewedRef.current = false;
    titleRef.current?.focus();
  }, [validatingId]);

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
  // What the box knows about the URL: the search it saw there on the last render and the one it
  // last wrote. A change that is neither of them came from outside.
  const seenUrlSearch = useRef(filters.search);
  const writtenSearch = useRef(filters.search);

  useEffect(() => {
    const hasUrlChanged = filters.search !== seenUrlSearch.current;
    seenUrlSearch.current = filters.search;

    if (hasUrlChanged && filters.search !== writtenSearch.current) {
      // The URL moved without the box (Back, the Membros link of the menu, Limpar filtros): the
      // box follows it, and nothing is written back.
      writtenSearch.current = filters.search;
      setSearchText(filters.search);
      return;
    }
    // Only once the debounce caught up with the box: right after Limpar filtros it still holds the
    // old term for a moment, and would write it back to the URL.
    if (debouncedSearch !== typedSearch || typedSearch === filters.search.trim()) return;
    writtenSearch.current = typedSearch;
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

  // A page past the last one (an old link, or the list shrank under the page that was open, as when
  // the last person of the last page is validated out of a filter): the API answers it with no
  // rows, though the total is not zero. Only the data of this page counts: the placeholder is the
  // page that was on the screen before.
  const isPastLastPage =
    !query.isPlaceholderData && total !== undefined && total > 0 && filters.page > totalPages;

  useEffect(() => {
    if (!isPastLastPage) return;
    // The URL goes to the last page, replacing the entry. Page 1 is the page with no key in the URL.
    setParams(
      (current) => withMemberFilter(current, "page", totalPages > 1 ? String(totalPages) : ""),
      { replace: true },
    );
  }, [isPastLastPage, totalPages, setParams]);

  // The refetch of a query in error and with no data goes back to status "pending"; keeping the
  // error panel (the button loading) keeps the button mounted and the focus on it.
  const isRetrying = query.isPending && query.isFetching && query.errorUpdateCount > 0;

  const hasRows = (query.data?.data.length ?? 0) > 0;

  const listState = resolveListState({
    // With no rows, the placeholder has nothing to keep on the screen and, read with the new
    // filters, would show the wrong state (empty right after Limpar filtros, or a page with no rows
    // right after the list went past its last page): wait on loading. So does the page past the
    // last one, until the URL gets to the last page.
    isPending:
      (query.isPending && !isRetrying) || (query.isPlaceholderData && !hasRows) || isPastLastPage,
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
        title={
          <span
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
            className="rounded-sm outline-hidden focus-visible:ring-3 focus-visible:ring-focus"
          >
            {cardTitle}
          </span>
        }
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
          <AccessTable
            rows={query.data?.data ?? []}
            onEditMember={setEditingMember}
            onRowClick={(row) => navigate(memberDetailPath(row.id))}
            onValidate={canValidate ? (row) => setValidatingId(row.id) : undefined}
          />
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

      {editingMember ? (
        <EditMemberDialog
          key={editingMember.id}
          member={editingMember}
          onClose={() => setEditingMember(null)}
        />
      ) : null}

      {validatingId !== null ? (
        <ValidateRegistrationDialog
          registrationId={validatingId}
          onReviewed={() => {
            hasReviewedRef.current = true;
          }}
          onClose={() => setValidatingId(null)}
        />
      ) : null}
    </section>
  );
}
