import type { ClassListItemDto } from "@api/generated/model";

import type { LessonClassContext } from "../components/LessonFormDialog";

/**
 * What the dialog of a new lesson needs to know of the class the lesson is for, taken from an item
 * of `listClasses`: the label of the read-only field (the name, or the code when the class has none),
 * the course whose sequence of plans is offered, and the period the date of the lesson has to be in.
 */
export function toLessonClassContext(item: ClassListItemDto): LessonClassContext {
  return {
    id: item.id,
    label: item.name || item.code,
    courseId: item.course.id,
    startDate: item.startDate,
    endDate: item.endDate,
  };
}
