import { useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useCan } from "@modules/auth";
import { ListState } from "@shared/components/ListState";
import { Button, Card } from "@shared/ui";

import bookmarkIcon from "../../../assets/icons/bookmark.svg";
import { LessonPlanFormDialog } from "../components/LessonPlanFormDialog";

export function LessonPlansPage(): ReactElement {
  const { t } = useTranslation("catalog");
  const titleId = useId();
  const canManage = useCan("lessonPlans.manage");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <section aria-labelledby={titleId}>
      <Card
        title={<span id={titleId}>{t("title")}</span>}
        aside={
          canManage ? (
            <Button onPress={() => setIsCreateOpen(true)}>{t("newPlan")}</Button>
          ) : undefined
        }
      >
        <ListState
          variant="empty"
          title={t("listPending.title")}
          description={t("listPending.description")}
          icon={bookmarkIcon}
        />
      </Card>
      {isCreateOpen ? (
        <LessonPlanFormDialog mode="create" onClose={() => setIsCreateOpen(false)} />
      ) : null}
    </section>
  );
}
