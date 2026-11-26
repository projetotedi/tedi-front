import type { UseQueryResult } from "@tanstack/react-query";
import { useId, useState, type ReactElement, type ReactNode } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { useTranslation } from "react-i18next";

import { useListStudentAttendance } from "@api/generated/attendance/attendance";
import type { LessonResponseDto } from "@api/generated/model";
import { useMediaQuery } from "@shared/hooks/useMediaQuery";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { useLessonAttendanceAccess } from "../hooks/useLessonAttendanceAccess";
import { useRollCallDraft } from "../hooks/useRollCallDraft";
import { ATTENDANCE_CARD_ID, focusAttendance, MOBILE_QUERY } from "../lib/roll-call";
import { MemberAttendanceTab } from "./MemberAttendanceTab";
import { StudentAttendanceTab } from "./StudentAttendanceTab";

const TAB_CLASS =
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full bg-tedi-neutral px-3.5 text-base font-medium text-tedi-badge-foreground outline-none data-[focus-visible]:ring-3 data-[focus-visible]:ring-tedi-focus-ring data-[selected]:bg-accent data-[selected]:text-accent-foreground md:flex-none";

export interface LessonAttendanceCardProps {
  lesson: LessonResponseDto;
}

/** The card "Chamada" of the screen of a lesson: the students and the members, each in its tab. */
export function LessonAttendanceCard({ lesson }: LessonAttendanceCardProps): ReactElement {
  const { t } = useTranslation("attendance");
  const titleId = useId();
  const [tab, setTab] = useState("students");
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const studentDraft = useRollCallDraft();
  const memberDraft = useRollCallDraft();
  const students = useListStudentAttendance(lesson.id);
  const access = useLessonAttendanceAccess(lesson);
  const { members } = access;

  function renderList<T>(
    query: UseQueryResult<T, unknown>,
    render: (data: T) => ReactNode,
  ): ReactNode {
    if (query.data !== undefined) return render(query.data);
    if (query.isError) {
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("loadError")}</Alert>
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
    return (
      <div role="status">
        <p className="sr-only">{t("loading")}</p>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <section
      id={ATTENDANCE_CARD_ID}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="scroll-mt-4 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-tedi-focus-ring"
    >
      <Card title={<span id={titleId}>{t("title")}</span>}>
        <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
          <TabList aria-label={t("title")} className="flex flex-wrap gap-2 pb-3">
            <Tab id="students" className={TAB_CLASS}>
              {students.data === undefined
                ? t("tabs.students")
                : t("tabs.studentsCount", { total: students.data.length })}
            </Tab>
            <Tab id="members" className={TAB_CLASS}>
              {members.data === undefined
                ? t(isMobile ? "tabs.membersShort" : "tabs.members")
                : t(isMobile ? "tabs.membersShortCount" : "tabs.membersCount", {
                    total: members.data.length,
                  })}
            </Tab>
          </TabList>
          {access.readOnlyReason === null ? null : (
            <p className="pb-3 text-base text-muted">{t(`readOnly.${access.readOnlyReason}`)}</p>
          )}
          <TabPanel id="students" className="outline-none">
            {members.isPending ? (
              <div role="status">
                <p className="sr-only">{t("loading")}</p>
                <Skeleton className="h-40 w-full rounded-2xl" />
              </div>
            ) : (
              renderList(students, (items) => (
                <StudentAttendanceTab
                  lesson={lesson}
                  items={items}
                  draft={studentDraft}
                  canTake={access.canTakeStudents}
                  canCorrect={access.canCorrect}
                  onSigned={focusAttendance}
                />
              ))
            )}
          </TabPanel>
          <TabPanel id="members" className="outline-none">
            {renderList(members, (items) => (
              <MemberAttendanceTab
                lesson={lesson}
                members={items}
                draft={memberDraft}
                canConfirm={access.canConfirm}
                isOwn={access.isOwn}
                canCorrect={access.canCorrect}
                onSigned={focusAttendance}
              />
            ))}
          </TabPanel>
        </Tabs>
      </Card>
    </section>
  );
}
