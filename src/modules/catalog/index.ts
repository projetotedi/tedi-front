import { registerModuleLocales } from "@shared/i18n";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("catalog", { "pt-BR": ptBR, "en-US": enUS });

export { createCatalogRoutes } from "./routes";
export type { CatalogRouteSlots } from "./routes";
export { catalogMenuItems } from "./menu";
