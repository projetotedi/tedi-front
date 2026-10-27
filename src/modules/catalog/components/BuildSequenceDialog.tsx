import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useReplaceCourseLessonPlans } from "@api/generated/catalog/catalog";
import type { CourseLessonPlansResponseDto } from "@api/generated/model";
import { replaceCourseLessonPlansBodyLessonPlanIdsMax } from "@api/generated/zod/catalog/catalog";
import { formatHours } from "@shared/lib/format";
import { moveItem } from "@shared/lib/reorder";
import { Alert, Badge, Button, Dialog, SortableList, toast } from "@shared/ui";

import { applyReplacedSequence } from "../lib/course-queries";
import {
  sequenceWorkloadMinutes,
  toLessonPlanIds,
  toSequenceItems,
  type SequenceItem,
} from "../lib/course-sequence";
import { toSequenceErrorKind, type SequenceErrorKind } from "../lib/course-sequence-errors";
import { LessonPlanPicker } from "./LessonPlanPicker";

export interface BuildSequenceDialogProps {
  courseId: string;
  /** The saved sequence: where the draft starts, and where Cancelar brings it back to. */
  sequence: CourseLessonPlansResponseDto;
  onClose: () => void;
  /** The API said the course is archived (409): the screen under the dialog records it. */
  onCourseArchived: () => void;
}

type RowAction = "up" | "down" | "remove";

/** Where the focus goes once the draft has been rendered again (see the effect below). */
type PendingFocus =
  | { kind: "row"; lessonPlanId: string; action: RowAction; fallback?: RowAction }
  | { kind: "empty" };

/**
 * "Montar sequência do curso" (RF-014, RF-016, RF-018): the ordered lesson plans of a course, with
 * the picker to add one, a way to take one out, the order changed by dragging or with the arrow
 * buttons of each row (the keyboard path) and the planned workload recalculated as the draft
 * changes. Nothing is saved until Salvar sequência, which sends the whole list in one `PUT`;
 * Cancelar, Esc and the backdrop throw the draft away.
 *
 * The dialog does not use React Hook Form: there is no field to type, so there is nothing to
 * validate. The errors of the `PUT` (a repeated plan, an archived course...) show as an alert and
 * keep the draft, so the person can fix it and try again.
 */
