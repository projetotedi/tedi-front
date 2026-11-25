import { useListCourses, useListLessonPlans } from "@api/generated/catalog/catalog";
import { useListClasses } from "@api/generated/classes/classes";
import {
  ClassListSort,
  CourseListSort,
  LessonPlanListSort,
  type ClassListItemDto,
  type CourseListItemDto,
  type LessonPlanListItemDto,
  type ListClassesParams,
} from "@api/generated/model";

/** The most items the API gives in one page: the options of a filter are one page, as they are in the other lists. */
const OPTIONS_LIMIT = 100;

/**
 * The page of classes that the filter "Turma" of the lists and the choice of the class of
 * "+ Nova aula" both read, so they are one request and not two. The classes that are not archived
 * (the API leaves the archived ones out unless asked), the last one to start first.
 */
export const CLASS_OPTIONS_PARAMS: ListClassesParams = {
  limit: OPTIONS_LIMIT,
  sort: ClassListSort.startDate,
};

export interface LessonFilterOptions {
  classes: ClassListItemDto[];
  courses: CourseListItemDto[];
  lessonPlans: LessonPlanListItemDto[];
}

/**
 * What the filters of the list and of the calendar of lessons offer to choose from: the classes, the
 * courses (only the calendar has that filter, so the list does not ask for them) and the lesson
 * plans, each one a page of the generated `listClasses`, `listCourses` and `listLessonPlans`. They
 * come from the contract, not from the `classes` and `catalog` modules, which this one does not
 * import. While a page is on its way, or if it fails, the filter offers only "Todas": the lessons are
 * still there to look at.
 */
export function useLessonFilterOptions({ courses }: { courses: boolean }): LessonFilterOptions {
  const classesQuery = useListClasses(CLASS_OPTIONS_PARAMS);
  const coursesQuery = useListCourses(
    { limit: OPTIONS_LIMIT, sort: CourseListSort.name },
    { query: { enabled: courses } },
  );
  const lessonPlansQuery = useListLessonPlans({
    limit: OPTIONS_LIMIT,
    sort: LessonPlanListSort.title,
  });

  return {
    classes: classesQuery.data?.data ?? [],
    courses: coursesQuery.data?.data ?? [],
    lessonPlans: lessonPlansQuery.data?.data ?? [],
  };
}
