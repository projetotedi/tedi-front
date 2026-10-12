import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Button, Dialog } from "@shared/ui";

import { CreateInviteForm } from "./CreateInviteForm";

export interface CreateInviteDialogProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export function CreateInviteDialog({
  isOpen: controlledOpen,
  onOpenChange,
}: CreateInviteDialogProps): ReactElement {
  const { t } = useTranslation("auth");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOpen = controlledOpen ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (next) setIsSubmitting(false);
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <>
      <Button variant="tertiary" className="rounded-3xl px-4" onPress={() => setOpen(true)}>
        {t("access.createInvite.trigger")}
      </Button>
      <Dialog
        isOpen={isOpen}
        onOpenChange={setOpen}
        title={t("access.createInvite.title")}
        description={t("access.createInvite.description")}
        closeLabel={t("access.createInvite.close")}
        isDismissable={!isSubmitting}
      >
        {isOpen ? (
          <CreateInviteForm onDone={() => setOpen(false)} onPendingChange={setIsSubmitting} />
        ) : null}
      </Dialog>
    </>
  );
}