export function BuildSequenceDialog({
  courseId,
  sequence,
  onClose,
  onCourseArchived,
}: BuildSequenceDialogProps): ReactElement {
  const { t } = useTranslation("catalog");
  const queryClient = useQueryClient();
  const idPrefix = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<PendingFocus | null>(null);
  const saved = useMemo(() => toSequenceItems(sequence), [sequence]);
  const [draft, setDraft] = useState<SequenceItem[]>(() => toSequenceItems(sequence));
  const [announcement, setAnnouncement] = useState("");
  const [errorKind, setErrorKind] = useState<SequenceErrorKind | null>(null);

  const replaceSequence = useReplaceCourseLessonPlans({
    mutation: {
      onSuccess: (data) => {
        void applyReplacedSequence(queryClient, courseId, data);
        toast.success(t("toast.sequenceSaved"));
        onClose();
      },
      onError: (error) => {
        const kind = toSequenceErrorKind(error);
        setErrorKind(kind);
        if (kind === "courseArchived") onCourseArchived();
      },
    },
  });
  const isSaving = replaceSequence.isPending;

  const rowButtonId = useCallback(
    (lessonPlanId: string, action: RowAction) => `${idPrefix}-${lessonPlanId}-${action}`,
    [idPrefix],
  );
  const emptyId = `${idPrefix}-empty`;

  /**
   * Gives the focus back after a move or a removal. The list draws its rows one render after this
   * dialog (React Aria builds its collection first), so right after the draft changes the page
   * still shows the old rows; one frame later it shows the new ones, and the button to focus (or
   * its disabled state, at the edge of the list) is the one that will stay.
   */
  useEffect(() => {
    if (pendingFocusRef.current === null) return;

    const frame = requestAnimationFrame(() => {
      const pending = pendingFocusRef.current;
      pendingFocusRef.current = null;
      if (pending === null) return;

      if (pending.kind === "empty") {
        document.getElementById(emptyId)?.focus();
        return;
      }

      const preferred = document.getElementById(rowButtonId(pending.lessonPlanId, pending.action));
      const fallback =
        pending.fallback === undefined
          ? null
          : document.getElementById(rowButtonId(pending.lessonPlanId, pending.fallback));
      const isPreferredUsable = preferred instanceof HTMLButtonElement && !preferred.disabled;
      (isPreferredUsable ? preferred : fallback)?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [draft, emptyId, rowButtonId]);

  useEffect(() => {
    if (errorKind !== null) errorRef.current?.focus();
  }, [errorKind]);

  /**
   * Every change of the draft: the last error was about the draft that had been sent, so it goes
   * away (the archived course is the exception, it says nothing about the draft).
   */
  function changeDraft(next: SequenceItem[], pendingFocus: PendingFocus | null) {
    pendingFocusRef.current = pendingFocus;
    setDraft(next);
    setErrorKind((current) => (current === "courseArchived" ? current : null));
  }

  function add(item: SequenceItem) {
    const next = [...draft, item];
    changeDraft(next, null);
    setAnnouncement(
      t("course.sequence.added", {
        title: item.title,
        position: next.length,
        total: next.length,
        workload: formatHours(sequenceWorkloadMinutes(next)),
      }),
    );
  }

  function remove(index: number) {
    const item = draft[index];
    const next = draft.filter((_, position) => position !== index);
    const neighbour = next[index] ?? next[index - 1];

    changeDraft(
      next,
      neighbour === undefined
        ? { kind: "empty" }
        : { kind: "row", lessonPlanId: neighbour.lessonPlanId, action: "remove" },
    );
    setAnnouncement(
      t("course.sequence.removed", {
        title: item.title,
        count: next.length,
        workload: formatHours(sequenceWorkloadMinutes(next)),
      }),
    );
  }

  /** The arrow buttons. The focus follows the plan that moved, on the button that was pressed. */
  function move(index: number, offset: -1 | 1) {
    const item = draft[index];
    const position = index + offset;

    changeDraft(moveItem(draft, index, position), {
      kind: "row",
      lessonPlanId: item.lessonPlanId,
      action: offset === -1 ? "up" : "down",
      // At the edge the pressed arrow turns off: the focus goes to the other one.
      fallback: offset === -1 ? "down" : "up",
    });
    setAnnouncement(
      t("course.sequence.moved", {
        title: item.title,
        position: position + 1,
        total: draft.length,
      }),
    );
  }

  /** The drop of a drag. React Aria announces it and puts the focus back by itself. */
  function drop(lessonPlanId: string, toIndex: number) {
    const from = draft.findIndex((item) => item.lessonPlanId === lessonPlanId);
    changeDraft(moveItem(draft, from, toIndex), null);
  }

  function save() {
    setErrorKind(null);
    replaceSequence.mutate({ id: courseId, data: { lessonPlanIds: toLessonPlanIds(draft) } });
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("course.sequence.title")}
      closeLabel={t("close")}
      size="wide"
      isDismissable={!isSaving}
      footer={
        <>
          <Button variant="secondary" isDisabled={isSaving} onPress={onClose}>
            {t("course.sequence.cancel")}
          </Button>
          <Button isLoading={isSaving} isDisabled={errorKind === "courseArchived"} onPress={save}>
            {isSaving ? t("course.sequence.saving") : t("course.sequence.save")}
          </Button>
        </>
      }
    >
      {/* The body of the HeroUI modal is 14px in the secondary color: the content sets its own. */}
      <div className="flex flex-col gap-5 text-base text-foreground">
        <LessonPlanPicker
          courseId={courseId}
          saved={saved}
          draft={draft}
          isAtLimit={draft.length >= replaceCourseLessonPlansBodyLessonPlanIdsMax}
          onAdd={add}
        />

        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">
            {t("course.sequence.listTitle", { count: draft.length })}
          </h3>
          <SortableList
            aria-label={t("course.sequence.listLabel")}
            items={draft}
            getKey={(item) => item.lessonPlanId}
            getTextValue={(item, index) =>
              t("course.sequence.itemLabel", { position: index + 1, title: item.title })
            }
            dragLabel={(item) => t("course.sequence.drag", { title: item.title })}
            onMove={drop}
            renderEmptyState={() => (
              <p
                id={emptyId}
                tabIndex={-1}
                className="rounded-[10px] bg-surface-secondary px-3 py-2.5 text-base text-tedi-neutral-foreground outline-hidden focus-visible:ring-3 focus-visible:ring-focus"
              >
                {t("course.sequence.empty")}
              </p>
            )}
            renderItem={(item, index) => (
              <>
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-md border border-border-secondary bg-surface text-sm font-medium"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="flex flex-wrap items-center gap-x-2 text-base font-medium break-words">
                    {item.title}
                    {item.archivedAt !== null ? (
                      <Badge tone="neutral">{t("archived")}</Badge>
                    ) : null}
                  </p>
                  <p className="text-sm text-tedi-neutral-foreground">
                    {t("course.sequence.itemSubtitle", {
                      duration: formatHours(item.expectedDurationMinutes),
                    })}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    id={rowButtonId(item.lessonPlanId, "up")}
                    variant="ghost"
                    isIconOnly
                    aria-label={t("course.sequence.moveUp", { title: item.title })}
                    isDisabled={index === 0}
                    onPress={() => move(index, -1)}
                  >
                    <span aria-hidden="true" className="text-lg font-medium text-sky-800">
                      ↑
                    </span>
                  </Button>
                  <Button
                    id={rowButtonId(item.lessonPlanId, "down")}
                    variant="ghost"
                    isIconOnly
                    aria-label={t("course.sequence.moveDown", { title: item.title })}
                    isDisabled={index === draft.length - 1}
                    onPress={() => move(index, 1)}
                  >
                    <span aria-hidden="true" className="text-lg font-medium text-sky-800">
                      ↓
                    </span>
                  </Button>
                  <Button
                    id={rowButtonId(item.lessonPlanId, "remove")}
                    variant="ghost"
                    aria-label={t("course.sequence.removeLabel", { title: item.title })}
                    className="text-danger"
                    onPress={() => remove(index)}
                  >
                    {t("course.sequence.remove")}
                  </Button>
                </div>
              </>
            )}
          />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-base font-semibold">
            {t("course.sequence.workload", {
              workload: formatHours(sequenceWorkloadMinutes(draft)),
            })}
          </p>
          <p className="text-sm text-muted">{t("course.sequence.workloadHint")}</p>
        </div>

        {errorKind !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{t(`course.sequence.errors.${errorKind}`)}</Alert>
          </div>
        ) : null}

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
    </Dialog>
  );
}
