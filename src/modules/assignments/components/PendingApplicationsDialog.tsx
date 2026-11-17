import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import {
  useApproveApplication,
  useListPendingApplications,
  useRejectApplication,
} from "@api/generated/assignments/assignments";
import {
  LessonStatus,
  type AssignmentLessonResponseDto,
  type LessonAssignmentResponseDto,
  type PendingApplicationGroupResponseDto,
} from "@api/generated/model";
import { Alert, Badge, Button, Dialog, Skeleton, toast } from "@shared/ui";

import { toReviewError, type ReviewErrorKind } from "../lib/application-errors";
import { lessonLabel, ROLE_LABEL_KEYS } from "../lib/assignment-labels";
import { invalidateAfterReviewed, PENDING_APPLICATIONS_PARAMS } from "../lib/assignment-queries";
import { formatCoverage } from "../lib/coverage";
import { formatLessonDay, formatSentDate, META_SEPARATOR } from "../lib/format";

export interface PendingApplicationsDialogProps {
  onClose: () => void;
}

type ReviewKind = "approve" | "reject";

interface Acting {
  id: string;
  kind: ReviewKind;
}

type OnAct = (
  kind: ReviewKind,
  application: LessonAssignmentResponseDto,
  lesson: AssignmentLessonResponseDto,
) => void;

/**
 * The refusals after which what the dialog shows is out of date, so the queue and the coverage are
 * read again: somebody decided it first (`notPending`, `notFound`), the place was filled by another
 * confirmation (`roleFull`), or the lesson was cancelled meanwhile (`lessonCancelled`, which turns
 * Confirmar off on the lesson).
 */
const STALE_QUEUE_ERRORS: ReadonlySet<ReviewErrorKind> = new Set([
  "notPending",
  "notFound",
  "roleFull",
  "lessonCancelled",
]);

/** The text for an empty queue. After an action emptied it, it takes the focus the button that was pressed lost. */
function EmptyMessage({ text, autoFocus }: { text: string; autoFocus: boolean }): ReactElement {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <p ref={ref} tabIndex={-1} className="text-base text-foreground outline-none">
      {text}
    </p>
  );
}

interface ApplicationGroupProps {
  group: PendingApplicationGroupResponseDto;
  idPrefix: string;
  acting: Acting | null;
  onAct: OnAct;
}

