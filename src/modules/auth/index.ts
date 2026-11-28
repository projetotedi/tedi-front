// API pública do módulo auth (equivalente ao `exports` do @Module do back).
// Contrato documentado em docs/ARCHITECTURE.md — não mudar a assinatura sem avaliar
// impacto na Equipe B (GUS-84/85/86/87 consomem isto diretamente).
import { registerModuleLocales } from "@shared/i18n";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

registerModuleLocales("auth", { "pt-BR": ptBR, "en-US": enUS });

export { AuthProvider } from "./AuthProvider";
export { ActionError } from "./components/ActionError";
export { MemberAccessCard } from "./components/MemberAccessCard";
export { RequirePermission } from "./components/RequirePermission";
export { RequireRole } from "./components/RequireRole";
export { SignOutButton } from "./components/SignOutButton";
export { ValidateRegistrationDialog } from "./components/ValidateRegistrationDialog";
export { useAuth } from "./hooks/useAuth";
export { useCan } from "./hooks/useCan";
export { usePermissionCheck } from "./hooks/usePermissionCheck";
export { toAccessActionErrorKey } from "./lib/access-action-error";
export { invalidateAccessList } from "./lib/access-queries";
export { isValidCpf } from "./lib/cpf";
export { formatCpf } from "./lib/input-masks";
export { isCalendarDate } from "./lib/registration-format";
export { roleBadgeTone, toAssignableRole } from "./lib/role-label";
export { authMenuItems } from "./menu";
export { ForbiddenPage } from "./pages/ForbiddenPage";
export { authRoutes, createAuthProtectedRoutes } from "./routes";
export type { AuthContextValue, AuthStatus } from "./auth-context";
export type { ActionErrorProps } from "./components/ActionError";
export type { MemberAccessCardProps } from "./components/MemberAccessCard";
export type { RequirePermissionProps } from "./components/RequirePermission";
export type { RequireRoleProps } from "./components/RequireRole";
export type { SignOutButtonProps } from "./components/SignOutButton";
export type { ValidateRegistrationDialogProps } from "./components/ValidateRegistrationDialog";
export type { MemberAccessTarget } from "./lib/access-format";
export type { AssignableRole } from "./lib/role-label";
export type { AuthRouteSlots } from "./routes";
