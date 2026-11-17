import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("hours", { "pt-BR": ptBR, "en-US": enUS });

/*
 * The public API of the hours module (the hours bank of the back, E7). The labels of the categories
 * and of the statuses, the tag of the status and the format of the hours are owned here (GUS-163), for
 * every screen of hours to share.
 */
