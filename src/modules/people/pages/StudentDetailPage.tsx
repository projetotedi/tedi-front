import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import type { StudentDetailDto } from "@api/generated/model";
import { useGetStudent } from "@api/generated/people/people";
import { useCan } from "@modules/auth";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { ArchiveStudentDialog } from "../components/ArchiveStudentDialog";
import { CourseHistoryCard } from "../components/CourseHistoryCard";
import { StudentAccessibilityCard } from "../components/StudentAccessibilityCard";
import { StudentDetailHeader } from "../components/StudentDetailHeader";
import { StudentEnrollmentsCard } from "../components/StudentEnrollmentsCard";
import { StudentFormDialog } from "../components/StudentFormDialog";
import { StudentPersonalCard } from "../components/StudentPersonalCard";
import { StudentRecordCard } from "../components/StudentRecordCard";
import { StudentSummaryCard } from "../components/StudentSummaryCard";
import { UnarchiveStudentDialog } from "../components/UnarchiveStudentDialog";
import { formatInstantDate } from "../lib/format";
import { isStudentId, isStudentNotFound } from "../lib/student";

/**
 * The two columns start at 90rem (1440px, the width of the Figma). The main column holds a table
 * and a card of three columns; with the side column at 27.5rem they would be left with about
 * 24rem at 1280px. Below 90rem the cards stack in one column and have the whole width. The same
 * breakpoint as the course screen.
 */
const TWO_COLUMNS = "grid grid-cols-1 gap-5 min-[90rem]:grid-cols-[minmax(0,1fr)_27.5rem]";

function LoadingPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-5">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className={TWO_COLUMNS}>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** There is no list of students to go back to yet, so the page says it and stops. */
function StudentNotFound(): ReactElement {
  const { t } = useTranslation("people");

  return (
    <Card title={t("student.notFoundTitle")}>
      <p className="text-base text-muted">{t("student.notFoundDescription")}</p>
    </Card>
  );
}

interface ArchivedNoticeProps {
  archivedAt: string;
  archiveReason: string | null;
}

/**
 * An archived student is not deleted: the registration stays on the screen and the notice says
 * since when, and why when someone wrote a reason. It is static: it is born with the page and the
 * person who opened an archived student already knows where they are going.
 */
function ArchivedNotice({ archivedAt, archiveReason }: ArchivedNoticeProps): ReactElement {
  const { t, i18n } = useTranslation("people");
  const reason = archiveReason?.trim();

  return (
    <Alert
      variant="warning"
      description={reason ? t("student.archived.reason", { reason }) : undefined}
    >
      {t("student.archived.notice", { date: formatInstantDate(archivedAt, i18n.language) })}
    </Alert>
  );
}

type OpenDialog = "edit" | "archive" | "unarchive";

/**
 * The student that was loaded: the header, the notice of an archived one and the two columns of
 * cards. The header has the actions, each only with its permission (`useCan`): Editar dados
 * (`students.manage`, GUS-123), Matricular em turma (`enrollments.manage`, GUS-138: it opens the
 * enrollment screen with the student selected) and Arquivar aluno or Reativar aluno
 * (`students.archive`, GUS-123). An archived student keeps Editar dados and Matricular em turma on
 * the screen, disabled, and gets Reativar aluno.
 */
