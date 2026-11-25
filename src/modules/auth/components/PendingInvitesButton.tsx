import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListInvites } from "@api/generated";
import { ListInvitesStatus } from "@api/generated/model";
import { Button } from "@shared/ui";

import { PendingInvitesDialog } from "./PendingInvitesDialog";

export function PendingInvitesButton(): ReactElement | null {
  const { t } = useTranslation("auth");
  const { data } = useListInvites({ status: ListInvitesStatus.pending });
  const [isOpen, setIsOpen] = useState(false);

  if (!data) return null;

  return (
    <>
      <Button variant="tertiary" className="rounded-3xl px-4" onPress={() => setIsOpen(true)}>
        {t("access.people.pendingInvites", { count: data.length })}
      </Button>
      <PendingInvitesDialog isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
