import { useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DataTable, type Column } from "@shared/components/DataTable";
import { ListState } from "@shared/components/ListState";
import { Button, Card, Checkbox, Chip, Dialog, Pagination, Select, TextField } from "@shared/ui";
import chevronDownIcon from "@shared/assets/icons/chevron-down.svg";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";

import { ClassFormDialog } from "../components/ClassFormDialog";
import {
  initialClasses,
  mockCourses,
  type ClassRecord,
  type ClassStatus,
} from "../mocks/classes.mock";

const PAGE_SIZE = 10;
const blank = (id: string): ClassRecord => ({
  id,
  code: "",
  name: "",
  courseId: "computer",
  course: "Informática Básica",
  editionId: "2026-1",
  edition: "2026.1",
  level: "Iniciante",
  start: "2026-03-03",
  end: "2026-06-27",
  location: "Laboratório 2 — Bloco B",
  enrolled: 0,
  capacity: 15,
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
      headerClassName: "w-[49%]",
      cellClassName: "w-[49%]",
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
      headerClassName: "w-[20%]",
      cellClassName: "w-[20%] whitespace-nowrap",
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
      headerClassName: "w-[9%]",
      cellClassName: "w-[9%] whitespace-nowrap",
      render: (row) => (
        <span>
          {row.enrolled}/{row.capacity}
        </span>
      ),
    },
    {
      header: t("status"),
      headerClassName: "w-[13%]",
      cellClassName: "w-[13%]",
      render: (row) => (
        <Chip
          color={
            row.status === "completed" || row.archived
              ? "default"
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
      headerClassName: "w-[9%]",
      cellClassName: "w-[9%]",
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            isIconOnly
            aria-label={t("edit")}
            isDisabled={row.archived}
            onPress={() => {
              setEditing(row);
            }}
          >
            <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
          </Button>
          {row.archived ? (
            <Button
              variant="ghost"
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
              variant="ghost"
              isIconOnly
              aria-label={t("archive")}
              onPress={() => {
                setArchiving(row);
              }}
            >
              <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
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
  function saveClass(savedClass: ClassRecord) {
    setRecords((all) =>
      all.some((row) => row.id === savedClass.id)
        ? all.map((row) => (row.id === savedClass.id ? savedClass : row))
        : [savedClass, ...all],
    );
    setEditing(null);
  }
  const choices = (values: Array<{ id: string; label: string }>) => [
    { id: "", label: t("all") },
    ...values,
  ];
  const formatFilterValue = (label: string) => (selected: { label: string } | null) =>
    `${label}: ${selected?.label.toLocaleLowerCase() ?? t("all").toLocaleLowerCase()}`;

  return (
    <section
      aria-labelledby="classes-title"
      className="-mx-4 -my-6 min-h-[calc(100vh-8.75rem)] bg-sky-50 px-4 py-6 lg:-mx-10 lg:-my-8 lg:px-10 lg:py-8"
    >
      <Card
        className="min-h-[calc(100vh-9rem)] rounded-3xl"
        title={
          <span id="classes-title">
            {t("title", { count: mockState === "empty" ? 0 : filtered.length })}
          </span>
        }
        aside={<Button onPress={openCreate}>{t("create")}</Button>}
      >
        <div className="flex min-h-[calc(100vh-15rem)] flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.05fr_.95fr_1fr]">
            <TextField
              label={t("search")}
              isLabelHidden
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(value) => updateParam("search", value)}
            />
            <Select
              label={t("edition")}
              isLabelHidden
              value={edition}
              onChange={(value) => updateParam("edition", value)}
              formatValue={formatFilterValue(t("edition"))}
              options={choices([
                { id: "2026-1", label: t("editions.2026-1") },
                { id: "2026-2", label: t("editions.2026-2") },
                { id: "2025-2", label: t("editions.2025-2") },
                { id: "2025-1", label: t("editions.2025-1") },
                { id: "2024", label: t("editions.2024") },
              ])}
            />
            <Select
              label={t("course")}
              isLabelHidden
              value={course}
              onChange={(value) => updateParam("courseId", value)}
              formatValue={formatFilterValue(t("course"))}
              options={choices(
                mockCourses.map((item) => ({
                  id: item.id,
                  label: t(`courses.${item.localeKey}`),
                })),
              )}
            />
            <Select
              label={t("level")}
              isLabelHidden
              value={level}
              onChange={(value) => updateParam("level", value)}
              formatValue={formatFilterValue(t("level"))}
              options={choices([
                { id: "Iniciante", label: t("levels.beginner") },
                { id: "Intermediário", label: t("levels.intermediate") },
                { id: "Avançado", label: t("levels.advanced") },
              ])}
            />
            <details className="relative min-h-11">
              <summary className="flex min-h-11 list-none cursor-pointer items-center justify-between rounded-xl border border-[var(--field-border)] bg-white px-3 text-base shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                <span>
                  {t("status")}:{" "}
                  {status === "archived"
                    ? t("archived")
                    : statuses.length
                      ? statuses.map((value) => statusLabels[value as ClassStatus]).join(", ")
                      : t("all").toLocaleLowerCase()}
                </span>
                <img src={chevronDownIcon} alt="" aria-hidden="true" width={16} height={16} />
              </summary>
              <div
                className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--field-border)] bg-white p-3 shadow-lg"
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
          <hr className="border-tedi-divider" />
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
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
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
        </div>
        {editing && (
          <ClassFormDialog
            initialClass={editing}
            isEditing={records.some((record) => record.id === editing.id)}
            onOpenChange={(isOpen) => {
              if (!isOpen) setEditing(null);
            }}
            onSave={saveClass}
          />
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
