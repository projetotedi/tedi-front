// API pública do módulo auth (equivalente ao `exports` do @Module do back).
// Contrato documentado em docs/ARCHITECTURE.md — não mudar a assinatura sem avaliar
// impacto na Equipe B (GUS-84/85/86/87 consomem isto diretamente).
import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("auth", { "pt-BR": ptBR, "en-US": enUS });

export { AuthProvider } from "./AuthProvider";
export { RequireRole } from "./components/RequireRole";
export { SignOutButton } from "./components/SignOutButton";
export { useAuth } from "./hooks/useAuth";
export { authMenuItems } from "./menu";
export { ForbiddenPage } from "./pages/ForbiddenPage";
export { authProtectedRoutes, authRoutes } from "./routes";
export type { AuthContextValue, AuthStatus } from "./auth-context";
export type { RequireRoleProps } from "./components/RequireRole";
export type { SignOutButtonProps } from "./components/SignOutButton";
