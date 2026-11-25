import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configure, getConfig, render, waitFor } from "@testing-library/react";
import type { RequestHandler } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { afterAll, afterEach, beforeAll, expect } from "vitest";

import { getMeQueryKey } from "@api/generated/auth/auth";
import type { MeResponseDto } from "@api/generated/model";
import { AuthProvider } from "@modules/auth";
import { meHandler } from "@modules/auth/__tests__/handlers";
import i18n from "@shared/i18n";
import { toast, ToastProvider } from "@shared/ui";

import { hoursRoutes } from "../index";
import { coordinator } from "./bank-fixtures";
import {
  bankHandlers,
  createBankSpies,
  createBankStore,
  type BankSpies,
  type BankStore,
} from "./bank-handlers";

export const server = setupServer();

/** The time zone of the people who use the system: "14/03 · 18:42" is read in it. */
const TEST_TIME_ZONE = "America/Sao_Paulo";

/** A screen with a dialog, a queue and four probes is slow on a busy machine. */
const ASYNC_UTIL_TIMEOUT_MS = 4000;

/**
 * Starts the MSW server of the file: a request nobody answered fails the test. It pins the time zone
 * and clears the toasts, which live outside the React tree.
 */
export function setupBankTestServer(): void {
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

export interface BankRenderOptions {
  route?: string;
  user?: MeResponseDto | null;
  store?: BankStore;
  spies?: BankSpies;
  /** Handlers that answer before the ones of the store (an error, a held answer). */
  extraHandlers?: RequestHandler[];
}

async function renderRouter(routes: RouteObject[], options: BankRenderOptions) {
  const {
    route = "/",
    user = coordinator(),
    store = createBankStore(),
    spies = createBankSpies(),
    extraHandlers = [],
  } = options;
  await i18n.changeLanguage("pt-BR");
  server.use(...extraHandlers, meHandler({ user }), ...bankHandlers(store, spies));

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

  // The session is what `useCan` reads: wait until it is known.
  await waitFor(() => {
    const session = queryClient.getQueryState(getMeQueryKey());
    expect(session?.status).toBeDefined();
    expect(session?.status).not.toBe("pending");
  });

  return { ...view, router, queryClient, store, spies };
}

/** The routes of the module under the session provider, as the app mounts them. */
export function renderBankRoutes(options: BankRenderOptions = {}) {
  return renderRouter([{ element: <AuthProvider />, children: hoursRoutes }], options);
}

/** `ui` on any route, under the session provider. */
export function renderBankUi(ui: ReactElement, options: BankRenderOptions = {}) {
  return renderRouter([{ path: "*", element: <AuthProvider>{ui}</AuthProvider> }], options);
}

export function createDeferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Fails if the screen asked the API for the path, with no waiting: a query that never ran is idle
 * and has never had an answer. The first element of a generated query key is the path.
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
