// API pública do módulo people (espelha o módulo people do back).
import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("people", { "pt-BR": ptBR, "en-US": enUS });

export { peopleRoutes } from "./routes";
