import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import pencilIcon from "@shared/assets/icons/pencil.svg";
import { DataTable, type Column } from "@shared/components/DataTable";
import { useMediaQuery } from "@shared/hooks/useMediaQuery";
import { Button, Checkbox } from "@shared/ui";

import type { RollCallDraft } from "../hooks/useRollCallDraft";
import { formatSignedAt } from "../lib/attendance-format";
import {
  isPendingRow,
  MOBILE_QUERY,
  RollCallStatus,
  type RollCallEntry,
  type RollCallRow,
} from "../lib/roll-call";
import { AttendanceStatusTag } from "./AttendanceStatusTag";
import { AttendanceToggle } from "./AttendanceToggle";

export interface RollCallPanelProps {
  kind: "students" | "members";
  rows: RollCallRow[];
  draft: RollCallDraft;
  lessonDate: string;
  canAct: boolean;
  isSaving: boolean;
  onSign: (entries: RollCallEntry[]) => void;
}

/** The roll call of one tab: a table with batch actions, or a one-column list with a fixed save button on phones. */
export function RollCallPanel({
  kind,
  rows,
  draft,
  lessonDate,
  canAct,
  isSaving,
  onSign,
}: RollCallPanelProps): ReactElement {
  const { t, i18n } = useTranslation("attendance");
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const pendingKeys = rows.filter(isPendingRow).map((row) => row.key);
  const selected = draft.selectedEntries(pendingKeys);
  const marked = draft.markedEntries(pendingKeys);
  const ownHint = (row: RollCallRow) =>
    row.isSelf && canAct ? <p className="text-sm text-muted">{t("members.ownRowHint")}</p> : null;

  function signedText(row: RollCallRow): string {
    if (row.status === null || row.signedAt === null) return t("table.notSigned");
    return t("table.signedBy", {
      name: row.signedBy ?? t("removedPerson"),
      time: formatSignedAt(row.signedAt, lessonDate, i18n.language),
    });
  }

  function renderToggle(row: RollCallRow, isFullWidth: boolean): ReactElement | null {
    if (row.status !== null || !(row.canSign || (row.isSelf && canAct))) return null;
    return (
      <AttendanceToggle
        name={row.name}
        value={draft.statusOf(row.key)}
        onChange={(status) => draft.setStatus(row.key, status)}
        isDisabled={!row.canSign || isSaving}
        isFullWidth={isFullWidth}
      />
    );
  }

  function renderRowActions(row: RollCallRow): ReactElement | null {
    if (row.onJustify === undefined && row.onCorrect === undefined) return null;
    const justifyKey = row.isJustified ? "actions.editJustification" : "actions.justify";
    return (
      <div className="flex items-center gap-1">
        {row.onJustify ? (
          <Button
            variant="ghost"
            isDisabled={isSaving}
            aria-label={t(`${justifyKey}For`, { name: row.name })}
            onPress={row.onJustify}
          >
            {t(justifyKey)}
          </Button>
        ) : null}
        {row.onCorrect ? (
          <Button
            variant="ghost"
            isIconOnly
            isDisabled={isSaving}
            aria-label={t("actions.correctFor", { name: row.name })}
            onPress={row.onCorrect}
          >
            <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
          </Button>
        ) : null}
      </div>
    );
  }

  if (rows.length === 0) return <p className="text-base text-muted">{t(`${kind}.empty`)}</p>;

  if (isMobile) {
    const count = (status: RollCallStatus | null) =>
      rows.filter((row) => row.status === status).length;

    return (
      <div className="flex flex-col gap-3">
        <p className="text-base text-muted">
          {t("mobile.summary", {
            present: t("mobile.present", { count: count(RollCallStatus.present) }),
            absent: t("mobile.absent", { count: count(RollCallStatus.absent) }),
            pending: t("mobile.pending", { count: count(null) }),
          })}
        </p>
        <ul aria-label={t(`${kind}.caption`)} className="flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex flex-col gap-2 rounded-2xl border border-tedi-divider p-3.5"
            >
              <p className="text-base font-medium break-words">{row.name}</p>
              <p className="text-sm text-muted">
                {row.status === null
                  ? t("mobile.rowPending", { detail: row.detail })
                  : t("mobile.rowSigned", { detail: row.detail, signed: signedText(row) })}
              </p>
              {row.status === null ? null : (
                <AttendanceStatusTag status={row.status} isJustified={row.isJustified} />
              )}
              {ownHint(row)}
              {renderToggle(row, true)}
              {renderRowActions(row)}
            </li>
          ))}
        </ul>
        {pendingKeys.length > 0 ? (
          <>
            <div aria-hidden="true" className="h-20" />
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-tedi-divider bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button
                variant="primary"
                className="w-full"
                isLoading={isSaving}
                isDisabled={marked.length === 0}
                onPress={() => onSign(marked)}
              >
                {t(`${kind}.save`, { count: marked.length })}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  const isAllSelected = pendingKeys.length > 0 && selected.length === pendingKeys.length;
  const columns: Column<RollCallRow>[] = [
    ...(canAct
      ? [
          {
            header: t("table.select"),
            headerClassName: "w-14",
            headerContent: (
              <Checkbox
                label={t("table.selectAll")}
                isLabelHidden
                isSelected={isAllSelected}
                isIndeterminate={selected.length > 0 && !isAllSelected}
                isDisabled={pendingKeys.length === 0 || isSaving}
                onChange={(isSelected) => draft.setSelected(pendingKeys, isSelected)}
              />
            ),
            render: (row: RollCallRow) =>
              row.status === null ? (
                <Checkbox
                  label={t("table.selectRow", { name: row.name })}
                  isLabelHidden
                  isSelected={row.canSign && draft.isSelected(row.key)}
                  isDisabled={!row.canSign || isSaving}
                  onChange={(isSelected) => draft.setSelected([row.key], isSelected)}
                />
              ) : null,
          },
        ]
      : []),
    {
      header: t(`${kind}.columns.name`),
      headerClassName: "uppercase",
      render: (row) => (
        <>
          {row.name}
          {ownHint(row)}
        </>
      ),
    },
    {
      header: t(`${kind}.columns.detail`),
      headerClassName: "uppercase",
      render: (row) => row.detail,
    },
    {
      header: t("table.attendance"),
      cellClassName: "whitespace-nowrap",
      headerClassName: "uppercase",
      render: (row) => <AttendanceStatusTag status={row.status} isJustified={row.isJustified} />,
    },
    { header: t("table.signed"), headerClassName: "uppercase", render: signedText },
    {
      header: t("table.actions"),
      headerClassName: "uppercase",
      render: (row) => renderToggle(row, false) ?? renderRowActions(row),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {canAct ? (
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-[10px] bg-tedi-surface-subtle py-1.5 pr-1.5 pl-3.5">
          <p role="status" className="text-sm text-muted">
            {t("batch.summary", {
              total: t(`${kind}.total`, { count: rows.length }),
              selected:
                selected.length === 0
                  ? t("batch.noneSelected")
                  : t("batch.selected", { count: selected.length }),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              isDisabled={selected.length === 0 || isSaving}
              onPress={() => draft.markAbsent(selected.map((entry) => entry.key))}
            >
              {t("batch.markAbsent")}
            </Button>
            <Button
              variant="primary"
              isLoading={isSaving}
              isDisabled={selected.length === 0}
              onPress={() => onSign(selected)}
            >
              {selected.length === 0
                ? t("batch.sign")
                : t("batch.signCount", { count: selected.length })}
            </Button>
          </div>
        </div>
      ) : null}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        caption={t(`${kind}.caption`)}
        tableClassName="min-w-200"
      />
    </div>
  );
}
