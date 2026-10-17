import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { formatHours } from "@shared/lib/format";
import { Button, Dialog, Select, TextField } from "@shared/ui";

import type { LessonPlanMock } from "../mocks/lesson-plans.mock";

export interface LessonPlanFormDialogProps {
  mode: "create" | "edit";
  plan: LessonPlanMock | null;
  onClose: () => void;
}

const DEFAULT_CONTENT = "WhatsApp: mensagens e áudios";
const CONTENT_OPTIONS = [
  DEFAULT_CONTENT,
  "Ligar e desligar com segurança",
  "Teclado e mouse",
  "Navegador e busca",
  "Privacidade e senhas",
  "Câmera e fotos",
];

export function LessonPlanFormDialog({
  mode,
  plan,
  onClose,
}: LessonPlanFormDialogProps): ReactElement {
  const { t } = useTranslation("catalog");
  const title = mode === "create" ? t("form.newTitle") : t("form.editTitle");
  const content = plan?.contents[0] ?? DEFAULT_CONTENT;
  const objective = plan ? t(`mock.objectives.${plan.id}`, { defaultValue: "" }) : "";

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={title}
      closeLabel={t("close")}
      size="wide"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t("form.cancel")}
          </Button>
          <Button onPress={onClose}>
            {mode === "create" ? t("form.savePlan") : t("form.saveChanges")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <TextField
          label={t("form.title")}
          value={plan?.title ?? ""}
          onChange={() => undefined}
          isReadOnly
          isRequired
        />
        <div className="hidden sm:block" aria-hidden="true" />
        <TextField
          label={t("form.duration")}
          value={plan ? formatHours(plan.expectedDurationMinutes) : ""}
          onChange={() => undefined}
          isReadOnly
          isRequired
          description={t("form.durationHelp")}
        />
        <Select
          label={t("form.contents")}
          options={CONTENT_OPTIONS.map((item) => ({ id: item, label: item }))}
          value={content}
          onChange={() => undefined}
          isDisabled
          isRequired
        />
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-base text-foreground">{t("form.objective")}</span>
          <div
            role="textbox"
            aria-label={t("form.objective")}
            aria-readonly="true"
            className="min-h-24 rounded-xl border border-[var(--field-border)] bg-surface px-3 py-2.5 text-base text-foreground shadow-sm"
          >
            {objective || t("form.objectivePlaceholder")}
          </div>
        </div>
        <div className="sm:col-span-2">
          <TextField
            label={t("form.material")}
            value={plan?.materialUrl ?? ""}
            onChange={() => undefined}
            isReadOnly
          />
          <p className="mt-1 text-sm text-muted">{t("form.materialHelp")}</p>
        </div>
      </div>
    </Dialog>
  );
}
