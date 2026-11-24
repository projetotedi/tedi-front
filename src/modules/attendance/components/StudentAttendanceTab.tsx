import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import {
  getListStudentAttendanceQueryKey,
  useCorrectStudentAttendance,
  useSignStudentAttendance,
} from "@api/generated/attendance/attendance";
import type { LessonResponseDto, StudentRollCallItemResponseDto } from "@api/generated/model";
import { toast } from "@shared/ui";

import type { RollCallDraft } from "../hooks/useRollCallDraft";
import { toAttendanceError } from "../lib/attendance-errors";
import { invalidateStudentAttendance } from "../lib/attendance-queries";
import { RollCallStatus, type RollCallEntry, type RollCallRow } from "../lib/roll-call";
import { CorrectAttendanceDialog } from "./CorrectAttendanceDialog";
import { JustifyAbsenceDialog } from "./JustifyAbsenceDialog";
import { RollCallPanel } from "./RollCallPanel";

export interface StudentAttendanceTabProps {
  lesson: LessonResponseDto;
  items: StudentRollCallItemResponseDto[];
  draft: RollCallDraft;
  canTake: boolean;
  canCorrect: boolean;
  onSigned: () => void;
}

/** The tab "Alunos" of the roll call: sign in batch, justify an absence and correct a signed attendance. */
export function StudentAttendanceTab({
  lesson,
  items,
  draft,
  canTake,
  canCorrect,
  onSigned,
}: StudentAttendanceTabProps): ReactElement {
  const { t } = useTranslation("attendance");
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{
    kind: "justify" | "correct";
    enrollmentId: string;
  } | null>(null);
  const sign = useSignStudentAttendance({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getListStudentAttendanceQueryKey(lesson.id), updated);
      },
      onSettled: () => {
        void invalidateStudentAttendance(queryClient, lesson);
      },
    },
  });
  const correct = useCorrectStudentAttendance({
    mutation: { onSettled: () => void invalidateStudentAttendance(queryClient, lesson) },
  });

  function nameOf(item: StudentRollCallItemResponseDto): string {
    return item.student?.name ?? t("removedPerson");
  }

  function signEntries(entries: RollCallEntry[]) {
    if (sign.isPending || entries.length === 0) return;
    sign.mutate(
      {
        id: lesson.id,
        data: { entries: entries.map(({ key, status }) => ({ enrollmentId: key, status })) },
      },
      {
        onSuccess: () => {
          toast.success(t("students.signed", { count: entries.length }));
          draft.clear();
          onSigned();
        },
        onError: (error) => toast.error(t(`errors.${toAttendanceError(error)}`)),
      },
    );
  }

  function openDialog(kind: "justify" | "correct", enrollmentId: string) {
    correct.reset();
    setDialog({ kind, enrollmentId });
  }

  const rows = items.map((item): RollCallRow => {
    const { attendance, enrollment } = item;
    return {
      key: enrollment.id,
      name: nameOf(item),
      detail: t(`enrollmentStatus.${enrollment.status}`),
      status: attendance?.status ?? null,
      isJustified: attendance?.justified ?? false,
      signedBy: attendance?.signedBy?.name ?? null,
      signedAt: attendance?.signedAt ?? null,
      canSign: canTake,
      isSelf: false,
      onCorrect: canCorrect && attendance ? () => openDialog("correct", enrollment.id) : undefined,
      onJustify:
        canTake && attendance?.status === RollCallStatus.absent
          ? () => openDialog("justify", enrollment.id)
          : undefined,
    };
  });

  const target = items.find((item) => item.enrollment.id === dialog?.enrollmentId);
  const attendance = target?.attendance ?? null;

  return (
    <>
      <RollCallPanel
        kind="students"
        rows={rows}
        draft={draft}
        lessonDate={lesson.date}
        canAct={canTake}
        isSaving={sign.isPending}
        onSign={signEntries}
      />
      {dialog?.kind === "justify" && target && attendance ? (
        <JustifyAbsenceDialog
          lesson={lesson}
          studentName={nameOf(target)}
          attendance={attendance}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "correct" && target && attendance ? (
        <CorrectAttendanceDialog
          key={attendance.status}
          kind="student"
          lesson={lesson}
          name={nameOf(target)}
          detail={t("students.role")}
          status={attendance.status}
          signedBy={attendance.signedBy?.name ?? null}
          signedAt={attendance.signedAt}
          corrections={attendance.corrections}
          isSaving={correct.isPending}
          error={correct.isError ? toAttendanceError(correct.error) : null}
          onClose={() => setDialog(null)}
          onSubmit={(data) =>
            correct.mutate(
              { id: attendance.id, data },
              {
                onSuccess: () => {
                  toast.success(t("correct.success"));
                  setDialog(null);
                },
              },
            )
          }
        />
      ) : null}
    </>
  );
}
