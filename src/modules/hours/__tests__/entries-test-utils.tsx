import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configure, getConfig, render, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";

import { getMeQueryKey } from "@api/generated/auth/auth";
import type { MeResponseDto, PermissionsDto } from "@api/generated/model";
import { AuthProvider } from "@modules/auth";
import { buildMeUser, meHandler } from "@modules/auth/__tests__/handlers";
import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";
import { toast, ToastProvider } from "@shared/ui";

// Registers the "hours" namespace.
import "../index";
import { ANA_ID, linkOptionsHandlers } from "./entries-handlers";

export const server = setupServer(...linkOptionsHandlers());

/** The time zone of the people who use the system. The suite runs in it, whatever the machine. */
const TEST_TIME_ZONE = "America/Sao_Paulo";

/** How long `findBy*` and `waitFor` wait: a form with a select and a date is slow on a busy machine. */
const ASYNC_UTIL_TIMEOUT_MS = 4000;

/**
 * Starts the MSW server of the file. A request nobody answered fails the test instead of passing.
 * It pins the time zone and clears the toasts, which live outside the React tree and would otherwise
 * carry from one test to the next.
 */
export function setupHoursEntriesTestServer(): void {
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

/**
 * Freezes the date of the machine on 16/03/2026, at noon, in every test of the `describe` it is
 * called in: the day of the Figma ("Março/2026", the 10/03 of the example). Only `Date` is faked, so
 * the timers of the screen still run.
 */
export function freezeToday(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 16, 12, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/** Ana Paula Torres, signed in with the profile `role` (every profile has `account.manageOwn`). */
export function sessionUser(role: Role = Role.coordinator): MeResponseDto {
  return buildMeUser({ id: ANA_ID, name: "Ana Paula Torres", role });
}

/** Ana with one permission set to another scope (`none`, to see what she is not offered). */
export function sessionUserWith(
  permission: keyof PermissionsDto,
  scope: PermissionsDto[keyof PermissionsDto],
): MeResponseDto {
  const user = sessionUser();
  return { ...user, permissions: { ...user.permissions, [permission]: scope } };
}

interface RenderOptions {
  user?: MeResponseDto;
  language?: "pt-BR" | "en-US";
}

/**
 * Renders `ui` under the session provider, the toasts and a query client that does not retry, and
 * waits until the session is known (what `useCan` reads).
 */
export async function renderWithProviders(
  ui: ReactElement,
  { user = sessionUser(), language = "pt-BR" }: RenderOptions = {},
) {
  await i18n.changeLanguage(language);
  server.use(meHandler({ user }));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: "*", element: <AuthProvider>{ui}</AuthProvider> }]);

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

export function createDeferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
}