function StudentDetailView({ student }: { student: StudentDetailDto }): ReactElement {
  const { t } = useTranslation("people");
  const navigate = useNavigate();
  const canManage = useCan("students.manage");
  const canEnroll = useCan("enrollments.manage");
  const canArchive = useCan("students.archive");
  const isArchived = student.archivedAt !== null;
  const [openDialog, setOpenDialog] = useState<OpenDialog | null>(null);
  const closeDialog = () => setOpenDialog(null);
  const hasActions = canManage || canEnroll || canArchive;

  return (
    <div className="flex flex-col gap-5">
      <StudentDetailHeader
        student={student}
        actions={
          hasActions ? (
            <>
              {canManage ? (
                <Button
                  variant="secondary"
                  isDisabled={isArchived}
                  onPress={() => setOpenDialog("edit")}
                >
                  {t("student.actions.edit")}
                </Button>
              ) : null}
              {canEnroll ? (
                <Button
                  variant="primary"
                  isDisabled={isArchived}
                  onPress={() =>
                    navigate(`/enrollments?studentId=${encodeURIComponent(student.id)}`)
                  }
                >
                  {t("student.actions.enroll")}
                </Button>
              ) : null}
              {canArchive ? (
                isArchived ? (
                  <Button variant="secondary" onPress={() => setOpenDialog("unarchive")}>
                    {t("student.actions.unarchive")}
                  </Button>
                ) : (
                  <Button variant="danger-soft" onPress={() => setOpenDialog("archive")}>
                    {t("student.actions.archive")}
                  </Button>
                )
              ) : null}
            </>
          ) : undefined
        }
      />
      {student.archivedAt !== null ? (
        <ArchivedNotice archivedAt={student.archivedAt} archiveReason={student.archiveReason} />
      ) : null}
      <div className={TWO_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-5">
          <StudentPersonalCard student={student} />
          <StudentAccessibilityCard student={student} />
          <StudentEnrollmentsCard />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <StudentSummaryCard />
          <CourseHistoryCard />
          <StudentRecordCard createdBy={student.createdBy} updatedAt={student.updatedAt} />
        </div>
      </div>

      {openDialog === "edit" ? (
        <StudentFormDialog mode="edit" studentId={student.id} onClose={closeDialog} />
      ) : null}
      {openDialog === "archive" ? (
        <ArchiveStudentDialog studentId={student.id} onClose={closeDialog} />
      ) : null}
      {openDialog === "unarchive" ? (
        <UnarchiveStudentDialog studentId={student.id} onClose={closeDialog} />
      ) : null}
    </div>
  );
}

function StudentDetail({ studentId }: { studentId: string }): ReactElement {
  const { t } = useTranslation("people");
  // `gcTime: 0` drops the registration from the cache as soon as the page unmounts, which is what
  // happens when the person signs out or the session expires. It holds health data (LGPD), and
  // signing out does not clear the cache: without it, whoever signs in on this tab within the
  // global `staleTime` (30 s) would see the registration that the previous person opened.
  const studentQuery = useGetStudent(studentId, { query: { gcTime: 0 } });
  const student = studentQuery.data;

  if (studentQuery.isPending) return <LoadingPlaceholder label={t("student.loading")} />;

  if (student === undefined) {
    if (isStudentNotFound(studentQuery.error)) return <StudentNotFound />;

    // A 401 also lands here, but the AuthProvider handles it (`tedi:unauthorized`) and sends the
    // person to the sign in screen, so this alert may only flash before the redirect.
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("student.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={studentQuery.isFetching}
          onPress={() => void studentQuery.refetch()}
        >
          {t("student.retry")}
        </Button>
      </div>
    );
  }

  return <StudentDetailView student={student} />;
}

/**
 * The screen of a student (GUS-124, Figma "Aluno · detalhe"). The page asks the API for one thing,
 * `getStudent` (`students.view`), and the header and the cards that show data come from that
 * answer. Matrículas, Resumo and Histórico de cursos need `listStudentEnrollments`, which is from
 * GUS-108 and is not in the contract yet, so they are cards that say "em breve"; when GUS-108
 * arrives each one will ask for the enrollments inside itself, so that a failure of that query
 * shows only in those cards and the rest of the screen keeps its data.
 *
 * The title of the page is on the topbar (`handle.title` of the route) and it is static, "Aluno":
 * neither the name nor the accessibility of the student (health data, LGPD) go to the title of the
 * tab, so the page has no `<h1>`, no `useDocumentTitle` and writes nothing to the console. The
 * name is the `<h2>` of the header.
 *
 * An id that is not a UUID is "not found" at once, with no request. The id is also the `key` of
 * the detail, so nothing of a student stays on the screen when the route changes to another one.
 */
export function StudentDetailPage(): ReactElement {
  const { studentId = "" } = useParams();

  if (!isStudentId(studentId)) return <StudentNotFound />;

  return <StudentDetail key={studentId} studentId={studentId} />;
}
