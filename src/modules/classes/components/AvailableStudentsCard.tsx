import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useEnrollStudents, useListAvailableStudents } from "@api/generated/classes/classes";
import type {
  AvailableStudentItemResponseDto,
  EnrollStudentsResponseDto,
} from "@api/generated/model";
import { ListState } from "@shared/components/ListState";
import { useDebounce } from "@shared/hooks/useDebounce";
import { resolveListState } from "@shared/lib/list-state";
import { Alert, Button, Card, Checkbox, Pagination, TextField, toast } from "@shared/ui";

import { seatsLeftOf, toEnrollmentError, type EnrollmentErrorKind } from "../lib/enrollment-errors";
import { invalidateAfterEnrollmentChanged } from "../lib/enrollment-queries";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export interface AvailableStudentsCardProps {
  classId: string;
  /** Seats the class still has (`capacity - enrolledCount`). */
  seatsLeft: number;
  /** The class takes no enrollment (archived, completed or cancelled): the list is read-only. */
  closedReason: "archived" | "closed" | null;
  /** A student to start selected (`?studentId=`, from "Matricular em turma" on the student). */
  preselectedStudentId?: string;
}

/**
 * "Alunos disponíveis" (GUS-138, Figma): the students that can enter the class, searched by name,
 * each with a box, the age and the classes they are in now ("sem turma atual" when none). The
 * selection survives the search and the pages, and its count is announced. Selecting more students
 * than the seats left warns before sending and turns Matricular selecionados off; the API still
 * answers 409 `CLASS_FULL` if the seats ran out meanwhile, and then nobody is enrolled.
 *
 * After a batch, a toast says how many entered, who was already enrolled (`skipped`) and who lacks
 * a prerequisite (`warnings`, which do not block), and the lists, the seats and the class are read
 * again.
 */
