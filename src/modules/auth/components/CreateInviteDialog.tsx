import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Button, Dialog } from "@shared/ui";

import { CreateInviteForm } from "./CreateInviteForm";

export function CreateInviteDialog(): ReactElement {
  const { t } = useTranslation("auth");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <Button
        variant="tertiary"
        className="rounded-3xl px-4"
        onPress={() => {
          setIsSubmitting(false);
          setIsOpen(true);
        }}
      >
        {t("access.createInvite.trigger")}
      </Button>
      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t("access.createInvite.title")}
        description={t("access.createInvite.description")}
        closeLabel={t("access.createInvite.close")}
        isDismissable={!isSubmitting}
      >
        {isOpen ? (
          <CreateInviteForm onDone={() => setIsOpen(false)} onPendingChange={setIsSubmitting} />
        ) : null}
      </Dialog>
    </>
  );
}
