import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { afterAll, afterEach, beforeAll } from "vitest";

import i18n from "@shared/i18n";

// Registra o namespace "auth" no i18n (efeito colateral do import da API pública do módulo).
import "../index";

export const server = setupServer();

/** Liga o server MSW nos hooks do Vitest. Chamar uma vez no topo do describe do arquivo. */
export function setupAuthTestServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
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
    defaultOptions: { queries: { retry: false } },
  });

  const routes: RouteObject[] = [{ path: "*", element: ui }];
  const router = createMemoryRouter(routes, { initialEntries: [route] });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { ...view, router, queryClient };
}