/** A lesson with its pending applications: the lesson and its coverage, then who asked for what. */
function ApplicationGroup({ group, idPrefix, acting, onAct }: ApplicationGroupProps): ReactElement {
  const { t, i18n } = useTranslation("assignments");
  const { lesson, coverage, applications } = group;
  const headingId = `${idPrefix}-${lesson.id}-title`;
  const hintId = `${idPrefix}-${lesson.id}-hint`;
  const isCancelled = lesson.status === LessonStatus.cancelled;
  const isBusy = acting !== null;

  const meta = [
    lesson.class.name,
    formatLessonDay(lesson.date, i18n.language),
    t("timeRange", { start: lesson.startTime, end: lesson.endTime }),
    formatCoverage(coverage, t),
  ].join(META_SEPARATOR);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col rounded-xl bg-surface-secondary p-3 text-foreground"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="text-base font-semibold">
          {lessonLabel(lesson, t)}
        </h3>
        {isCancelled ? (
          <Badge tone="danger">{t("pendingApplications.lessonCancelledBadge")}</Badge>
        ) : null}
      </div>
      {/* The body of the dialog is `text-muted`, 4,2:1 on this background: the lines take a darker gray. */}
      <p className="text-sm text-pretty text-tedi-neutral-foreground">{meta}</p>
      {isCancelled ? (
        <p id={hintId} className="text-sm font-medium">
          {t("pendingApplications.lessonCancelled")}
        </p>
      ) : null}

      <ul className="mt-2 flex flex-col">
        {applications.map((application) => {
          const name = application.person?.name ?? t("pendingApplications.removedPerson");
          const day = formatSentDate(application.createdAt, i18n.language);
          const isApproving = acting?.id === application.id && acting.kind === "approve";
          const isRejecting = acting?.id === application.id && acting.kind === "reject";

          return (
            <li
              key={application.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-tedi-divider py-3 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium">
                  {t("pendingApplications.requestedBy", {
                    name,
                    role: t(ROLE_LABEL_KEYS[application.role]),
                  })}
                </p>
                <p className="text-sm break-words text-tedi-neutral-foreground">
                  {application.note === null
                    ? t("pendingApplications.sentOn", { day })
                    : t("pendingApplications.sentOnWithNote", { day, note: application.note })}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="danger-soft"
                  aria-label={t("pendingApplications.rejectLabel", { name })}
                  isLoading={isRejecting}
                  isDisabled={isBusy && !isRejecting}
                  onPress={() => onAct("reject", application, lesson)}
                >
                  {t("pendingApplications.reject")}
                </Button>
                <Button
                  variant="primary"
                  aria-label={t("pendingApplications.confirmLabel", { name })}
                  aria-describedby={isCancelled ? hintId : undefined}
                  isLoading={isApproving}
                  isDisabled={isCancelled || (isBusy && !isApproving)}
                  onPress={() => onAct("approve", application, lesson)}
                >
                  {t("pendingApplications.confirm")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * "Candidaturas pendentes (N)" (F5.5, RF-053): the queue of the applications that wait for the board
 * or the coordination, grouped by lesson (the soonest first, as the API sends them), each with who
 * asked, for which role, when, and the note, if there is one. The lesson shows its coverage, so the
 * person decides knowing what is missing. **Recusar** and **Confirmar** send `PATCH
 * /applications/:id/reject` and `/approve`; Fechar leaves. The warning at the end says what each
 * action does. The button that opens it (`PendingApplicationsButton`) and the lists of lessons
 * mount it; it is mounted only while open, so each opening starts clean.
 *
 * - **One query with the button.** The key is the same (`PENDING_APPLICATIONS_PARAMS`), so the number
 *   on the button is the `total` of this very list. It is read again when the dialog opens, since the
 *   person decides on what they see.
 * - **Confirmar and Recusar.** While one is on its way, the others are turned off and the dialog
 *   cannot be closed. On success the toast says who, which role and which day, the cache is told
 *   (the queue, the agenda, the coverage of the lesson in the lists, the detail and the calendar)
 *   and the row goes away when the queue is read again. The button that was pressed went with its
 *   row, so the focus goes to the list (or, when the queue is empty, to its message).
 * - **A cancelled lesson** shows the tag Cancelada and a line saying it can only be declined:
 *   Confirmar is turned off and tied to that line, since the API would refuse it (409
 *   `LESSON_CANCELLED`).
 * - **The refusals of the API** show as an alert on top of the list, with the focus. After a refusal
 *   that says the screen is out of date (`STALE_QUEUE_ERRORS`) the queue and the coverage are read again.
 * - **States.** Loading shows skeletons; a failed read with nothing to show says so with "Tentar de
 *   novo" (a failed re-read keeps the list); an empty queue says there is none.
 */
export function PendingApplicationsDialog({
  onClose,
}: PendingApplicationsDialogProps): ReactElement {
  const { t, i18n } = useTranslation("assignments");
  const queryClient = useQueryClient();
  const idPrefix = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [acting, setActing] = useState<Acting | null>(null);
  const [actionError, setActionError] = useState<ReviewErrorKind | null>(null);
  const [hasActed, setHasActed] = useState(false);

  const query = useListPendingApplications(PENDING_APPLICATIONS_PARAMS, {
    query: { refetchOnMount: "always" },
  });
  // The cache is told even if the dialog is gone by the time the answer arrives, and the callbacks
  // of `mutate` run only after it has read the queue again.
  const approve = useApproveApplication({
    mutation: { onSuccess: (application) => invalidateAfterReviewed(queryClient, application) },
  });
  const reject = useRejectApplication({
    mutation: { onSuccess: (application) => invalidateAfterReviewed(queryClient, application) },
  });

  const page = query.data;
  const groups = page?.lessons.filter((group) => group.applications.length > 0) ?? [];
  const isActing = acting !== null;
  const title =
    page === undefined
      ? t("pendingApplications.titleWithoutCount")
      : t("pendingApplications.title", { count: page.total });

  useEffect(() => {
    if (actionError !== null) errorRef.current?.focus();
  }, [actionError]);

  function handleError(error: unknown, application: LessonAssignmentResponseDto) {
    const kind = toReviewError(error);

    if (STALE_QUEUE_ERRORS.has(kind)) void invalidateAfterReviewed(queryClient, application);
    setActionError(kind);
  }

  const act: OnAct = (kind, application, lesson) => {
    if (isActing || inFlightRef.current) return;
    inFlightRef.current = true;
    setActing({ id: application.id, kind });
    setActionError(null);

    const mutation = kind === "approve" ? approve : reject;
    mutation.mutate(
      { id: application.id },
      {
        onSuccess: () => {
          toast.success(
            t(
              kind === "approve"
                ? "pendingApplications.toastConfirmed"
                : "pendingApplications.toastRejected",
            ),
            {
              description: t("pendingApplications.toastDescription", {
                name: application.person?.name ?? t("pendingApplications.removedPerson"),
                role: t(ROLE_LABEL_KEYS[application.role]),
                day: formatLessonDay(lesson.date, i18n.language),
              }),
            },
          );
          setHasActed(true);
          contentRef.current?.focus();
        },
        onError: (error) => handleError(error, application),
        onSettled: () => {
          inFlightRef.current = false;
          setActing(null);
        },
      },
    );
  };

  function renderContent(): ReactElement | ReactElement[] {
    if (query.isPending) {
      return (
        <div role="status" className="flex flex-col gap-3">
          <p className="sr-only">{t("pendingApplications.loading")}</p>
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      );
    }

    // A failed re-read with the queue in the cache keeps the queue: the error is for when there is
    // nothing to show.
    if (page === undefined) {
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("pendingApplications.error")}</Alert>
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

    if (groups.length === 0) {
      return <EmptyMessage text={t("pendingApplications.empty")} autoFocus={hasActed} />;
    }

    return groups.map((group) => (
      <ApplicationGroup
        key={group.lesson.id}
        group={group}
        idPrefix={idPrefix}
        acting={acting}
        onAct={act}
      />
    ));
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={title}
      closeLabel={t("close")}
      isDismissable={!isActing}
      footer={
        <Button variant="primary" isDisabled={isActing} onPress={onClose}>
          {t("close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {actionError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{t(`pendingApplications.errors.${actionError}`)}</Alert>
          </div>
        ) : null}

        {/* Always there, so the focus has somewhere to go when the pressed button leaves with its row. */}
        <div
          ref={contentRef}
          role="group"
          aria-label={title}
          aria-busy={isActing || query.isFetching}
          tabIndex={-1}
          className="flex flex-col gap-4 outline-none"
        >
          {renderContent()}
        </div>

        {groups.length > 0 ? <Alert variant="info">{t("pendingApplications.info")}</Alert> : null}
      </div>
    </Dialog>
  );
}
