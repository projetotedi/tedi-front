import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Dialog, TextField } from "@shared/ui";

import type { LessonPlanMock } from "../mocks/lesson-plans.mock";

export interface MockArchiveLessonPlanDialogProps {
  plan: LessonPlanMock;
  onClose: () => void;
}

/** Read-only archive preview for fixture rows until GUS-127 supplies API-backed plan IDs. */
export function MockArchiveLessonPlanDialog({
  plan,
  onClose,
}: MockArchiveLessonPlanDialogProps): ReactElement {
  const { t } = useTranslation("catalog");

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("archive.title")}
      closeLabel={t("close")}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t("archive.back")}
          </Button>
          <Button variant="secondary" className="text-danger" onPress={onClose}>
            {t("archive.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant="warning" description={t("archive.warningDescription")}>
          {t("archive.warningTitle")}
        </Alert>
        <p className="text-base font-medium text-foreground">{plan.title}</p>
        <TextField
          label={t("archive.reason")}
          value={t("archive.reasonExample")}
          onChange={() => undefined}
          isReadOnly
          description={t("archive.reasonHelp")}
        />
      </div>
    </Dialog>
  );
}
