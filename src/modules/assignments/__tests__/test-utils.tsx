import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configure, getConfig, render, waitFor } from "@testing-library/react";
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
 * How long `findBy*` and `waitFor` wait. A form with three selects, each opened and chosen before
 * the save, is slow on a busy machine, so the default one second would leave almost nothing for the
 * request and the render.
 */
const ASYNC_UTIL_TIMEOUT_MS = 4000;

/**
 * Starts the MSW server of the file. A request nobody answered fails the test instead of passing.
 * It pins the time zone (the dates of the screen are calendar dates, but the suite should not
 * depend on the machine that runs it) and clears the toasts, which live outside the React tree
 * and would otherwise carry from one test to the next.
 */
export function setupAssignmentsTestServer(): void {
  let originalTimeZone: string | undefined;
  let originalTimeout: number | undefined;

  beforeAll(() => {
    originalTimeZone = process.env.TZ;
    process.env.TZ = TEST_TIME_ZONE;
    originalTimeout = getConfig().asyncUtilTimeout;
    configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    server.resetHandlers();
    toast.clear();
  });
  afterAll(() => {
    server.close();
    if (originalTimeout !== undefined) configure({ asyncUtilTimeout: originalTimeout });
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

/**
 * Renders `ui` on any route, under the session provider, with a query client that does not retry,
 * and waits until the session is known.
 */
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

/**
 * Fails if the screen asked the API for anything besides the session, with no waiting.
 *
 * A query that is mounted turned on is already `fetching` when the render ends, and later holds a
 * result (data or error). A query that is turned off (`enabled: false`) sits in the cache idle and
 * never runs. So reading the cache is a check that does not depend on how long a request that was
 * never made would have taken to show up, which a pause and a spy on the handler cannot say.
 */
export function expectNoRequestBesidesSession(queryClient: QueryClient): void {
  const [sessionKey] = getMeQueryKey();
  const queries = queryClient
    .getQueryCache()
    .findAll()
    .filter((query) => query.queryKey[0] !== sessionKey);

  for (const query of queries) {
    const name = JSON.stringify(query.queryKey);
    expect(query.state.fetchStatus, `${name} is running`).toBe("idle");
    expect(query.state.dataUpdateCount + query.state.errorUpdateCount, `${name} already ran`).toBe(
      0,
    );
  }
}

/**
 * Fails if a query was ever on its way, with no waiting: the screen kept it turned off. The query
 * is in the cache even then (an observer builds it), idle and with nothing in it, so what tells
 * "never asked" is that it is not fetching and has never had an answer, data or error.
 */
export function expectQueryNeverRan(queryClient: QueryClient, queryKey: readonly unknown[]): void {
  for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
    const name = JSON.stringify(query.queryKey);
    expect(query.state.fetchStatus, `${name} is running`).toBe("idle");
    expect(query.state.dataUpdateCount + query.state.errorUpdateCount, `${name} already ran`).toBe(
      0,
    );
  }
}

/**
 * Fails if the screen asked the API for the path, with no waiting. The first element of a query key
 * of the generated hooks is the path (`/applications`, `/me/assignments`); it reads the cache the
 * same way as `expectNoRequestBesidesSession`.
 */
export function expectNoRequestTo(queryClient: QueryClient, path: string): void {
  const queries = queryClient
    .getQueryCache()
    .findAll()
    .filter((query) => query.queryKey[0] === path);

  for (const query of queries) {
    const name = JSON.stringify(query.queryKey);
    expect(query.state.fetchStatus, `${name} is running`).toBe("idle");
    expect(query.state.dataUpdateCount + query.state.errorUpdateCount, `${name} already ran`).toBe(
      0,
    );
  }
}
