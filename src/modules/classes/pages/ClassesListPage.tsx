import { useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DataTable, type Column } from "@shared/components/DataTable";
import { ListState } from "@shared/components/ListState";
import { Button, Card, Checkbox, Chip, Dialog, Pagination, Select, TextField } from "@shared/ui";
import { initialClasses, type ClassRecord, type ClassStatus } from "../mocks/classes.mock";

const PAGE_SIZE = 10;
const blank = (id: string): ClassRecord => ({
  id,
  code: "",
  name: "",
  courseId: "phone",
  course: "Uso do celular",
  editionId: "2026-2",
  edition: "2º semestre 2026",
  level: "Iniciante",
  start: "2026-08-01",
  end: "2026-12-15",
  enrolled: 0,
  capacity: 20,
  status: "planned",
  archived: false,
});

export function ClassesListPage(): ReactElement {
  const { t } = useTranslation("classes");
  const [params, setParams] = useSearchParams();
  const [records, setRecords] = useState(initialClasses);
  const search = params.get("search") ?? "";
  const edition = params.get("edition") ?? "";
  const course = params.get("courseId") ?? "";
  const level = params.get("level") ?? "";
  const status = params.get("status") ?? "";
  const statuses = status && status !== "archived" ? status.split(",") : [];
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<ClassRecord | null>(null);
  const [archiving, setArchiving] = useState<ClassRecord | null>(null);
  const mockState = params.get("mockState");

  function updateParam(key: string, value: string, resetPage = true) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        if (resetPage && key !== "page") next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  function openCreate() {
    const next = new URLSearchParams(params);
    next.delete("mockState");
    setParams(next, { replace: true });
    setEditing(blank(String(Date.now())));
    setDialog(true);
  }

  const filtered = records.filter((item) => {
    const q = search.trim().toLocaleLowerCase();
    return (
      item.archived === (status === "archived") &&
      (!q || `${item.code} ${item.name} ${item.course}`.toLocaleLowerCase().includes(q)) &&
      (!edition || item.editionId === edition) &&
      (!course || item.courseId === course) &&
      (!level || item.level === level) &&
      (!statuses.length || statuses.includes(item.status))
    );
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusLabels: Record<ClassStatus, string> = {
    planned: t("planned"),
    inProgress: t("inProgress"),
    completed: t("completed"),
    cancelled: t("cancelled"),
  };
  const columns: Column<ClassRecord>[] = [
    {
      header: t("class"),
      render: (row) => (
        <a
          className="font-medium text-foreground hover:underline focus-visible:underline"
          href={`/classes/${row.id}`}
          title={`${row.code} · ${row.course}`}
        >
          {row.name}
        </a>
      ),
    },
    {
      header: t("period"),
      render: (row) => (
        <span>
          {new Date(`${row.start}T00:00:00`).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          })}{" "}
          -{" "}
          {new Date(`${row.end}T00:00:00`).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          })}
        </span>
      ),
    },
    {
      header: t("seats"),
      render: (row) => (
        <span>
          {row.enrolled}/{row.capacity}
        </span>
      ),
    },
    {
      header: t("status"),
      render: (row) => (
        <Chip
          color={
            row.status === "completed"
              ? "success"
              : row.status === "cancelled"
                ? "danger"
                : row.status === "planned"
                  ? "warning"
                  : "accent"
          }
        >
          {row.archived ? t("archived") : statusLabels[row.status]}
        </Chip>
      ),
    },
    {
      header: t("actions"),
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            isIconOnly
            aria-label={t("edit")}
            onPress={() => {
              setEditing(row);
              setDialog(true);
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="size-5"
            >
              <path d="m15 5 4 4M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" />
            </svg>
          </Button>
          {row.archived ? (
            <Button
              variant="secondary"
              onPress={() =>
                setRecords((all) =>
                  all.map((r) => (r.id === row.id ? { ...r, archived: false } : r)),
                )
              }
            >
              {t("restore")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              isIconOnly
              aria-label={t("archive")}
              onPress={() => {
                setArchiving(row);
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="size-5 text-danger"
              >
                <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </Button>
          )}
        </div>
      ),
    },
  ];

  function clear() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        ["search", "edition", "courseId", "level", "status", "page"].forEach((key) =>
          next.delete(key),
        );
        return next;
      },
      { replace: true },
    );
  }
  function save() {
    if (!editing) return;
    setRecords((all) =>
      all.some((row) => row.id === editing.id)
        ? all.map((row) => (row.id === editing.id ? editing : row))
        : [editing, ...all],
    );
    setDialog(false);
    setEditing(null);
  }
  const choices = (values: Array<[string, string]>) => [
    { id: "", label: t("all") },
    ...values.map(([id, label]) => ({ id, label })),
  ];

  return (
    <section aria-labelledby="classes-title">
      <Card
        title={
          <span id="classes-title">
            {t("title", { count: mockState === "empty" ? 0 : filtered.length })}
          </span>
        }
        aside={<Button onPress={openCreate}>{t("create")}</Button>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <TextField
            label={t("search")}
            value={search}
            onChange={(value) => updateParam("search", value)}
          />
          <Select
            label={t("edition")}
            value={edition}
            onChange={(value) => updateParam("edition", value)}
            options={choices([
              ["2026-1", t("editions.2026-1")],
              ["2026-2", t("editions.2026-2")],
              ["2025-2", t("editions.2025-2")],
              ["2025-1", t("editions.2025-1")],
              ["2024", t("editions.2024")],
            ])}
          />
          <Select
            label={t("course")}
            value={course}
            onChange={(value) => updateParam("courseId", value)}
            options={choices([
              ["phone", t("courses.phone")],
              ["internet", t("courses.internet")],
              ["photo", t("courses.photo")],
              ["security", t("courses.security")],
              ["computer", t("courses.computer")],
            ])}
          />
          <Select
            label={t("level")}
            value={level}
            onChange={(value) => updateParam("level", value)}
            options={choices([
              ["Iniciante", t("levels.beginner")],
              ["Intermediário", t("levels.intermediate")],
              ["Avançado", t("levels.advanced")],
            ])}
          />
          <details className="relative min-h-11">
            <summary className="flex min-h-11 cursor-pointer items-center rounded-xl border border-tedi-divider bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2">
              {t("status")}:{" "}
              {status === "archived"
                ? t("archived")
                : statuses.length
                  ? statuses.map((value) => statusLabels[value as ClassStatus]).join(", ")
                  : t("all")}
            </summary>
            <div
              className="absolute z-10 mt-1 w-full rounded-xl border border-tedi-divider bg-white p-3 shadow-lg"
              role="group"
              aria-label={t("status")}
            >
              {(Object.keys(statusLabels) as ClassStatus[]).map((value) => (
                <Checkbox
                  key={value}
                  label={statusLabels[value]}
                  isSelected={statuses.includes(value)}
                  onChange={(checked) => {
                    const selected = new Set(statuses);
                    if (checked) selected.add(value);
                    else selected.delete(value);
                    updateParam("status", [...selected].join(","));
                  }}
                />
              ))}
              <Checkbox
                label={t("archived")}
                isSelected={status === "archived"}
                onChange={(checked) => updateParam("status", checked ? "archived" : "")}
              />
            </div>
          </details>
        </div>
        <hr className="my-3 border-tedi-divider" />
        <DataTable
          columns={columns}
          rows={mockState || filtered.length === 0 ? [] : rows}
          rowKey={(row) => row.id}
          caption={t("title", { count: filtered.length })}
        />
        {mockState === "loading" ? (
          <ListState variant="loading" title={t("loading")} />
        ) : mockState === "error" ? (
          <ListState
            variant="error"
            title={t("error")}
            action={{
              label: t("retry"),
              onPress: () => {
                const next = new URLSearchParams(params);
                next.delete("mockState");
                setParams(next);
              },
            }}
          />
        ) : mockState === "empty" ||
          (records.filter((r) => !r.archived).length === 0 &&
            status !== "archived" &&
            !search &&
            !edition &&
            !course &&
            !level &&
            !status) ? (
          <ListState
            variant="empty"
            title={t("empty")}
            description={t("emptyDescription")}
            action={{
              label: t("create"),
              onPress: openCreate,
            }}
          />
        ) : filtered.length === 0 ? (
          <ListState
            variant="noResults"
            title={t("noResults")}
            action={{ label: t("clear"), onPress: clear }}
          />
        ) : null}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <p className="text-base text-muted">
              {t("summary", { shown: rows.length, total: filtered.length })}
            </p>
            {pages > 1 && (
              <Pagination
                page={page}
                totalPages={pages}
                onPageChange={(nextPage) => updateParam("page", String(nextPage), false)}
                label={t("actions")}
                previousLabel={t("previous")}
                nextLabel={t("next")}
                pageLabel={(number) => t("page", { page: number })}
              />
            )}
          </div>
        )}
        {editing && (
          <Dialog
            isOpen={dialog}
            onOpenChange={(open) => {
              setDialog(open);
              if (!open) setEditing(null);
            }}
            title={records.some((r) => r.id === editing.id) ? t("editTitle") : t("newTitle")}
            closeLabel={t("close")}
            footer={
              <>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setDialog(false);
                    setEditing(null);
                  }}
                >
                  {t("cancel")}
                </Button>
                <Button onPress={save}>{t("save")}</Button>
              </>
            }
          >
            <div className="grid gap-3">
              <TextField
                label={t("code")}
                value={editing.code}
                onChange={(value) => setEditing({ ...editing, code: value })}
              />
              <TextField
                label={t("name")}
                value={editing.name}
                onChange={(value) => setEditing({ ...editing, name: value })}
              />
              <TextField
                label={t("start")}
                value={editing.start}
                onChange={(value) => setEditing({ ...editing, start: value })}
              />
              <TextField
                label={t("end")}
                value={editing.end}
                onChange={(value) => setEditing({ ...editing, end: value })}
              />
              <TextField
                label={t("capacity")}
                value={String(editing.capacity)}
                onChange={(value) => setEditing({ ...editing, capacity: Number(value) })}
              />
            </div>
          </Dialog>
        )}
        {archiving && (
          <Dialog
            isOpen={true}
            onOpenChange={(open) => {
              if (!open) setArchiving(null);
            }}
            title={t("archiveConfirm")}
            closeLabel={t("close")}
            footer={
              <>
                <Button variant="secondary" onPress={() => setArchiving(null)}>
                  {t("cancel")}
                </Button>
                <Button
                  onPress={() => {
                    setRecords((all) =>
                      all.map((r) => (r.id === archiving.id ? { ...r, archived: true } : r)),
                    );
                    setArchiving(null);
                  }}
                >
                  {t("confirm")}
                </Button>
              </>
            }
          >
            <p>{archiving.name}</p>
          </Dialog>
        )}
      </Card>
    </section>
  );
}
