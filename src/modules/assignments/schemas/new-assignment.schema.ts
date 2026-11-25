import { z } from "zod";

import { AssignmentRole, AssignmentStatus, type CreateAssignmentDto } from "@api/generated/model";
import { CreateAssignmentBody } from "@api/generated/zod/assignments/assignments";

import type { AssignableStatus } from "../lib/assignment-labels";

/** The message of a field the person has not chosen yet: a key of `fieldErrors`. */
const REQUIRED = "required";

/**
 * What the fields of "Nova alocação de membro" hold. The member, the class and the lesson are ids
 * (`""` until they are chosen), the role starts empty (the person has to choose it) and the status
 * starts as confirmed (F5).
 */
export interface NewAssignmentFormInput {
  personId: string;
  classId: string;
  lessonId: string;
  role: AssignmentRole | "";
  status: AssignableStatus;
}

/**
 * The form is not the DTO (`CreateAssignmentBody`): it has the class and the lesson, which choose
 * the URL of the request and are not in the body, the role starts empty, and the status only takes
 * the two values a new assignment can have (A8: `declined` and `cancelled` come out of a decision
 * about an assignment that exists). So the form has its own schema, which still takes the rule of
 * the member's id and of the status from the generated one, so the front and the API do not drift
 * apart. The messages are keys of `fieldErrors`.
 *
 * What the form does not decide is whether the member can be assigned, whether the lesson accepts
 * it or whether the place is free: the API is the one place that does (409 `MEMBER_INACTIVE`,
 * `LESSON_CANCELLED`, `DUPLICATE_ROLE_IN_LESSON` and `LESSON_TEACHER_TAKEN`), so the rules have one
 * source.
 */
export const newAssignmentFormSchema = z.object({
  personId: z.string().min(1, REQUIRED).pipe(CreateAssignmentBody.shape.personId),
  classId: z.string().min(1, REQUIRED),
  lessonId: z.string().min(1, REQUIRED),
  // `""` is the empty field: it is accepted as input and refused by the enum on the way out.
  role: z.union([z.enum(AssignmentRole), z.literal("")]).pipe(z.enum(AssignmentRole, REQUIRED)),
  status: CreateAssignmentBody.shape.status.extract([
    AssignmentStatus.pending,
    AssignmentStatus.confirmed,
  ]),
});

export type NewAssignmentFormValues = z.output<typeof newAssignmentFormSchema>;

/** What the form can be opened with already decided: the member, the class and the lesson. */
export interface NewAssignmentContext {
  memberId?: string;
  classId?: string;
  lessonId?: string;
}

/**
 * What a new assignment starts with: whatever the screen that opened the form decided, and the rest
 * empty. The role is empty, and the status is confirmed and visible on the screen (F5): the Figma
 * shows it filled, and a default the person cannot see would be a decision made for her.
 */
export function emptyNewAssignmentValues({
  memberId,
  classId,
  lessonId,
}: NewAssignmentContext = {}): NewAssignmentFormInput {
  return {
    personId: memberId ?? "",
    classId: classId ?? "",
    lessonId: lessonId ?? "",
    role: "",
    status: AssignmentStatus.confirmed,
  };
}

/**
 * The body of `POST /lessons/:id/assignments`: the member, the role and the status, and nothing
 * else. The class and the lesson are not in the body (the lesson is in the URL), and there is no
 * note: the Figma has no field for it, and a free text about a person is sensitive (F6, A18).
 */
export function toCreateAssignmentBody(values: NewAssignmentFormValues): CreateAssignmentDto {
  return { personId: values.personId, role: values.role, status: values.status };
}
