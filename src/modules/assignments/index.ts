import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("assignments", { "pt-BR": ptBR, "en-US": enUS });

/*
 * The public API of the module. It has no routes and no menu item: the allocation has no screen of
 * its own. It gives pieces that the screens of the other modules put in their places, composed by
 * `app/` (the only one that knows both sides). The allocation depends on the contract of the lessons,
 * the classes and the members (the generated hooks and keys), not on their modules, and none of them
 * imports this one:
 *
 * - `NewAssignmentButton` ("+ Nova alocação") and `NewAssignmentDialog` (the form it opens): the
 *   list of members (no context), the sheet of a member (`member`), the screen of a class
 *   (`lessonClass`) and the screen of a lesson (`lesson`);
 * - `LessonCoverageCard` ("Cobertura da aula") and `LessonTeacherName` (the value of the field
 *   Professor(a) of "Dados da aula"), for the screen of the lesson;
 * - `MemberAssignmentsCard` ("Alocações em aulas", with the cancelling), for the sheet of the member.
 */
export { NewAssignmentButton } from "./components/NewAssignmentButton";
export type { NewAssignmentButtonProps } from "./components/NewAssignmentButton";
export { NewAssignmentDialog } from "./components/NewAssignmentDialog";
export type {
  AssignmentClassContext,
  AssignmentLessonContext,
  AssignmentMemberContext,
  NewAssignmentDialogProps,
} from "./components/NewAssignmentDialog";
export { LessonCoverageCard } from "./components/LessonCoverageCard";
export type { LessonCoverageCardProps } from "./components/LessonCoverageCard";
export { LessonTeacherName } from "./components/LessonTeacherName";
export type { LessonTeacherNameProps } from "./components/LessonTeacherName";
export { MemberAssignmentsCard } from "./components/MemberAssignmentsCard";
export type { MemberAssignmentsCardProps } from "./components/MemberAssignmentsCard";
