import { useState, type FormEvent, type ReactElement } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useListAccess } from "@api/generated";
import type { AccessResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Alert, Badge, Button, Skeleton, TextField } from "@shared/ui";

import { toDisplayText } from "../lib/display-text";
import { roleLabelKey } from "../lib/role-label";

const ACCESS_PAGE_SIZE = 20;

/** Aba "Pessoas": listagem paginada de quem tem acesso ao TEDI, com busca por nome ou RA. */
export function AccessTable(): ReactElement {
  const { t } = useTranslation("auth");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = useListAccess(
    { page, limit: ACCESS_PAGE_SIZE, search: search || undefined },
    { query: { placeholderData: keepPreviousData } },
  );

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  }

  const columns: Column<AccessResponseDto>[] = [
    { header: t("access.people.columns.name"), render: (row) => row.name },
    { header: t("access.people.columns.ra"), render: (row) => toDisplayText(row.ra) },
    { header: t("access.people.columns.email"), render: (row) => toDisplayText(row.email) },
    {
      header: t("access.people.columns.role"),
      render: (row) => {
        const key = roleLabelKey(row.role);
        return key ? t(key) : "—";
      },
    },
    {
      header: t("access.people.columns.status"),
      render: (row) => (
        <Badge tone={row.accessEnabled ? "success" : "neutral"}>
          {t(row.accessEnabled ? "access.people.status.active" : "access.people.status.inactive")}
        </Badge>
      ),
    },
  ];

  const total = query.data?.total ?? 0;
  const limit = query.data?.limit ?? ACCESS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex flex-col gap-4">
      <form role="search" className="flex flex-wrap items-end gap-3" onSubmit={onSearchSubmit}>
        <div className="w-full max-w-80">
          <TextField
            label={t("access.people.search.label")}
            value={searchDraft}
            onChange={setSearchDraft}
          />
        </div>
        <Button type="submit">{t("access.people.search.submit")}</Button>
      </form>

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
        <>
          <DataTable
            columns={columns}
            rows={query.data.data}
            rowKey={(row) => row.id}
            caption={t("access.people.caption")}
            emptyMessage={t("access.people.empty")}
          />
          {total > limit ? (
            <nav
              aria-label={t("access.people.pagination.nav")}
              className="flex items-center justify-between gap-3"
            >
              <Button
                variant="secondary"
                isDisabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t("access.people.pagination.previous")}
              </Button>
              <p aria-live="polite">
                {t("access.people.pagination.status", { page, pages: totalPages })}
              </p>
              <Button
                variant="secondary"
                isDisabled={page >= totalPages}
                onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                {t("access.people.pagination.next")}
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
