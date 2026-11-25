import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { LessonResponseDto } from "@api/generated/model";
import { formatCalendarDate } from "@shared/lib/format";

import { LINK_CLASSES } from "./link-classes";

export interface LessonBreadcrumbProps {
  lesson: LessonResponseDto;
}

/**
 * The trail of the screen of a lesson: "Aulas › {data} · {título}". "Aulas" is the way back to the
 * lessons, and the lesson itself is the current page, so it is text with `aria-current="page"` and
 * not a link. The `›` is decoration for who sees (`aria-hidden`), and the list tells the others how
 * many steps there are.
 *
 * It lives in the module, and not in `shared/ui`, because it is the only trail of the app: the other
 * detail screens say where they are with the title on the topbar (GUS-136). It does not repeat that
 * title, which is "Aula", for every lesson: it says which lesson this is, by its day and its title.
 */
export function LessonBreadcrumb({ lesson }: LessonBreadcrumbProps): ReactElement {
  const { t, i18n } = useTranslation("lessons");

  return (
    <nav aria-label={t("detail.breadcrumb.label")}>
      <ol className="flex flex-wrap items-center gap-x-1 text-base">
        <li className="flex items-center gap-1">
          <Link to="/lessons" className={LINK_CLASSES}>
            {t("detail.breadcrumb.lessons")}
          </Link>
          <span aria-hidden="true" className="text-muted">
            ›
          </span>
        </li>
        <li className="min-w-0 font-medium break-words">
          <span aria-current="page">
            {t("detail.breadcrumb.current", {
              date: formatCalendarDate(lesson.date, i18n.language),
              title: lesson.title,
            })}
          </span>
        </li>
      </ol>
    </nav>
  );
}
