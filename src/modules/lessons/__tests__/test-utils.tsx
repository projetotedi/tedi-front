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

/** The time zone of the people who use the system. The suite runs in it, whatever the machine. */
const TEST_TIME_ZONE = "America/Sao_Paulo";

/**
 * Starts the MSW server of the file. A request nobody answered fails the test instead of passing,
 * and the toasts a test raised are cleared after it. It also pins the time zone: the dates of a
 * lesson are read as local dates and an instant (`createdAt`) is shown in the time zone of the
 * browser, so without this the expected text could depend on the machine that runs the suite.
 */
export function setupLessonsTestServer(): void {
  let originalTimeZone: string | undefined;

  beforeAll(() => {
    originalTimeZone = process.env.TZ;
    process.env.TZ = TEST_TIME_ZONE;
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    server.resetHandlers();
    toast.clear();
  });
  afterAll(() => {
    server.close();
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });
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

  // The session is what `useCan` reads: wait until it is known, so a test never looks at the
  // moment before the permissions arrive.
  await waitFor(() => {
    const session = queryClient.getQueryState(getMeQueryKey());
    expect(session?.status).toBeDefined();
    expect(session?.status).not.toBe("pending");
  });

  return { ...view, router, queryClient };
}

/** Renders `ui` on any route, under the session provider, with a query client that does not retry. */
export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  return renderRouter([{ path: "*", element: <AuthProvider>{ui}</AuthProvider> }], options);
}

/** Renders the routes of a module under the session provider, as the app does. */
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
