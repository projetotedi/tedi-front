import { registerModuleLocales } from "@shared/i18n";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("classes", { "pt-BR": ptBR, "en-US": enUS });

export { createClassesRoutes } from "./routes";
export type { ClassesRouteSlots } from "./routes";
export { classesMenuItems } from "./menu";
export { CourseClassesCard } from "./components/CourseClassesCard";
export type { CourseClassesCardProps } from "./components/CourseClassesCard";
export type { ClassHeaderActions } from "./pages/ClassDetailPage";
export { NewClassButton } from "./components/NewClassButton";
export type { NewClassButtonProps } from "./components/NewClassButton";
