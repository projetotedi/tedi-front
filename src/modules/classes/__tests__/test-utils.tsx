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

export function setupClassesTestServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
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

export function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