export function AvailableStudentsCard({
  classId,
  seatsLeft,
  closedReason,
  preselectedStudentId,
}: AvailableStudentsCardProps): ReactElement {
  const { t, i18n } = useTranslation("classes");
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);
  const [searchText, setSearchText] = useState("");
  const search = useDebounce(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlyMap<string, string>>(
    () => new Map(preselectedStudentId ? [[preselectedStudentId, ""]] : []),
  );
  const [submitError, setSubmitError] = useState<{
    kind: EnrollmentErrorKind;
    seats: number | null;
  } | null>(null);

  const query = useListAvailableStudents(
    classId,
    { page, limit: PAGE_SIZE, ...(search ? { search } : {}) },
    { query: { placeholderData: keepPreviousData } },
  );
  const enroll = useEnrollStudents();

  const rows = query.data?.data ?? [];
  const total = query.data?.total;
  const totalPages =
    query.data === undefined ? 1 : Math.max(1, Math.ceil(query.data.total / query.data.limit));
  const isClosed = closedReason !== null;
  const overCapacity = selected.size > seatsLeft;
  const listState = resolveListState({
    isPending: query.isPending,
    isError: query.isError,
    total,
    hasActiveFilters: search !== "",
  });

  function toggle(student: AvailableStudentItemResponseDto, isSelected: boolean) {
    setSelected((current) => {
      const next = new Map(current);
      if (isSelected) next.set(student.id, student.name);
      else next.delete(student.id);
      return next;
    });
  }

  function situationOf(student: AvailableStudentItemResponseDto): string {
    if (student.currentClasses.length === 0) return t("enrollment.available.noClass");
    return t("enrollment.available.currentClasses", {
      classes: student.currentClasses.map((schoolClass) => schoolClass.code).join(", "),
    });
  }

  function nameOf(studentId: string): string {
    return (
      selected.get(studentId) ||
      rows.find((student) => student.id === studentId)?.name ||
      t("enrollment.available.unknownStudent")
    );
  }

  function listNames(ids: string[]): string {
    return new Intl.ListFormat(i18n.language, { style: "long", type: "conjunction" }).format(
      ids.map(nameOf),
    );
  }

  function announceResult(result: EnrollStudentsResponseDto) {
    const lines: string[] = [];
    if (result.skipped.length > 0) {
      lines.push(
        t("enrollment.available.skipped", {
          count: result.skipped.length,
          names: listNames(result.skipped.map((item) => item.studentId)),
        }),
      );
    }
    for (const warning of result.warnings) {
      lines.push(
        t("enrollment.available.prerequisiteWarning", {
          name: nameOf(warning.studentId),
          course: warning.courseName,
        }),
      );
    }
    const description = lines.length > 0 ? lines.join(" ") : undefined;
    if (result.enrolled.length > 0) {
      toast.success(t("enrollment.available.success", { count: result.enrolled.length }), {
        description,
      });
    } else {
      toast.neutral(t("enrollment.available.nobodyEnrolled"), { description });
    }
  }

  function enrollSelected() {
    if (enroll.isPending || inFlightRef.current || selected.size === 0 || overCapacity) return;
    inFlightRef.current = true;
    setSubmitError(null);

    enroll.mutate(
      { id: classId, data: { studentIds: [...selected.keys()] } },
      {
        onSuccess: async (result) => {
          announceResult(result);
          setSelected(new Map());
          await invalidateAfterEnrollmentChanged(queryClient);
        },
        onError: (error) => {
          setSubmitError({ kind: toEnrollmentError(error), seats: seatsLeftOf(error) });
        },
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  return (
    <Card title={t("enrollment.available.title")}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("enrollment.available.description")}</p>

        {isClosed ? (
          <Alert variant="warning">{t(`enrollment.available.closed.${closedReason}`)}</Alert>
        ) : null}

        <TextField
          label={t("enrollment.available.search")}
          placeholder={t("enrollment.available.searchPlaceholder")}
          value={searchText}
          onChange={(value) => {
            setSearchText(value);
            setPage(1);
          }}
        />

        {listState !== null ? (
          <ListState
            variant={listState}
            title={t(`enrollment.available.state.${listState}`)}
            action={
              listState === "error"
                ? {
                    label: t("detail.retry"),
                    onPress: () => void query.refetch(),
                    isLoading: query.isFetching,
                  }
                : listState === "noResults"
                  ? {
                      label: t("clear"),
                      onPress: () => {
                        setSearchText("");
                        setPage(1);
                      },
                    }
                  : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-3" aria-label={t("enrollment.available.title")}>
            {rows.map((student) => (
              <li key={student.id}>
                <Checkbox
                  isSelected={selected.has(student.id)}
                  isDisabled={isClosed || enroll.isPending}
                  onChange={(isSelected) => toggle(student, isSelected)}
                  label={
                    <span className="flex flex-col">
                      <span>{student.name}</span>
                      <span className="text-sm text-muted">
                        {t("enrollment.available.details", {
                          age: student.age,
                          situation: situationOf(student),
                        })}
                      </span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <Pagination
            page={Math.min(page, totalPages)}
            totalPages={totalPages}
            onPageChange={setPage}
            label={t("enrollment.available.pagination")}
            previousLabel={t("previous")}
            nextLabel={t("next")}
            pageLabel={(number) => t("page", { page: number })}
          />
        ) : null}

        <p role="status" aria-live="polite" className="text-sm text-muted">
          {t("enrollment.available.selectedCount", { count: selected.size })}
        </p>

        {overCapacity && !isClosed ? (
          <Alert variant="warning">
            {t("enrollment.available.overCapacity", { count: seatsLeft })}
          </Alert>
        ) : null}

        {submitError !== null ? (
          <Alert variant="error">
            {t(`enrollment.errors.${submitError.kind}`, { count: submitError.seats ?? 0 })}
          </Alert>
        ) : null}

        <Button
          variant="primary"
          isLoading={enroll.isPending}
          isDisabled={isClosed || selected.size === 0 || overCapacity}
          onPress={enrollSelected}
        >
          {t("enrollment.available.enrollSelected", { count: selected.size })}
        </Button>
      </div>
    </Card>
  );
}
