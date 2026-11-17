import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { CourseStatus, type ClassCourseResponseDto } from "@api/generated/model";
import { Select } from "@shared/ui";

import { selectableCourses } from "../lib/course-options";

export interface CourseSelectProps {
  label: ReactNode;
  /** Every course: the select leaves out the archived ones itself (`selectableCourses`). */
  courses: readonly ClassCourseResponseDto[];
  /** The id of the chosen course, or an empty value while there is none. */
  value: string | null;
  onChange: (courseId: string) => void;
  onBlur?: () => void;
  name?: string;
  /** The course the class already has, when it is being edited: it stays on the list even if archived. */
  currentCourseId?: string;
  isDisabled?: boolean;
  /** Why the field is off. It is tied to the field and gives way to the error message, if there is one. */
  description?: string;
  errorMessage?: string;
  isRequired?: boolean;
  autoFocus?: boolean;
}

/**
 * The course of a class. It offers only the active courses (RF-020, RN-27: an archived course takes
 * no new class), by name, and the course the class already has when it is being edited, marked
 * "(arquivado)" if it was archived since: the class keeps it, and the select has to show what is
 * chosen. No other archived course is offered.
 */
export function CourseSelect({
  label,
  courses,
  value,
  onChange,
  onBlur,
  name,
  currentCourseId,
  isDisabled,
  description,
  errorMessage,
  isRequired,
  autoFocus,
}: CourseSelectProps): ReactElement {
  const { t } = useTranslation("classes");

  const options = selectableCourses(courses, currentCourseId).map((course) => ({
    id: course.id,
    label:
      course.status === CourseStatus.archived
        ? t("form.archivedCourseOption", { name: course.name })
        : course.name,
  }));

  return (
    <Select
      label={label}
      options={options}
      value={value || null}
      onChange={onChange}
      onBlur={onBlur}
      name={name}
      placeholder={t("form.coursePlaceholder")}
      description={description}
      errorMessage={errorMessage}
      isDisabled={isDisabled}
      isRequired={isRequired}
      autoFocus={autoFocus}
    />
  );
}
