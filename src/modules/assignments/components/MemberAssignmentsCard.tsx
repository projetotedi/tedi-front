import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListMemberAssignments } from "@api/generated/assignments/assignments";
import type { MemberAssignmentResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Alert, Badge, Button, Card, Skeleton } from "@shared/ui";

import { toAssignmentRequestError } from "../lib/assignment-errors";
import {
  ASSIGNMENT_ROLE_LABEL_KEYS,
  assignmentRoleTone,
  assignmentStatusLabelKey,
  assignmentStatusTone,
} from "../lib/assignment-labels";
import { formatDayMonth } from "../lib/format";
import { isActiveAssignment } from "../lib/lesson-staff";
import { CancelAssignmentDialog } from "./CancelAssignmentDialog";

/** How many assignments the card lists at first: "Ver todas as N" opens the whole list on the same screen. */
export const MEMBER_ASSIGNMENTS_PREVIEW_LIMIT = 5;

export interface MemberAssignmentsCardProps {
  memberId: string;
}

/**
 * "Alocações em aulas": what a member is assigned to, as a table (lesson, day, role and status), the
 * card of the sheet of the member. The class column of the Figma is not drawn: the API does not give
 * the class of the lesson in this list (F7).
 *
 * It lists the first 5, in the order of the API (the lesson that is latest first), and "Ver todas as
 * N ›" opens the whole list on the same card (F10): there is no screen for the full list and the API
 * does not paginate it. The role and the status are tags with text, and a pending assignment that
 * came from an application is "Inscrita". Who can assign (`assignments.create`) also has, on each
 * assignment that is still pending or confirmed, the button that cancels it, named after the lesson
 * and the day, which opens `CancelAssignmentDialog`. The cancelled assignment stays in the list, as
 * "Cancelada", with no button: the list of the member is history too.
 *
 * It asks the API by itself (`GET /members/:id/assignments`), so the failure is the card's. Only with
 * `members.view`: without it the card is not drawn and nothing is asked. A director reads the
 * assignments of the members of her own department only (A14), so the 403 is told in words, not
 * shown as a failure; the other errors are an alert with "Tentar de novo".
 *
 * The button of the row goes away when the assignment is cancelled, and with it the focus the dialog
 * would give back, so after cancelling the card takes the focus to the region of the table.
 */
export function MemberAssignmentsCard({
  memberId,
}: MemberAssignmentsCardProps): ReactElement | null {
  const { t, i18n } = useTranslation("assignments");
  const canView = useCan("members.view");
  const canCancel = useCan("assignments.create");
  const query = useListMemberAssignments(memberId, { query: { enabled: canView } });
  const regionId = useId();
  const regionRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cancelling, setCancelling] = useState<MemberAssignmentResponseDto | null>(null);
  // Counts the cancellations, so each one takes the focus to the region, even two in a row.
  const [cancelledCount, setCancelledCount] = useState(0);

  useEffect(() => {
    if (cancelledCount > 0) regionRef.current?.focus();
  }, [cancelledCount]);

  if (!canView) return null;

  const assignments = query.data;
  const hasMore =
    assignments !== undefined && assignments.length > MEMBER_ASSIGNMENTS_PREVIEW_LIMIT;
  // The first five, or all of them once "Ver todas" is open (there is nothing to list before the answer).
  const rows =
    assignments === undefined
      ? []
      : isExpanded
        ? assignments
        : assignments.slice(0, MEMBER_ASSIGNMENTS_PREVIEW_LIMIT);

  const columns: Column<MemberAssignmentResponseDto>[] = [
    {
      header: t("memberAssignments.columns.lesson"),
      headerClassName: "uppercase",
      render: (assignment) => assignment.lesson.title,
    },
    {
      header: t("memberAssignments.columns.date"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (assignment) => formatDayMonth(assignment.lesson.date, i18n.language),
    },
    {
      header: t("memberAssignments.columns.role"),
      headerClassName: "uppercase",
      render: (assignment) => (
        <Badge tone={assignmentRoleTone(assignment.role)}>
          {t(ASSIGNMENT_ROLE_LABEL_KEYS[assignment.role])}
        </Badge>
      ),
    },
    {
      header: t("memberAssignments.columns.status"),
      headerClassName: "uppercase",
      render: (assignment) => (
        <Badge tone={assignmentStatusTone(assignment.status)}>
          {t(assignmentStatusLabelKey(assignment.status, assignment.source))}
        </Badge>
      ),
    },
    ...(canCancel
      ? [
          {
            header: t("memberAssignments.columns.actions"),
            headerClassName: "uppercase",
            render: (assignment: MemberAssignmentResponseDto) =>
              isActiveAssignment(assignment.status) ? (
                <Button
                  variant="ghost"
                  isIconOnly
                  aria-label={t("memberAssignments.cancelFor", {
                    title: assignment.lesson.title,
                    date: formatDayMonth(assignment.lesson.date, i18n.language),
                  })}
                  onPress={() => setCancelling(assignment)}
                >
                  <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  const viewAll = hasMore ? (
    <Button
      variant="ghost"
      aria-expanded={isExpanded}
      aria-controls={regionId}
      onPress={() => setIsExpanded((expanded) => !expanded)}
    >
      {isExpanded ? (
        t("memberAssignments.viewLess")
      ) : (
        <>
          {t("memberAssignments.viewAll", { count: assignments.length })}
          <span aria-hidden="true" className="ms-1">
            ›
          </span>
        </>
      )}
    </Button>
  ) : null;

  function renderContent(): ReactElement {
    if (query.isPending) {
      return (
        <div role="status" className="flex flex-col gap-3">
          <p className="sr-only">{t("memberAssignments.loading")}</p>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      );
    }

    // A failed refetch with the list in the cache keeps the list: the error is for when there is
    // nothing to show.
    if (assignments === undefined) {
      if (toAssignmentRequestError(query.error) === "forbidden") {
        return <p className="text-base text-muted">{t("memberAssignments.forbidden")}</p>;
      }

      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("memberAssignments.error")}</Alert>
          <Button
            variant="secondary"
            isLoading={query.isFetching}
            onPress={() => void query.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      );
    }

    if (assignments.length === 0) {
      return <p className="text-base text-muted">{t("memberAssignments.empty")}</p>;
    }

    return (
      <div
        id={regionId}
        ref={regionRef}
        role="region"
        aria-label={t("memberAssignments.title")}
        tabIndex={-1}
        className="outline-none"
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(assignment) => assignment.id}
          caption={t("memberAssignments.caption")}
        />
      </div>
    );
  }

  return (
    <>
      <Card title={t("memberAssignments.title")} aside={viewAll}>
        {renderContent()}
      </Card>
      {cancelling === null ? null : (
        <CancelAssignmentDialog
          assignment={cancelling}
          memberId={memberId}
          onClose={() => setCancelling(null)}
          onCancelled={() => setCancelledCount((count) => count + 1)}
        />
      )}
    </>
  );
}
