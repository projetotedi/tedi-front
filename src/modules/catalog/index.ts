import { registerModuleLocales } from "@shared/i18n";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("catalog", { "pt-BR": ptBR, "en-US": enUS });

export { catalogRoutes } from "./routes";
export { catalogMenuItems } from "./menu";
