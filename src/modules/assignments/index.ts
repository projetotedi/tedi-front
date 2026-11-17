import { registerModuleLocales } from "@shared/i18n";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("assignments", { "pt-BR": ptBR, "en-US": enUS });

export { assignmentsRoutes } from "./routes";
export { assignmentsMenuItems } from "./menu";
export { PendingApplicationsButton } from "./components/PendingApplicationsButton";
export { PendingApplicationsDialog } from "./components/PendingApplicationsDialog";
export type { PendingApplicationsDialogProps } from "./components/PendingApplicationsDialog";
