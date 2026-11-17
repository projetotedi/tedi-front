import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Skeleton } from "@shared/ui";

import { toLessonRequestError } from "../lib/lesson-errors";

/**
 * What the edit and the reschedule dialogs show while the lesson is on its way: rows of skeleton
 * for who sees, and the label for who does not, announced as a status.
 */
export function LessonLoadingPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-4">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-1/2 rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

export interface LessonLoadErrorProps {
  error: unknown;
  isRetrying: boolean;
  onRetry: () => void;
}

/**
 * The lesson could not be loaded. A lesson that does not exist says so and offers no retry (asking
 * again would not make it appear); any other failure says it could not load and offers "Tentar de
 * novo". The dialog stays open on it, so the person can also leave with Cancelar or Voltar.
 */
export function LessonLoadError({
  error,
  isRetrying,
  onRetry,
}: LessonLoadErrorProps): ReactElement {
  const { t } = useTranslation("lessons");
  const isNotFound = toLessonRequestError(error) === "lessonNotFound";

  return (
    <div className="flex flex-col items-start gap-3">
      <Alert variant="error">
        {isNotFound ? t("errors.lessonNotFound") : t("errors.loadError")}
      </Alert>
      {isNotFound ? null : (
        <Button variant="secondary" isLoading={isRetrying} onPress={onRetry}>
          {t("errors.retry")}
        </Button>
      )}
    </div>
  );
}
