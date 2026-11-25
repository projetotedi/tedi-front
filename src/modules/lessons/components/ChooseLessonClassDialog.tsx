import { useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListClasses } from "@api/generated/classes/classes";
import { Alert, Button, Dialog, Select, Skeleton } from "@shared/ui";

import { CLASS_OPTIONS_PARAMS } from "../hooks/useLessonFilterOptions";
import { toLessonClassContext } from "../lib/lesson-class-context";
import type { LessonClassContext } from "./LessonFormDialog";

export interface ChooseLessonClassDialogProps {
  /** The class that comes chosen, when the screen is already filtered by one. */
  initialClassId?: string;
  onContinue: (lessonClass: LessonClassContext) => void;
  onClose: () => void;
}

/** A select has no ref to its field, so the focus goes to the button that opens it. */
function focusSelect(wrapper: HTMLElement | null): void {
  wrapper?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
}

/**
 * The first step of "+ Nova aula" when the screen does not know the class (the list and the
 * calendar of lessons): a select "Turma" with the classes that are not archived, and Continuar,
 * which takes the chosen one to the dialog of the new lesson. It is one required choice from a
 * list, not a form with a schema, so it keeps the choice in the state of the dialog.
 *
 * The classes are the page the filter "Turma" already reads, so there is no second request. While
 * they load the dialog says so; if they fail it says so and offers "Tentar de novo"; with none it
 * says there is no active class. Continuar is off in all three. Continuar with no class chosen shows
 * the error on the field and takes the focus there, and choosing one takes the error away.
 */
export function ChooseLessonClassDialog({
  initialClassId,
  onContinue,
  onClose,
}: ChooseLessonClassDialogProps): ReactElement {
  const { t } = useTranslation("lessons");
  const formId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const query = useListClasses(CLASS_OPTIONS_PARAMS);
  const [choice, setChoice] = useState<string | null>(null);
  const [isRequiredShown, setIsRequiredShown] = useState(false);

  const classes = query.data?.data ?? [];
  const initial = classes.some((item) => item.id === initialClassId) ? initialClassId : undefined;
  const selectedId = choice ?? initial ?? null;
  const isReady = classes.length > 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = classes.find((item) => item.id === selectedId);

    if (selected === undefined) {
      setIsRequiredShown(true);
      focusSelect(fieldRef.current);
      return;
    }
    onContinue(toLessonClassContext(selected));
  }

  function renderBody(): ReactElement {
    if (query.isPending) {
      return (
        <div role="status" className="flex flex-col gap-2">
          <p className="sr-only">{t("chooseClass.loading")}</p>
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      );
    }

    if (query.data === undefined) {
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("chooseClass.error")}</Alert>
          <Button
            variant="secondary"
            isLoading={query.isFetching}
            onPress={() => void query.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      );
    }

    if (!isReady) return <p className="text-base text-muted">{t("chooseClass.empty")}</p>;

    return (
      <form id={formId} noValidate onSubmit={onSubmit}>
        <div ref={fieldRef}>
          <Select
            label={t("chooseClass.class")}
            placeholder={t("chooseClass.placeholder")}
            options={classes.map((item) => ({ id: item.id, label: item.name || item.code }))}
            value={selectedId}
            onChange={(id) => {
              setChoice(id);
              setIsRequiredShown(false);
            }}
            isRequired
            errorMessage={isRequiredShown ? t("chooseClass.required") : undefined}
          />
        </div>
      </form>
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("chooseClass.title")}
      closeLabel={t("close")}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t("chooseClass.cancel")}
          </Button>
          <Button variant="primary" type="submit" form={formId} isDisabled={!isReady}>
            {t("chooseClass.continue")}
          </Button>
        </>
      }
    >
      {renderBody()}
    </Dialog>
  );
}
