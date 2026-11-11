import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useDuplicateLessonPlan, useGetLessonPlan } from "@api/generated/catalog/catalog";
import type { LessonPlanDetailDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { Alert, Button, Card, Skeleton, toast } from "@shared/ui";

import { LessonPlanClassesCard } from "../components/LessonPlanClassesCard";
import { LessonPlanDataCard } from "../components/LessonPlanDataCard";
import { LessonPlanDetailHeader } from "../components/LessonPlanDetailHeader";
import { LessonPlanFormDialog } from "../components/LessonPlanFormDialog";
import { LessonPlanSideCards } from "../components/LessonPlanSideCards";
import { LessonPlanUsageCard } from "../components/LessonPlanUsageCard";
import { toRequestErrorKind } from "../lib/api-form-errors";
import { buildLessonPlanEditPath, wantsEdit, withoutEdit } from "../lib/lesson-plan-edit-param";
import { isLessonPlanId } from "../lib/lesson-plan-id";
import { invalidateLessonPlans } from "../lib/lesson-plan-queries";

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

function PlanNotFound(): ReactElement {
  const { t } = useTranslation("catalog");

  return (
    <Card title={t("detail.notFoundTitle")}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-base text-muted">{t("detail.notFoundDescription")}</p>
        <Link
          to="/lesson-plans"
          className="-mx-1 inline-flex min-h-11 items-center rounded-sm px-1 font-medium text-sky-800 underline underline-offset-2 outline-hidden focus-visible:ring-3 focus-visible:ring-focus"
        >
          {t("detail.backToList")}
        </Link>
      </div>
    </Card>
  );
}

/**
 * Detail of a lesson plan (RF-017): data, where it is used and the actions. The title of the page
 * is on the topbar (`handle.title` of the route), so there is no `<h1>` here. Editing opens the same
 * form dialog of the list; when the plan is in use and its duration changes, that dialog asks for
 * the confirmation with the new workload of each course.
 *
 * Duplicar plano creates a copy and goes to its detail with `?edit=1`, which opens the form over it
 * so the person can adjust the title.
 */
export function LessonPlanDetailPage(): ReactElement {
  const { lessonPlanId = "" } = useParams();

  // The route is the same for every plan, so without the key the state of one plan (the open form,
  // the duplication and its warning) would stay on the next: the copy that opens after Duplicar
  // plano, or the original that Voltar goes back to.
  return <LessonPlanDetail key={lessonPlanId} lessonPlanId={lessonPlanId} />;
}

function LessonPlanDetail({ lessonPlanId }: { lessonPlanId: string }): ReactElement {
  const { t } = useTranslation("catalog");
  const [searchParams, setSearchParams] = useSearchParams();
  const isValidId = isLessonPlanId(lessonPlanId);
  const planQuery = useGetLessonPlan(lessonPlanId, { query: { enabled: isValidId } });
  const plan = planQuery.data;
  const isEditRequested = wantsEdit(searchParams);

  // `?edit=1` is read once: it goes off the URL as soon as the query ends, with a plan or with an
  // error. It is a replace, so there is no history entry to come back to, and reloading, going back
  // or forward never reopens the form. `LessonPlanView` reads it in the same render that the plan
  // arrives in, before this effect, and decides whether it can open the form.
  useEffect(() => {
    if (!isEditRequested || planQuery.isPending) return;

    setSearchParams((current) => withoutEdit(current), { replace: true });
  }, [isEditRequested, planQuery.isPending, setSearchParams]);

  // An id that is not a UUID is as missing as one nobody uses: "not found" at once, with no request.
  if (!isValidId) return <PlanNotFound />;

  if (planQuery.isPending) return <LoadingPlaceholder label={t("detail.loading")} />;

  if (plan === undefined) {
    if (toRequestErrorKind(planQuery.error) === "notFound") return <PlanNotFound />;

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

  return <LessonPlanView plan={plan} openEditOnMount={isEditRequested} />;
}

type DuplicateErrorKey = "notFound" | "network" | "unknown";

/**
 * Which text explains a failed duplication. A plan that no longer exists and a connection that
 * failed have their own; everything else, the 403 of a permission revoked meanwhile included, is the
 * generic one. The button is hidden from who cannot manage plans, so a 403 is rare. A 401 never gets
 * here to be read: the session handler takes the person to the login.
 */
function toDuplicateErrorKey(error: unknown): DuplicateErrorKey {
  const kind = toRequestErrorKind(error);
  return kind === "notFound" || kind === "network" ? kind : "unknown";
}

interface LessonPlanViewProps {
  plan: LessonPlanDetailDto;
  /** Only read when the view mounts, which is when the plan arrives: `?edit=1` is a one-time request. */
  openEditOnMount: boolean;
}

function LessonPlanView({ plan, openEditOnMount }: LessonPlanViewProps): ReactElement {
  const { t } = useTranslation("catalog");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canManage = useCan("lessonPlans.manage");
  const editButtonId = useId();
  // The URL opens the form only where the button would: for who can manage plans and for a plan that
  // is not archived (the API refuses to edit it). Anything else just drops the parameter.
  const [isEditing, setIsEditing] = useState(
    () => openEditOnMount && canManage && plan.archivedAt === null,
  );
  // A form opened by the URL has no button that opened it, so when it closes the dialog has nothing
  // to give the focus back to (the Duplicar plano of the original is gone). The page does.
  const focusEditOnCloseRef = useRef(isEditing);

  // The new plan shows up in what lists lesson plans. Nothing of `/courses` is touched: the copy is
  // born in no course. The options of the sequence picker are still a mock (GUS-95), with no cache.
  // This `onSuccess` is the one of the hook, so it runs even if the person has already left the page.
  const duplicatePlan = useDuplicateLessonPlan({
    mutation: { onSuccess: () => void invalidateLessonPlans(queryClient) },
  });

  useEffect(() => {
    if (isEditing || !focusEditOnCloseRef.current) return;
    focusEditOnCloseRef.current = false;

    // A frame later, after the dialog has done its own (empty) focus restoration.
    const frame = requestAnimationFrame(() => document.getElementById(editButtonId)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isEditing, editButtonId]);

  function handleDuplicate() {
    if (duplicatePlan.isPending) return;

    // Toast and navigation go in the callbacks of `mutate`, which do not run once the page is gone: a
    // copy that arrives late never pulls the person away from where they went. The navigation is a
    // push, so Voltar leads back to the original. A failure stays on this page, as a warning under
    // the header that the next try clears (`mutate` resets the error), and the focus stays on the button.
    duplicatePlan.mutate(
      { id: plan.id },
      {
        onSuccess: (copy) => {
          toast.success(t("detail.duplicate.success"));
          navigate(buildLessonPlanEditPath(copy.id));
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <LessonPlanDetailHeader
        plan={plan}
        onEdit={() => setIsEditing(true)}
        onDuplicate={handleDuplicate}
        isDuplicating={duplicatePlan.isPending}
        editButtonId={editButtonId}
      />
      {duplicatePlan.isError ? (
        <Alert variant="error">
          {t(`detail.duplicate.errors.${toDuplicateErrorKey(duplicatePlan.error)}`)}
        </Alert>
      ) : null}
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
