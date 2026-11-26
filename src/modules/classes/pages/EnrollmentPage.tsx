import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useGetClass, useListClasses } from "@api/generated/classes/classes";
import { ClassStatus, type ClassListItemDto } from "@api/generated/model";
import { Alert, Badge, Button, Card, Select, Skeleton } from "@shared/ui";

import { AvailableStudentsCard } from "../components/AvailableStudentsCard";
import { ClassEnrollmentsCard } from "../components/ClassEnrollmentsCard";
import { isClassId, isClassNotFound } from "../lib/class-detail";

/** The classes the picker offers: the ones that are not archived, as many as the API gives at once. */
const CLASS_OPTIONS_LIMIT = 100;

const CLOSED_STATUSES: ReadonlySet<ClassStatus> = new Set([
  ClassStatus.completed,
  ClassStatus.cancelled,
]);

function classOptionLabel(schoolClass: Pick<ClassListItemDto, "code" | "name" | "course">): string {
  return `${schoolClass.course.name} — ${schoolClass.name ?? schoolClass.code}`;
}

interface ClassPickerProps {
  classId: string | null;
  onChange: (classId: string) => void;
}

function ClassPicker({ classId, onChange }: ClassPickerProps): ReactElement {
  const { t } = useTranslation("classes");
  const classes = useListClasses({ limit: CLASS_OPTIONS_LIMIT });
  const options = (classes.data?.data ?? []).map((schoolClass) => ({
    id: schoolClass.id,
    label: classOptionLabel(schoolClass),
  }));

  return (
    <div className="w-full max-w-md">
      <Select
        label={t("enrollment.selectClass")}
        placeholder={t("enrollment.selectClassPlaceholder")}
        options={options}
        value={classId}
        onChange={onChange}
        isDisabled={classes.isPending}
        errorMessage={classes.isError ? t("enrollment.classesLoadError") : undefined}
      />
    </div>
  );
}

function ClassEnrollment({
  classId,
  preselectedStudentId,
}: {
  classId: string;
  preselectedStudentId?: string;
}): ReactElement {
  const { t } = useTranslation("classes");
  const classQuery = useGetClass(classId);
  const schoolClass = classQuery.data;

  if (classQuery.isPending) {
    return (
      <div role="status" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <p className="sr-only">{t("detail.loading")}</p>
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (schoolClass === undefined) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">
          {isClassNotFound(classQuery.error)
            ? t("detail.notFoundDescription")
            : t("detail.loadError")}
        </Alert>
        {isClassNotFound(classQuery.error) ? null : (
          <Button
            variant="secondary"
            isLoading={classQuery.isFetching}
            onPress={() => void classQuery.refetch()}
          >
            {t("detail.retry")}
          </Button>
        )}
      </div>
    );
  }

  const { capacity, enrolledCount } = schoolClass.summary;
  const seatsLeft = Math.max(0, capacity - enrolledCount);
  const isArchived = schoolClass.archivedAt !== null;
  const closedReason = isArchived
    ? "archived"
    : CLOSED_STATUSES.has(schoolClass.status)
      ? "closed"
      : null;

  return (
    <div className="flex flex-col gap-5">
      <p>
        <Badge tone="info">{t("row.seatsLabel", { enrolled: enrolledCount, capacity })}</Badge>
      </p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AvailableStudentsCard
          key={classId}
          classId={classId}
          seatsLeft={seatsLeft}
          closedReason={closedReason}
          preselectedStudentId={preselectedStudentId}
        />
        <ClassEnrollmentsCard classId={classId} isReadOnly={isArchived} />
      </div>
    </div>
  );
}

/**
 * Matrícula de Alunos na Turma (GUS-138, Figma). Reached by the menu (`/enrollments`, where the
 * class is picked first), by "Ver todos" on the class (`/classes/:classId/enrollments`) and by
 * "Matricular em turma" on a student (`?studentId=`, who starts selected). Picking another class
 * goes to its address, keeping the student. On the top, the seats taken; below, the students
 * available and the ones enrolled.
 */
export function EnrollmentPage(): ReactElement {
  const { t } = useTranslation("classes");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { classId: routeClassId } = useParams();
  const classId = routeClassId !== undefined && isClassId(routeClassId) ? routeClassId : null;
  const studentId = params.get("studentId") ?? undefined;

  function pickClass(next: string) {
    const search = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
    navigate(`/classes/${next}/enrollments${search}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <ClassPicker classId={classId} onChange={pickClass} />
      {classId === null ? (
        routeClassId === undefined ? (
          <Card>
            <p className="text-base text-muted">{t("enrollment.pickClassFirst")}</p>
          </Card>
        ) : (
          <Alert variant="error">{t("detail.notFoundDescription")}</Alert>
        )
      ) : (
        <ClassEnrollment key={classId} classId={classId} preselectedStudentId={studentId} />
      )}
    </div>
  );
}
