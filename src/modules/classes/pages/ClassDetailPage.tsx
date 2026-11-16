import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Card } from "@shared/ui";

import { useCourseOptions } from "../hooks/useCourseOptions";
import { findCourse } from "../lib/course-options";
import { initialClasses } from "../mocks/classes.mock";

export function ClassDetailPage() {
  const { t } = useTranslation("classes");
  const { classId } = useParams();
  const { courses } = useCourseOptions();
  const item = initialClasses.find((record) => record.id === classId);
  const course = item ? findCourse(courses, item.courseId) : undefined;

  return (
    <Card title={item?.name ?? t("detailNotFound")}>
      <Link to="/classes" className="text-tedi-sky underline">
        {t("backToList")}
      </Link>
      {item ? (
        <dl className="mt-4 grid gap-3 text-base">
          <div>
            <dt className="font-semibold">{t("code")}</dt>
            <dd>{item.code}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t("course")}</dt>
            <dd>{course?.name}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t("period")}</dt>
            <dd>
              {item.start} – {item.end}
            </dd>
          </div>
        </dl>
      ) : null}
    </Card>
  );
}
