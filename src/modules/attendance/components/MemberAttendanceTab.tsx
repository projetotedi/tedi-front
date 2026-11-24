import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import {
  getListMemberAttendanceQueryKey,
  useConfirmMemberAttendance,
} from "@api/generated/attendance/attendance";
import type { LessonResponseDto, MemberAttendanceResponseDto } from "@api/generated/model";
import { formatHours } from "@shared/lib/format";
import { toast } from "@shared/ui";

import type { RollCallDraft } from "../hooks/useRollCallDraft";
import { toAttendanceError } from "../lib/attendance-errors";
import { invalidateMemberAttendance } from "../lib/attendance-queries";
import type { RollCallEntry, RollCallRow } from "../lib/roll-call";
import { CorrectAttendanceDialog } from "./CorrectAttendanceDialog";
import { RollCallPanel } from "./RollCallPanel";

export interface MemberAttendanceTabProps {
  lesson: LessonResponseDto;
  members: MemberAttendanceResponseDto[];
  draft: RollCallDraft;
  canConfirm: (member: MemberAttendanceResponseDto) => boolean;
  isOwn: (member: MemberAttendanceResponseDto) => boolean;
  canCorrect: boolean;
  onSigned: () => void;
}

/** The tab "Monitores e professores": confirming a presence generates the lesson hours of the member. */
export function MemberAttendanceTab({
  lesson,
  members,
  draft,
  canConfirm,
  isOwn,
  canCorrect,
  onSigned,
}: MemberAttendanceTabProps): ReactElement {
  const { t } = useTranslation("attendance");
  const queryClient = useQueryClient();
  const [correctingId, setCorrectingId] = useState<string | null>(null);

  const confirm = useConfirmMemberAttendance({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getListMemberAttendanceQueryKey(lesson.id), updated);
      },
      onSettled: (_data, _error, { data }) => {
        const sent = new Set(data.entries.map((entry) => entry.assignmentId));
        const personIds = members.flatMap((member) =>
          sent.has(member.assignmentId) && member.person ? [member.person.id] : [],
        );
        void invalidateMemberAttendance(queryClient, lesson.id, personIds);
      },
    },
  });

  function nameOf(member: MemberAttendanceResponseDto): string {
    return member.person?.name ?? t("removedPerson");
  }

  function signEntries(entries: RollCallEntry[]) {
    if (confirm.isPending || entries.length === 0) return;
    confirm.mutate(
      {
        id: lesson.id,
        data: { entries: entries.map(({ key, status }) => ({ assignmentId: key, status })) },
      },
      {
        onSuccess: () => {
          toast.success(t("members.signed", { count: entries.length }));
          draft.clear();
          onSigned();
        },
        onError: (error) => toast.error(t(`errors.${toAttendanceError(error)}`)),
      },
    );
  }

  const rows = members.map((member): RollCallRow => ({
    key: member.assignmentId,
    name: nameOf(member),
    detail: t(`members.role.${member.role}`),
    status: member.status,
    isJustified: false,
    signedBy: member.confirmedBy?.name ?? null,
    signedAt: member.confirmedAt,
    canSign: canConfirm(member),
    isSelf: isOwn(member),
    onCorrect:
      canCorrect && member.status !== null && canConfirm(member)
        ? () => {
            confirm.reset();
            setCorrectingId(member.assignmentId);
          }
        : undefined,
  }));
  const correcting = members.find((member) => member.assignmentId === correctingId);

  return (
    <div className="flex flex-col gap-3">
      <RollCallPanel
        kind="members"
        rows={rows}
        draft={draft}
        lessonDate={lesson.date}
        canAct={rows.some((row) => row.canSign)}
        isSaving={confirm.isPending && correctingId === null}
        onSign={signEntries}
      />
      <p className="text-sm text-muted">
        {t("members.hoursNotice", { hours: formatHours(lesson.durationMinutes) })}
      </p>
      {correcting?.status && correcting.confirmedAt ? (
        <CorrectAttendanceDialog
          key={correcting.status}
          kind="member"
          lesson={lesson}
          name={nameOf(correcting)}
          detail={t(`members.role.${correcting.role}`)}
          status={correcting.status}
          signedBy={correcting.confirmedBy?.name ?? null}
          signedAt={correcting.confirmedAt}
          isSaving={confirm.isPending}
          error={confirm.isError ? toAttendanceError(confirm.error) : null}
          onClose={() => setCorrectingId(null)}
          onSubmit={({ status }) =>
            confirm.mutate(
              {
                id: lesson.id,
                data: { entries: [{ assignmentId: correcting.assignmentId, status }] },
              },
              {
                onSuccess: () => {
                  toast.success(t("correct.success"));
                  setCorrectingId(null);
                },
              },
            )
          }
        />
      ) : null}
    </div>
  );
}
