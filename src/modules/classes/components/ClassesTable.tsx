import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { ClassListItemDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge, Button } from "@shared/ui";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";

import { CLASS_STATUS_LABEL_KEYS, classStatusTone } from "../lib/class-status";
import { formatPeriod } from "../lib/format-period";
import { LINK_CLASSES } from "./link-classes";

export interface ClassesTableProps {
  classes: ClassListItemDto[];
  caption: string;
  onEdit: (item: ClassListItemDto) => void;
  onArchive: (item: ClassListItemDto) => void;
  onUnarchive: (item: ClassListItemDto) => void;
}

/**
 * The table of the list of classes, with the columns of the Figma: Turma (its name, or the code
 * when it has none, linking to its screen, with the code and the course under it), Período, Vagas
 * (students over seats), Status ("Arquivada" for an archived class) and Ações. The actions are only
 * for who manages classes (`classes.manage`): the pencil and the bin on an active class, Reativar
 * on an archived one.
 */
export function ClassesTable({
  classes,
  caption,
  onEdit,
  onArchive,
  onUnarchive,
}: ClassesTableProps): ReactElement {
  const { t, i18n } = useTranslation("classes");
  const canManage = useCan("classes.manage");

  const columns: Column<ClassListItemDto>[] = [
    {
      header: t("class"),
      headerClassName: "w-[44%]",
      cellClassName: "w-[44%]",
      render: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link to={`/classes/${row.id}`} className={`${LINK_CLASSES} font-medium`}>
            {row.name || row.code}
          </Link>
          <span className="text-sm text-muted">
            {t("row.subtitle", { code: row.code, course: row.course.name })}
          </span>
        </div>
      ),
    },
    {
      header: t("period"),
      headerClassName: "w-[20%]",
      cellClassName: "w-[20%] whitespace-nowrap",
      render: (row) => <span>{formatPeriod(row.startDate, row.endDate, i18n.language)}</span>,
    },
    {
      header: t("seats"),
      headerClassName: "w-[10%]",
      cellClassName: "w-[10%] whitespace-nowrap",
      render: (row) => (
        <span
          aria-label={t("row.seatsLabel", { enrolled: row.enrolledCount, capacity: row.capacity })}
        >
          {row.enrolledCount}/{row.capacity}
        </span>
      ),
    },
    {
      header: t("status"),
      headerClassName: "w-[13%]",
      cellClassName: "w-[13%]",
      render: (row) =>
        row.archivedAt ? (
          <Badge tone="neutral">{t("detail.archived")}</Badge>
        ) : (
          <Badge tone={classStatusTone(row.status)}>{t(CLASS_STATUS_LABEL_KEYS[row.status])}</Badge>
        ),
    },
  ];

  if (canManage) {
    columns.push({
      header: t("actions"),
      headerClassName: "w-[13%]",
      cellClassName: "w-[13%]",
      render: (row) => {
        const name = row.name || row.code;

        return row.archivedAt ? (
          <Button
            variant="ghost"
            aria-label={t("row.unarchive", { name })}
            onPress={() => onUnarchive(row)}
          >
            {t("restore")}
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t("row.edit", { name })}
              onPress={() => onEdit(row)}
            >
              <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
            </Button>
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t("row.archive", { name })}
              onPress={() => onArchive(row)}
            >
              <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
            </Button>
          </div>
        );
      },
    });
  }

  return <DataTable columns={columns} rows={classes} rowKey={(row) => row.id} caption={caption} />;
}
