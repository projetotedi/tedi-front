import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("hours", { "pt-BR": ptBR, "en-US": enUS });

/*
 * The public API of the module. GUS-165 brings the screens of the coordination and of the board:
 * "Banco de horas" (`/hours`) and "Validação de horas" (`/hours/review`), with their routes and
 * their items in the group Horas of the menu. No component is exported: no other module uses one
 * yet. GUS-163 adds its own pieces here.
 */
export { hoursRoutes } from "./routes";
export { hoursMenuItems } from "./menu";
