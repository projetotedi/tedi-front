import { z } from "zod";

import {
  CourseCategory,
  type CourseDetailDto,
  type CreateCourseDto,
  type UpdateCourseDto,
} from "@api/generated/model";
import {
  createCourseBodyDescriptionMax,
  createCourseBodyNameMax,
  createCourseBodyObjectiveMax,
  createCourseBodyPrerequisiteIdsMax,
} from "@api/generated/zod/catalog/catalog";

export const COURSE_LIMITS = {
  nameMax: createCourseBodyNameMax,
  descriptionMax: createCourseBodyDescriptionMax,
  objectiveMax: createCourseBodyObjectiveMax,
  prerequisitesMax: createCourseBodyPrerequisiteIdsMax,
} as const;

/**
 * The form of Novo curso and Editar curso (GUS-129). The category starts empty in Novo curso, so
 * the person has to choose one; the messages are keys of `course.form.errors`.
 */
export const courseFormSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(COURSE_LIMITS.nameMax, "nameTooLong"),
  category: z.union([z.enum(CourseCategory), z.literal("")]).refine((value) => value !== "", {
    message: "categoryRequired",
  }),
  prerequisiteIds: z.array(z.string()).max(COURSE_LIMITS.prerequisitesMax, "prerequisitesTooMany"),
  description: z
    .string()
    .trim()
    .min(1, "descriptionRequired")
    .max(COURSE_LIMITS.descriptionMax, "descriptionTooLong"),
  objective: z.string().trim().max(COURSE_LIMITS.objectiveMax, "objectiveTooLong"),
});

export type CourseFormValues = z.input<typeof courseFormSchema>;

export function emptyCourseFormValues(): CourseFormValues {
  return { name: "", category: "", prerequisiteIds: [], description: "", objective: "" };
}

/** The form filled with the course of the page, for Editar curso. */
export function toCourseFormValues(course: CourseDetailDto): CourseFormValues {
  return {
    name: course.name,
    category: course.category,
    prerequisiteIds: course.prerequisites.map((prerequisite) => prerequisite.id),
    description: course.description,
    objective: course.objective ?? "",
  };
}

/** The body of `createCourse`: a blank objective is not sent, and no prerequisite is `[]`. */
export function toCreateCourseBody(values: CourseFormValues): CreateCourseDto {
  const objective = values.objective.trim();

  return {
    name: values.name.trim(),
    category: values.category as CourseCategory,
    description: values.description.trim(),
    ...(objective ? { objective } : {}),
    prerequisiteIds: values.prerequisiteIds,
  };
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((id) => set.has(id));
}

/**
 * The body of `updateCourse` with only what changed (the API keeps what is omitted): a cleared
 * objective is `null`, and the prerequisites go whole when the set changed, in any order.
 */
export function toUpdateCourseBody(
  values: CourseFormValues,
  initial: CourseFormValues,
): UpdateCourseDto {
  const body: UpdateCourseDto = {};
  const name = values.name.trim();
  const description = values.description.trim();
  const objective = values.objective.trim();

  if (name !== initial.name.trim()) body.name = name;
  if (values.category !== initial.category) body.category = values.category as CourseCategory;
  if (description !== initial.description.trim()) body.description = description;
  if (objective !== initial.objective.trim()) body.objective = objective || null;
  if (!sameIds(values.prerequisiteIds, initial.prerequisiteIds)) {
    body.prerequisiteIds = values.prerequisiteIds;
  }
  return body;
}
