import { registerModuleLocales } from "@shared/i18n";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("classes", { "pt-BR": ptBR, "en-US": enUS });

export { classesRoutes } from "./routes";
export { classesMenuItems } from "./menu";
export { CourseClassesCard } from "./components/CourseClassesCard";
export type { CourseClassesCardProps } from "./components/CourseClassesCard";
