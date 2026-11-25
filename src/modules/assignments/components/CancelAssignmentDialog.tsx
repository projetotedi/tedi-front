import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useCancelAssignment } from "@api/generated/assignments/assignments";
import type { MemberAssignmentResponseDto } from "@api/generated/model";
import { Alert, Button, Dialog, toast } from "@shared/ui";

import { ASSIGNMENT_ROLE_LABEL_KEYS } from "../lib/assignment-labels";
import { toCancelAssignmentError, type AssignmentIssue } from "../lib/assignment-errors";
import { formatDayMonth } from "../lib/format";
import { invalidateAfterAssignmentChange } from "../lib/assignment-queries";

export interface CancelAssignmentDialogProps {
  /** The assignment to cancel, as the card of the member lists it. */
  assignment: MemberAssignmentResponseDto;
  /** The member whose card lists it: her list is the one that changes. */
  memberId: string;
  onClose: () => void;
  /** Called when the API cancelled it, before `onClose`. */
  onCancelled: () => void;
}

/**
 * "Cancelar alocação": the confirmation of cancelling one assignment of a member, which says which
 * one (the role, the lesson and the day) and what it does (the place becomes free and the coverage of
 * the lesson is updated). Voltar (`secondary`, and the one that has the focus when it opens, since the
 * other one cannot be undone from here) and Cancelar alocação (`danger`).
 *
 * Cancelling sends `PATCH /assignments/:id/cancel`, which has no body and no reason. On success the
 * cache is told (`invalidateAfterAssignmentChange`: the list of the member, the lesson and its
 * coverage), the toast says so, `onCancelled` and then `onClose` are called. The request is the one of
 * a screen that already shows the assignment, so what can go wrong is that somebody else changed it
 * first: 409 `ASSIGNMENT_NOT_ACTIVE` is a warning (it is not pending or confirmed any more, so there
 * is nothing to cancel) and 404 `ASSIGNMENT_NOT_FOUND` an alert; both ask the lists again, so the card
 * behind the dialog shows what is true now, and turn Cancelar alocação off. The network and anything
 * else is an alert that a new attempt clears. The warning or the alert takes the focus.
 *
 * While the request is on its way the dialog cannot be closed (X, Esc and Voltar are off) and a second
 * press is ignored. It is mounted only while it is open, so each opening starts clean.
 */
export function CancelAssignmentDialog({
  assignment,
  memberId,
  onClose,
  onCancelled,
}: CancelAssignmentDialogProps): ReactElement {
  const { t, i18n } = useTranslation("assignments");
  const queryClient = useQueryClient();
  const issueRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [issue, setIssue] = useState<AssignmentIssue | null>(null);

  const change = { lessonId: assignment.lesson.id, personId: memberId };
  const cancelAssignment = useCancelAssignment({
    mutation: {
      // The cache is told even if the dialog is gone by the time the answer arrives.
      onSuccess: () => void invalidateAfterAssignmentChange(queryClient, change),
    },
  });
  const isPending = cancelAssignment.isPending;
  // The assignment is not what the screen showed, so there is nothing left to cancel.
  const isSettled =
    issue?.kind === "warning" || (issue?.kind === "alert" && issue.alert === "assignmentNotFound");

  useEffect(() => {
    if (issue !== null) issueRef.current?.focus();
  }, [issue]);

  function handleError(error: unknown) {
    const result = toCancelAssignmentError(error);

    const isStale =
      result.kind === "warning" ||
      (result.kind === "alert" && result.alert === "assignmentNotFound");
    if (isStale) void invalidateAfterAssignmentChange(queryClient, change);

    setIssue(result);
  }

  function cancel() {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setIssue(null);

    cancelAssignment.mutate(
      { id: assignment.id },
      {
        onSuccess: () => {
          toast.success(t("toast.cancelled"));
          onCancelled();
          onClose();
        },
        onError: handleError,
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("cancelDialog.title")}
      description={t("cancelDialog.description", {
        role: t(ASSIGNMENT_ROLE_LABEL_KEYS[assignment.role]).toLocaleLowerCase(i18n.language),
        title: assignment.lesson.title,
        date: formatDayMonth(assignment.lesson.date, i18n.language),
      })}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" autoFocus isDisabled={isPending} onPress={onClose}>
            {t("cancelDialog.back")}
          </Button>
          <Button variant="danger" isLoading={isPending} isDisabled={isSettled} onPress={cancel}>
            {isPending ? t("cancelDialog.submitting") : t("cancelDialog.submit")}
          </Button>
        </>
      }
    >
      {issue === null ? null : (
        <div ref={issueRef} tabIndex={-1} className="outline-none">
          {issue.kind === "warning" ? (
            <Alert variant="warning">{t(`warnings.${issue.warning}`)}</Alert>
          ) : (
            <Alert variant="error">{t(`errors.${issue.alert}`)}</Alert>
          )}
        </div>
      )}
    </Dialog>
  );
}
