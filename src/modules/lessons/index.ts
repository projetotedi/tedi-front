import { registerModuleLocales } from "@shared/i18n";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("lessons", { "pt-BR": ptBR, "en-US": enUS });

export { lessonsRoutes } from "./routes";
export { lessonsMenuItems } from "./menu";
