import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Card } from "@shared/ui";

import { ClassDataCard } from "../components/ClassDataCard";
import { ClassDetailHeader } from "../components/ClassDetailHeader";
import { CourseOriginCard } from "../components/CourseOriginCard";
import { LINK_CLASSES } from "../components/link-classes";
import { useCourseOptions } from "../hooks/useCourseOptions";
import { findCourse } from "../lib/course-options";
import { initialClasses } from "../mocks/classes.mock";

const TWO_COLUMNS = "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_27.5rem]";

function BackToList(): ReactElement {
  const { t } = useTranslation("classes");

  return (
    <Link to="/classes" className={LINK_CLASSES}>
      {t("backToList")}
    </Link>
  );
}

function ClassNotFound(): ReactElement {
  const { t } = useTranslation("classes");

  return (
    <Card title={t("detailNotFound")}>
      <BackToList />
    </Card>
  );
}

/**
 * Detail of a class: the header with its tags, the data of the class and the course it comes from
 * (RN-13). The level is the one of the course (RN-14, RF-029): it is read from the course on every
 * render, in the tag of the header, in "Dados da turma" and in "Curso de origem", and never from
 * the class, so it changes when the category of the course does.
 *
 * TEMPORARY. The API has no `getClass` yet (GUS-104), so the class and its course come from the
 * prototype data; the components already take the shapes of the contract (`ClassCourseResponseDto`,
 * `ClassStatus`), and `CourseOriginCard` is the real thing, with its own queries, which wait for a
 * course with a real (UUID) id. Without `getClass` there is no `enrolledCount` either, so the seats
 * are the ones of the mock. The title of the page is on the topbar (`handle.title` of the route).
 */
export function ClassDetailPage(): ReactElement {
  const { classId } = useParams();
  const { courses } = useCourseOptions();
  const classRecord = initialClasses.find((record) => record.id === classId);
  const course = classRecord ? findCourse(courses, classRecord.courseId) : undefined;

  if (classRecord === undefined || course === undefined) return <ClassNotFound />;

  return (
    <div className="flex flex-col gap-5">
      <BackToList />
      <ClassDetailHeader
        title={classRecord.name}
        status={classRecord.status}
        isArchived={classRecord.archived}
        course={course}
      />
      <div className={TWO_COLUMNS}>
        <ClassDataCard classRecord={classRecord} course={course} />
        <CourseOriginCard isClassArchived={classRecord.archived} course={course} />
      </div>
    </div>
  );
}
