import { registerModuleLocales } from "@shared/i18n";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("lessons", { "pt-BR": ptBR, "en-US": enUS });

export { createLessonsRoutes } from "./routes";
export type { LessonsRouteSlots } from "./routes";
export { lessonsMenuItems } from "./menu";
export { NewLessonButton } from "./components/NewLessonButton";
export type { NewLessonButtonProps } from "./components/NewLessonButton";
export type { LessonClassContext } from "./components/LessonFormDialog";
export { GenerateLessonsButton } from "./components/GenerateLessonsButton";
export type { GenerateLessonsButtonProps } from "./components/GenerateLessonsButton";
export { ClassLessonsCard } from "./components/ClassLessonsCard";
export type { ClassLessonsCardProps } from "./components/ClassLessonsCard";
