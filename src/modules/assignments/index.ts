import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("assignments", { "pt-BR": ptBR, "en-US": enUS });

/*
 * The public API of the module. Its one screen is "Minhas aulas" (`/my-lessons`, GUS-161), with its
 * route and its item in the group Aulas of the menu. The rest are pieces that the screens of the
 * other modules put in their places, composed by `app/` (the only one that knows both sides). The allocation depends on the contract of the lessons,
 * the classes and the members (the generated hooks and keys), not on their modules, and none of them
 * imports this one:
 *
 * - `NewAssignmentButton` ("+ Nova alocação") and `NewAssignmentDialog` (the form it opens): the
 *   list of members (no context), the sheet of a member (`member`), the screen of a class
 *   (`lessonClass`) and the screen of a lesson (`lesson`);
 * - `LessonCoverageCard` ("Cobertura da aula") and `LessonTeacherName` (the value of the field
 *   Professor(a) of "Dados da aula"), for the screen of the lesson;
 * - `MemberAssignmentsCard` ("Alocações em aulas", with the cancelling), for the sheet of the member;
 * - `PendingApplicationsButton` ("Candidaturas pendentes (N)") and `PendingApplicationsDialog` (the
 *   queue it opens, to confirm or decline), for the list of lessons (GUS-155) and the screen of a
 *   lesson (GUS-156). Until those exist the button sits on top of "Minhas aulas" (F1 of GUS-161).
 */
export { assignmentsRoutes } from "./routes";
export { assignmentsMenuItems } from "./menu";
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
export { PendingApplicationsButton } from "./components/PendingApplicationsButton";
export { PendingApplicationsDialog } from "./components/PendingApplicationsDialog";
export type { PendingApplicationsDialogProps } from "./components/PendingApplicationsDialog";
