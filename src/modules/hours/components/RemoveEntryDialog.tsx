import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useRemoveMyHourEntry } from "@api/generated/hours/hours";
import type { HourEntryResponseDto } from "@api/generated/model";
import { useAuth } from "@modules/auth";
import { formatHours } from "@shared/lib/format";
import { Alert, Button, Dialog, toast } from "@shared/ui";

import { formatDayMonth } from "../lib/entry-format";
import { isStaleEntry, toRemoveEntryError, type RemoveEntryIssue } from "../lib/entry-errors";
import { ENTRY_CATEGORY_LABEL_KEYS } from "../lib/entry-labels";
import { invalidateAfterOwnEntryChange } from "../lib/entry-queries";

export interface RemoveEntryDialogProps {
  /** The entry to remove, as the statement lists it: pending, and not from the attendance. */
  entry: HourEntryResponseDto;
  onClose: () => void;
  /** Called when the API removed it, before `onClose`; the lists are still being read again. */
  onRemoved: () => void;
  /** Called when the API says the entry changed meanwhile (validated, a lesson hour, gone). */
  onStale: () => void;
}

/**
 * "Remover lançamento": the confirmation of removing one pending entry, opened over the statement.
 * It sums the entry up (the day, the category, the declared hours, the activity and that it waits
 * for validation) and warns that a sent entry cannot be edited, only removed and logged again; the
 * dialog is described by both, so they are read when it opens. Voltar (`secondary`, with the focus
 * when it opens, since the other cannot be undone) and Remover lançamento (`danger`).
 *
 * `DELETE /me/hour-entries/:id`. On success the toast says so, `onRemoved` and `onClose` are called
 * at once, and the summary and the entries of the person are read again in the background: the entry
 * is already gone in the API, so a slow or failed read must not hold the dialog. A refusal that says
 * the entry changed meanwhile (validated, a lesson hour, gone) turns Remover lançamento off, no longer
 * says the entry waits for validation, reads the lists again and calls `onStale`; the network and
 * anything else are an alert that a new attempt clears. The warning or the alert
 * takes the focus. While the request is on its way the dialog cannot be closed (X, Esc and Voltar are
 * off) and a second press is ignored. Mount it only while it is open.
 */
export function RemoveEntryDialog({
  entry,
  onClose,
  onRemoved,
  onStale,
}: RemoveEntryDialogProps): ReactElement {
  const { t, i18n } = useTranslation("hours");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const personId = user === null ? null : user.id;
  const summaryId = useId();
  const warningId = useId();
  const issueRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [issue, setIssue] = useState<RemoveEntryIssue | null>(null);

  // The cache is told even if the dialog is gone by the time the answer arrives, without holding it.
  const removeEntry = useRemoveMyHourEntry({
    mutation: { onSuccess: () => void invalidateAfterOwnEntryChange(queryClient, personId) },
  });
  const isPending = removeEntry.isPending;
  const isSettled = issue !== null && isStaleEntry(issue);
  const date = formatDayMonth(entry.date, i18n.language);

  useEffect(() => {
    if (issue !== null) issueRef.current?.focus();
  }, [issue]);

  function handleError(error: unknown) {
    const result = toRemoveEntryError(error);

    if (isStaleEntry(result)) {
      void invalidateAfterOwnEntryChange(queryClient, personId);
      onStale();
    }
    setIssue(result);
  }

  function remove() {
    if (isPending || inFlightRef.current || isSettled) return;
    inFlightRef.current = true;
    setIssue(null);

    removeEntry.mutate(
      { id: entry.id },
      {
        onSuccess: () => {
          toast.success(t("removeEntry.toastTitle"), {
            description: t("removeEntry.toastDescription", { activity: entry.activity, date }),
          });
          onRemoved();
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
      title={t("removeEntry.title")}
      closeLabel={t("entries.close")}
      isDismissable={!isPending}
      aria-describedby={`${summaryId} ${warningId}`}
      footer={
        <>
          <Button variant="secondary" autoFocus isDisabled={isPending} onPress={onClose}>
            {t("removeEntry.back")}
          </Button>
          <Button variant="danger" isLoading={isPending} isDisabled={isSettled} onPress={remove}>
            {isPending ? t("removeEntry.submitting") : t("removeEntry.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          id={summaryId}
          className="flex flex-col gap-1.5 rounded-xl bg-tedi-surface-subtle px-4 py-3.5 text-foreground"
        >
          <p className="text-base font-semibold">
            {t("removeEntry.summary", {
              date,
              category: t(ENTRY_CATEGORY_LABEL_KEYS[entry.category]),
              hours: formatHours(entry.declaredMinutes),
            })}
          </p>
          <p className="text-base">{entry.activity}</p>
          {/* After a refusal that the entry changed, it may not be waiting for validation any more. */}
          {isSettled ? null : <p className="text-sm text-muted">{t("removeEntry.pendingLabel")}</p>}
        </div>

        <Alert variant="warning" id={warningId}>
          {t("removeEntry.warning")}
        </Alert>

        {issue === null ? null : (
          <div ref={issueRef} tabIndex={-1} className="outline-none">
            {issue.kind === "warning" ? (
              <Alert variant="warning">{t(`removeEntry.warnings.${issue.warning}`)}</Alert>
            ) : (
              <Alert variant="error">{t(`removeEntry.errors.${issue.alert}`)}</Alert>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
