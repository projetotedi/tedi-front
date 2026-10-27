import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { afterAll, afterEach, beforeAll, expect } from "vitest";

import { getMeQueryKey } from "@api/generated/auth/auth";
import type { MeResponseDto } from "@api/generated/model";
import { AuthProvider } from "@modules/auth";
import i18n from "@shared/i18n";
import { toast, ToastProvider } from "@shared/ui";

import "../index";
import { buildMeUser, meHandler } from "./handlers";

export const server = setupServer();

export function setupCatalogTestServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    toast.clear();
  });
  afterAll(() => server.close());
}

interface RenderOptions {
  route?: string;
  user?: MeResponseDto | null;
}

async function renderRouter(
  routes: RouteObject[],
  { route = "/", user = buildMeUser() }: RenderOptions,
) {
  await i18n.changeLanguage("pt-BR");
  server.use(meHandler({ user }));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [route] });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastProvider regionLabel="Notificações" closeLabel="Fechar notificação" />
    </QueryClientProvider>,
  );

  await waitFor(() => {
    const session = queryClient.getQueryState(getMeQueryKey());
    expect(session?.status).toBeDefined();
    expect(session?.status).not.toBe("pending");
  });

  return { ...view, router, queryClient };
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  return renderRouter([{ path: "*", element: <AuthProvider>{ui}</AuthProvider> }], options);
}

export function renderRoutes(routes: RouteObject[], options: RenderOptions = {}) {
  return renderRouter([{ element: <AuthProvider />, children: routes }], options);
}

export function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
