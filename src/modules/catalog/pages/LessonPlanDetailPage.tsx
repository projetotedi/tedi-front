import { useState, type ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useGetLessonPlan } from "@api/generated/catalog/catalog";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { LessonPlanClassesCard } from "../components/LessonPlanClassesCard";
import { LessonPlanDataCard } from "../components/LessonPlanDataCard";
import { LessonPlanDetailHeader } from "../components/LessonPlanDetailHeader";
import { LessonPlanFormDialog } from "../components/LessonPlanFormDialog";
import { LessonPlanSideCards } from "../components/LessonPlanSideCards";
import { LessonPlanUsageCard } from "../components/LessonPlanUsageCard";
import { toRequestErrorKind } from "../lib/api-form-errors";

const TWO_COLUMNS = "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_27.5rem]";

function LoadingPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-5">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className={TWO_COLUMNS}>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Detail of a lesson plan (RF-017): data, where it is used and the edit action. The title of the
 * page is on the topbar (`handle.title` of the route), so there is no `<h1>` here. Editing opens
 * the same form dialog of the list; when the plan is in use and its duration changes, that dialog
 * asks for the confirmation with the new workload of each course.
 */
export function LessonPlanDetailPage(): ReactElement {
  const { t } = useTranslation("catalog");
  const { lessonPlanId = "" } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const planQuery = useGetLessonPlan(lessonPlanId);
  const plan = planQuery.data;

  if (planQuery.isPending) return <LoadingPlaceholder label={t("detail.loading")} />;

  if (plan === undefined) {
    if (toRequestErrorKind(planQuery.error) === "notFound") {
      return (
        <Card title={t("detail.notFoundTitle")}>
          <div className="flex flex-col items-start gap-3">
            <p className="text-base text-muted">{t("detail.notFoundDescription")}</p>
            <Link
              to="/lesson-plans"
              className="inline-flex min-h-11 items-center rounded-sm font-medium text-sky-800 underline underline-offset-2 outline-hidden focus-visible:ring-3 focus-visible:ring-focus"
            >
              {t("detail.backToList")}
            </Link>
          </div>
        </Card>
      );
    }

    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("detail.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={planQuery.isFetching}
          onPress={() => void planQuery.refetch()}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <LessonPlanDetailHeader plan={plan} onEdit={() => setIsEditing(true)} />
      <div className={TWO_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-5">
          <LessonPlanDataCard plan={plan} />
          <LessonPlanUsageCard usedIn={plan.usedIn} />
          <LessonPlanClassesCard />
        </div>
        <LessonPlanSideCards plan={plan} />
      </div>

      {isEditing ? (
        <LessonPlanFormDialog
          mode="edit"
          lessonPlanId={plan.id}
          onClose={() => setIsEditing(false)}
        />
      ) : null}
    </div>
  );
}
