import { useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { OpenLessonResponseDto } from "@api/generated/model";

import { ApplyToLessonDialog } from "../components/ApplyToLessonDialog";
import { MyLessonsSummary } from "../components/MyLessonsSummary";
import { MyUpcomingLessonsCard } from "../components/MyUpcomingLessonsCard";
import { OpenLessonsCard } from "../components/OpenLessonsCard";
import { PendingApplicationsButton } from "../components/PendingApplicationsButton";

/**
 * "Minhas aulas" (`/my-lessons`, F5.5): the agenda of the member, for every profile that has
 * `assignments.manageOwn`. The numbers on top, "Minhas próximas aulas" and "Aulas com vaga para
 * candidatura", whose Candidatar-se button opens the dialog of the application. The title is the one
 * of the topbar (the `handle` of the route): the page has no `<h1>` of its own.
 *
 * "Candidaturas pendentes (N)" is provisionally here, on the top right, only for who has
 * `assignments.review`: the screens that will hold it (the list of lessons and the detail of a
 * lesson) are other tasks, and until they exist this is where the queue can be reached. A member
 * does not see it.
 *
 * Focus. Closing the dialog with Voltar or Esc gives the focus back to the button that opened it. When
 * an application was sent that button leaves the screen (the lesson no longer has a place to ask
 * for), so the focus goes to the card of the lessons with a vacancy, once the dialog is gone.
 */
export function MyLessonsPage(): ReactElement {
  const { t } = useTranslation("assignments");
  const openLessonsRef = useRef<HTMLDivElement>(null);
  const hasAppliedRef = useRef(false);
  const [applying, setApplying] = useState<OpenLessonResponseDto | null>(null);

  // After the dialog is unmounted: while it is open, the focus cannot leave it, and the restore of
  // the focus it does on closing only acts when the focus was lost, not when it was moved on purpose.
  useEffect(() => {
    if (applying !== null || !hasAppliedRef.current) return;
    hasAppliedRef.current = false;
    openLessonsRef.current?.focus();
  }, [applying]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end empty:hidden">
        <PendingApplicationsButton />
      </div>
      <MyLessonsSummary />
      <MyUpcomingLessonsCard />
      <div
        ref={openLessonsRef}
        role="region"
        aria-label={t("myLessons.open.titleWithoutCount")}
        tabIndex={-1}
        className="outline-none"
      >
        <OpenLessonsCard onApply={setApplying} />
      </div>
      {applying === null ? null : (
        <ApplyToLessonDialog
          openLesson={applying}
          onApplied={() => {
            hasAppliedRef.current = true;
          }}
          onClose={() => setApplying(null)}
        />
      )}
    </div>
  );
}
