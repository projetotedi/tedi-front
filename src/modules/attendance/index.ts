import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("attendance", { "pt-BR": ptBR, "en-US": enUS });

export { LessonAttendanceCard } from "./components/LessonAttendanceCard";
export type { LessonAttendanceCardProps } from "./components/LessonAttendanceCard";
export { MemberAttendanceCard } from "./components/MemberAttendanceCard";
export type { MemberAttendanceCardProps } from "./components/MemberAttendanceCard";
export { PendingAttendanceAlert } from "./components/PendingAttendanceAlert";
export type { PendingAttendanceAlertProps } from "./components/PendingAttendanceAlert";
export { RegisterAttendanceButton } from "./components/RegisterAttendanceButton";
export type { RegisterAttendanceButtonProps } from "./components/RegisterAttendanceButton";
