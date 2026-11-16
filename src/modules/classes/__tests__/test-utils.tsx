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

import "../index";
import { buildMeUser, meHandler } from "./handlers";

export const server = setupServer();

/** The time zone of the people who use the system. The suite runs in it, whatever the machine. */
const TEST_TIME_ZONE = "America/Sao_Paulo";

/**
 * Starts MSW for the file, with an unhandled request being an error. It also pins the time zone:
 * the screen shows an instant (`createdAt`, the day of an enrollment) in the time zone of the
 * browser, so without this the expected text would depend on the machine that runs the suite.
 */
export function setupClassesTestServer(): void {
  let originalTimeZone: string | undefined;

  beforeAll(() => {
    originalTimeZone = process.env.TZ;
    process.env.TZ = TEST_TIME_ZONE;
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => server.resetHandlers());
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

/**
 * Renders `routes` under the session provider, at `route`, with the person `user` logged in
 * (`GET /auth/me` answered by MSW). It waits for the session to settle, so the page under test
 * starts with the permissions of the user already known.
 */
export async function renderRoutes(
  routes: RouteObject[],
  { route = "/", user = buildMeUser() }: RenderOptions = {},
) {
  await i18n.changeLanguage("pt-BR");
  server.use(meHandler({ user }));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ element: <AuthProvider />, children: routes }], {
    initialEntries: [route],
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await waitFor(() => {
    const session = queryClient.getQueryState(getMeQueryKey());
    expect(session?.status).toBeDefined();
    expect(session?.status).not.toBe("pending");
  });

  return { ...view, router, queryClient };
}

/** For a component that needs the router and the session (`Link`, `useCan`), with no route of its own. */
export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  return renderRoutes([{ path: "*", element: ui }], options);
}

export function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
