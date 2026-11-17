import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListPendingApplications } from "@api/generated/assignments/assignments";
import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import { PENDING_APPLICATIONS_PARAMS } from "../lib/assignment-queries";
import { PendingApplicationsDialog } from "./PendingApplicationsDialog";

/**
 * "Candidaturas pendentes (N)": the button that opens the queue of applications. It is drawn only
 * for who reviews them (`assignments.review`: the director and the coordination), and for nobody
 * else, not even disabled, and then nothing is asked of the API. N is the `total` of
 * `GET /applications?status=pending`, the very answer the dialog lists, so the two never differ; the
 * number is left out while it loads and when the read fails (the dialog opens on the error and
 * offers to try again). With no application the button stays, with 0: a disabled button takes no
 * focus, and there the person learns that the queue is empty. When the dialog closes, the focus goes
 * back to the button (the dialog is mounted only while it is open, and the focus returns to what
 * had it when it opened).
 *
 * The screens that list lessons (the list, the detail of a lesson) mount it by a slot of `app/`,
 * since `lessons` does not import this module; until they do, "Minhas aulas" is where it is.
 */
export function PendingApplicationsButton(): ReactElement | null {
  const { t } = useTranslation("assignments");
  const canReview = useCan("assignments.review");
  const query = useListPendingApplications(PENDING_APPLICATIONS_PARAMS, {
    query: { enabled: canReview },
  });
  const [isOpen, setIsOpen] = useState(false);

  if (!canReview) return null;

  const label =
    query.data === undefined
      ? t("pendingApplications.buttonLoading")
      : t("pendingApplications.button", { count: query.data.total });

  return (
    <>
      <Button variant="secondary" onPress={() => setIsOpen(true)}>
        {label}
      </Button>
      {isOpen ? <PendingApplicationsDialog onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
