import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { afterAll, afterEach, beforeAll } from "vitest";

import i18n from "@shared/i18n";
import { toast, ToastProvider } from "@shared/ui";

import { AuthProvider } from "../AuthProvider";
// Registra o namespace "auth" no i18n (efeito colateral do import da API pública do módulo).
import "../index";

export const server = setupServer();

/** Liga o server MSW nos hooks do Vitest. Chamar uma vez no topo do describe do arquivo. */
export function setupAuthTestServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    // Desmonta antes de limpar: um refetch que ficou pendente (ex.: GET /auth/me depois do 401)
    // seria disparado por `toast.clear()` já sem handler e quebraria a execução.
    cleanup();
    // A fila de toasts é global: o que uma ação deixou na tela não pode vazar para o próximo teste.
    toast.clear();
    server.resetHandlers();
  });
  afterAll(() => server.close());
}

/** Região dos toasts, montada ao lado do roteador como em `app/providers.tsx`. */
function TestToasts(): ReactElement {
  return <ToastProvider regionLabel="Notificações" closeLabel="Fechar notificação" />;
}

interface RenderWithProvidersOptions {
  /** Rota inicial do MemoryRouter. */
  route?: string;
}

/** Renderiza `ui` sob QueryClientProvider + MemoryRouter, em pt-BR. */
export async function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const { route = "/" } = options;

  await i18n.changeLanguage("pt-BR");

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const routes: RouteObject[] = [{ path: "*", element: ui }];
  const router = createMemoryRouter(routes, { initialEntries: [route] });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <TestToasts />
    </QueryClientProvider>,
  );

  return { ...view, router, queryClient };
}

export async function renderRoutes(
  routes: RouteObject[],
  options: RenderWithProvidersOptions = {},
) {
  const { route = "/" } = options;

  await i18n.changeLanguage("pt-BR");

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const rootRoutes: RouteObject[] = [{ element: <AuthProvider />, children: routes }];
  const router = createMemoryRouter(rootRoutes, { initialEntries: [route] });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <TestToasts />
    </QueryClientProvider>,
  );

  return { ...view, router, queryClient };
}
