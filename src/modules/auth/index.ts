// API pública do módulo auth (equivalente ao `exports` do @Module do back).
// Construído incrementalmente: cada passo da implementação acrescenta o que já existe;
// o contrato final (documentado em docs/ARCHITECTURE.md) fecha com RequireRole,
// SignOutButton, ForbiddenPage e authRoutes.
import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("auth", { "pt-BR": ptBR, "en-US": enUS });

export { AuthProvider } from "./AuthProvider";
export { RequireRole } from "./components/RequireRole";
export { useAuth } from "./hooks/useAuth";
export { ForbiddenPage } from "./pages/ForbiddenPage";
export type { AuthContextValue, AuthStatus } from "./auth-context";
export type { RequireRoleProps } from "./components/RequireRole";
