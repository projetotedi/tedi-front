import { createContext } from "react";

import type { MeResponseDto } from "@api/generated/model";

/** "loading" até o primeiro GET /auth/me responder. */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  /** "loading" até o primeiro GET /auth/me responder. */
  status: AuthStatus;
  /** null sempre que status !== "authenticated". */
  user: MeResponseDto | null;
  /** POST /auth/logout, limpa a sessão e volta para /login. */
  signOut: () => Promise<void>;
}

// Contexto separado do AuthProvider.tsx para não misturar componente e valor exportado
// (react-refresh/only-export-components).
export const AuthContext = createContext<AuthContextValue | null>(null);
