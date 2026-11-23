import { useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { useGetLesson } from "@api/generated/lessons/lessons";
import { LessonStatus, type LessonResponseDto } from "@api/generated/model";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { ComingSoonCard } from "../components/ComingSoonCard";
import { LessonBreadcrumb } from "../components/LessonBreadcrumb";
import { LessonChangesCard } from "../components/LessonChangesCard";
import { LessonDataCard } from "../components/LessonDataCard";
import { LessonDetailActions } from "../components/LessonDetailActions";
import { LessonDetailHeader } from "../components/LessonDetailHeader";
import { LessonLinksCard } from "../components/LessonLinksCard";
import { LINK_CLASSES } from "../components/link-classes";
import { isLessonId } from "../lib/lesson-detail";
import { toLessonRequestError } from "../lib/lesson-errors";

/**
 * The two columns start at 90rem (1440px, the width of the Figma), as in the screens of a class and
 * of a course. The data card has four fields to a row and the side column is 27.5rem wide, so below
 * that width the cards stack in one column and the fields have the whole width instead of breaking in
 * the middle of a word.
 */
const TWO_COLUMNS = "grid grid-cols-1 gap-5 min-[90rem]:grid-cols-[minmax(0,1fr)_27.5rem]";

function LessonDetailSkeleton({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-5">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-6 w-2/3 rounded-xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className={TWO_COLUMNS}>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** The lesson does not exist, or the id cannot be one: the page says it and takes the way back to the list. */
function LessonNotFound(): ReactElement {
  const { t } = useTranslation("lessons");

  return (
    <Card title={t("detail.notFoundTitle")}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-base text-muted">{t("detail.notFoundDescription")}</p>
        <Link to="/lessons" className={LINK_CLASSES}>
          {t("detail.backToList")}
        </Link>
      </div>
    </Card>
  );
}

/**
 * The lesson that was loaded: the trail, the header with the actions and the two columns of cards.
 * The data of the lesson come from `lesson`, which is what the query holds, so a dialog that saves
 * the lesson (reschedule, cancel, edit) puts the answer in the cache and this screen changes with no
 * new request.
 *
 * Cancelling turns the three actions off, and the button that opened the dialog is one of them: a
 * button that is turned off cannot get the focus back, and the focus would fall to the page. So the
 * screen takes the focus to the card of the cancelling, which is the news (the reason, now there).
 * It waits for the card to exist: the effect runs when the later of the two arrives, the callback of
 * the dialog (`focusChanges`) or the status `cancelled` in the cache, whichever comes first. It runs
 * once and needs no reset: a cancelled lesson is final, so neither value goes back, and the screen
 * of another lesson is a new one (`key` of the detail).
 */
function LessonDetailView({ lesson }: { lesson: LessonResponseDto }): ReactElement {
  const { t } = useTranslation("lessons");
  const changesRef = useRef<HTMLDivElement>(null);
  const [focusChanges, setFocusChanges] = useState(false);
  const isCancelled = lesson.status === LessonStatus.cancelled;

  useEffect(() => {
    if (focusChanges && isCancelled) changesRef.current?.focus();
  }, [focusChanges, isCancelled]);

  return (
    <div className="flex flex-col gap-5">
      <LessonBreadcrumb lesson={lesson} />
      <LessonDetailHeader
        lesson={lesson}
        actions={<LessonDetailActions lesson={lesson} onCancelled={() => setFocusChanges(true)} />}
      />
      <div className={TWO_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-5">
          <LessonDataCard lesson={lesson} />
          <ComingSoonCard title={t("detail.attendance.title")} />
          <ComingSoonCard title={t("detail.record.title")} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <LessonLinksCard lesson={lesson} />
          <LessonChangesCard lesson={lesson} focusRef={changesRef} />
          <ComingSoonCard title={t("detail.coverage.title")} />
        </div>
      </div>
    </div>
  );
}

function LessonDetail({ lessonId }: { lessonId: string }): ReactElement {
  const { t } = useTranslation("lessons");
  const lessonQuery = useGetLesson(lessonId);
  const lesson = lessonQuery.data;

  if (lessonQuery.isPending) return <LessonDetailSkeleton label={t("detail.loading")} />;

  if (lesson === undefined) {
    if (toLessonRequestError(lessonQuery.error) === "lessonNotFound") return <LessonNotFound />;

    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("errors.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={lessonQuery.isFetching}
          onPress={() => void lessonQuery.refetch()}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  return <LessonDetailView lesson={lesson} />;
}

/**
 * The screen of a lesson (RF-037, RF-039, RF-040, RF-042, RF-044, RF-045, RN-20): the trail, the
 * header with the title, the tags and the actions, and the cards. The page asks the API for one
 * thing, `getLesson`, and everything on it comes from that answer: the cards ask for nothing, so a
 * lesson is one request. The title of the page is on the topbar (`handle.title` of the route, "Aula"),
 * so there is no `<h1>`.
 *
 * What the lesson does not have yet keeps its place with "Em breve" and no request: "Chamada" (the
 * attendance, E6), "Registro" and "Cobertura da aula" (the allocation of members, E5). The teacher
 * is a dash in "Dados da aula" until then. The actions are for who manages lessons; the others see
 * the lesson and nothing to change.
 *
 * An id that is not a UUID cannot be a lesson: it is "not found" at once, with no request. The id is
 * also the `key` of the detail, so the state of one lesson (the open dialog, the focus to move) never
 * stays on the next one when the route stays the same and the id changes. The 404 `LESSON_NOT_FOUND`
 * (read with its code, since a 404 that did not come from the API says nothing about this lesson)
 * shows the page of not found, with the way back to the lessons; any other error shows the alert
 * with "Tentar de novo".
 */
export function LessonDetailPage(): ReactElement {
  const { lessonId = "" } = useParams();

  if (!isLessonId(lessonId)) return <LessonNotFound />;

  return <LessonDetail key={lessonId} lessonId={lessonId} />;
}
