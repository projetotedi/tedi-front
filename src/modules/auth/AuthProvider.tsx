import { type ReactNode, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { getMeQueryKey, useLogout, useMe } from "@api/generated";
import { UNAUTHORIZED_EVENT } from "@shared/lib/session-events";

import { AuthContext, type AuthContextValue, type AuthStatus } from "./auth-context";
import { buildLoginPath, LOGIN_PATH } from "./lib/return-to";

interface AuthProviderProps {
  children?: ReactNode;
}

function noop() {
  // POST /auth/logout é @Public() no back e não devolve 401; qualquer falha de rede
  // não deve impedir a limpeza da sessão local.
}

/**
 * Carrega a sessão via GET /auth/me e a expõe a `useAuth()`.
 * Sem `children`, renderiza <Outlet /> — serve como rota-layout raiz em app/router.tsx.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const query = useMe({
    query: {
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnWindowFocus: false,
    },
  });
  const logout = useLogout();

  // Qualquer erro (401 inclusive) é anonimato, nunca tela de erro.
  const status: AuthStatus = query.isPending
    ? "loading"
    : query.isSuccess
      ? "authenticated"
      : "anonymous";
  const user = query.isSuccess ? query.data : null;

  // Refs para o listener de UNAUTHORIZED_EVENT ler o estado mais recente sem precisar
  // recriá-lo (e reassinar o listener) a cada render. Atualizadas em efeito (não durante
  // o render) para não mutar um ref enquanto React ainda está renderizando.
  const statusRef = useRef(status);
  const locationRef = useRef(location);
  const signingOutRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  });

  useEffect(() => {
    locationRef.current = location;
  });

  useEffect(() => {
    function handleUnauthorized() {
      // Ignora o 401 inicial do /auth/me (é anonimato, não expiração) e o 401 que o
      // próprio POST /auth/logout eventualmente dispararia durante o signOut().
      if (signingOutRef.current) return;
      if (statusRef.current !== "authenticated") return;

      queryClient.removeQueries({ queryKey: getMeQueryKey() });
      navigate(buildLoginPath(locationRef.current, "expired"), { replace: true });
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [queryClient, navigate]);

  async function signOut(): Promise<void> {
    signingOutRef.current = true;
    try {
      await logout.mutateAsync().catch(noop);
      queryClient.removeQueries({ queryKey: getMeQueryKey() });
      navigate(LOGIN_PATH, { replace: true });
    } finally {
      signingOutRef.current = false;
    }
  }

  const value: AuthContextValue = { status, user, signOut };

  return <AuthContext.Provider value={value}>{children ?? <Outlet />}</AuthContext.Provider>;
}
