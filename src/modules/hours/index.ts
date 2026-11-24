import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("hours", { "pt-BR": ptBR, "en-US": enUS });

/*
 * The public API of the hours module (the hours bank of the back, E7).
 *
 * GUS-165 brings the screens of the coordination and of the board: "Banco de horas" (`/hours`) and
 * "Validação de horas" (`/hours/review`), with their routes and their items in the group Horas of
 * the menu.
 *
 * GUS-163 brings the hours of the person. An entry belongs to the person (`hours → people` in the
 * back), so the screens of the other modules never import this one: they declare a slot and `app/`
 * fills it with these pieces.
 *
 * - `LogHoursButton` ("+ Lançar horas") and `LogHoursDialog` (the form it opens), for "Meu perfil";
 * - `LogHoursForMemberButton` ("+ Lançar horas" with `member`, only with `hours.logForOthers`), for
 *   the sheet of a member (GUS-145): it opens `LogHoursDialog` on behalf of that member, which
 *   without the permission draws nothing;
 * - `MyHoursSummary` (the four numbers), `MyEntriesCard` ("Meus lançamentos", whose "Ver extrato
 *   completo ›" opens the statement, where a pending entry is removed) and `MyCategoryHoursCard`
 *   ("Horas por categoria"), the hours of "Meu perfil", each with its own read of `/me/*`.
 *
 * The labels of the categories and of the statuses, the tag of the status and the reading of hours
 * typed as "2h30" are owned here (GUS-163), for every screen of hours to share.
 */
export { hoursRoutes } from "./routes";
export { hoursMenuItems } from "./menu";
export { LogHoursButton } from "./components/LogHoursButton";
export { LogHoursDialog } from "./components/LogHoursDialog";
export type { LogHoursDialogProps, LogHoursMember } from "./components/LogHoursDialog";
export { LogHoursForMemberButton } from "./components/LogHoursForMemberButton";
export type { LogHoursForMemberButtonProps } from "./components/LogHoursForMemberButton";
export { MyHoursSummary } from "./components/MyHoursSummary";
export { MyEntriesCard } from "./components/MyEntriesCard";
export { MyCategoryHoursCard } from "./components/MyCategoryHoursCard";
