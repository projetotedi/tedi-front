import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListClassEnrollments, useRemoveEnrollment } from "@api/generated/classes/classes";
import { EnrollmentStatus, type ClassEnrollmentItemResponseDto } from "@api/generated/model";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { ListState } from "@shared/components/ListState";
import { resolveListState } from "@shared/lib/list-state";
import { Avatar, Button, Card, Pagination, toast } from "@shared/ui";

import { toEnrollmentError } from "../lib/enrollment-errors";
import { invalidateAfterEnrollmentChanged } from "../lib/enrollment-queries";
import { formatInstantDate } from "../lib/format";

const PAGE_SIZE = 20;

export interface ClassEnrollmentsCardProps {
  classId: string;
  /** The class takes no change (archived): Remover is not offered. */
  isReadOnly: boolean;
}

/**
 * "Matriculados nesta turma (N)" (GUS-138, Figma): the active enrollments of the class, with the
 * day each student entered and Remover. Removing asks first, and the API only removes an active
 * enrollment with no attendance signed (409 `ENROLLMENT_NOT_REMOVABLE`): then the dialog says to
 * change the status instead. The other statuses are changed in "Alterar situação", on the card
 * "Alunos matriculados" of the class.
 */
export function ClassEnrollmentsCard({
  classId,
  isReadOnly,
}: ClassEnrollmentsCardProps): ReactElement {
  const { t, i18n } = useTranslation("classes");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [toRemove, setToRemove] = useState<ClassEnrollmentItemResponseDto | null>(null);
  const [removeError, setRemoveError] = useState<string | undefined>(undefined);

  const query = useListClassEnrollments(
    classId,
    { page, limit: PAGE_SIZE, status: EnrollmentStatus.active },
    { query: { placeholderData: keepPreviousData } },
  );
  const remove = useRemoveEnrollment();

  const rows = query.data?.data ?? [];
  const total = query.data?.total;
  const totalPages =
    query.data === undefined ? 1 : Math.max(1, Math.ceil(query.data.total / query.data.limit));
  const listState = resolveListState({
    isPending: query.isPending,
    isError: query.isError,
    total,
    hasActiveFilters: false,
  });

  function closeRemove() {
    setToRemove(null);
    setRemoveError(undefined);
  }

  function confirmRemove() {
    if (toRemove === null || remove.isPending) return;
    const enrollment = toRemove;

    remove.mutate(
      { id: enrollment.id },
      {
        onSuccess: async () => {
          toast.success(t("enrollment.enrolled.removed", { name: enrollment.student.name }));
          closeRemove();
          await invalidateAfterEnrollmentChanged(queryClient);
        },
        onError: (error) => {
          setRemoveError(t(`enrollment.errors.${toEnrollmentError(error)}`, { count: 0 }));
        },
      },
    );
  }

  return (
    <Card title={t("enrollment.enrolled.title", { count: total ?? 0 })}>
      <div className="flex flex-col gap-4">
        {listState !== null ? (
          <ListState
            variant={listState}
            title={t(`enrollment.enrolled.state.${listState}`)}
            action={
              listState === "error"
                ? {
                    label: t("detail.retry"),
                    onPress: () => void query.refetch(),
                    isLoading: query.isFetching,
                  }
                : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-3" aria-label={t("enrollment.enrolled.listLabel")}>
            {rows.map((enrollment) => (
              <li key={enrollment.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={enrollment.student.name} />
                  <div className="flex min-w-0 flex-col">
                    <span className="break-words">{enrollment.student.name}</span>
                    <span className="text-sm text-muted">
                      {t("enrollment.enrolled.since", {
                        date: formatInstantDate(enrollment.enrolledAt, i18n.language),
                      })}
                    </span>
                  </div>
                </div>
                {isReadOnly ? null : (
                  <Button
                    variant="danger-soft"
                    aria-label={t("enrollment.enrolled.removeLabel", {
                      name: enrollment.student.name,
                    })}
                    onPress={() => setToRemove(enrollment)}
                  >
                    {t("enrollment.enrolled.remove")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <Pagination
            page={Math.min(page, totalPages)}
            totalPages={totalPages}
            onPageChange={setPage}
            label={t("enrollment.enrolled.pagination")}
            previousLabel={t("previous")}
            nextLabel={t("next")}
            pageLabel={(number) => t("page", { page: number })}
          />
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={toRemove !== null}
        title={t("enrollment.enrolled.confirmTitle")}
        confirmLabel={t("enrollment.enrolled.confirm")}
        cancelLabel={t("enrollment.statusDialog.back")}
        closeLabel={t("close")}
        tone="danger"
        isConfirming={remove.isPending}
        errorMessage={removeError}
        onConfirm={confirmRemove}
        onCancel={closeRemove}
      >
        <p>{t("enrollment.enrolled.confirmBody", { name: toRemove?.student.name ?? "" })}</p>
      </ConfirmDialog>
    </Card>
  );
}
