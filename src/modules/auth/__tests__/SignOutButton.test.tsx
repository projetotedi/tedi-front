import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { SignOutButton } from "../components/SignOutButton";
import { buildMeUser, logoutHandler, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

describe("SignOutButton", () => {
  it("calls POST /auth/logout and goes back to the login page", async () => {
    let calls = 0;
    server.use(
      meHandler({ user: buildMeUser({ role: Role.coordinator }) }),
      logoutHandler(() => {
        calls += 1;
      }),
    );

    const { router } = await renderWithProviders(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    const button = await screen.findByRole("button", { name: "Sair" });
    // React Aria's usePress relies on PointerEvent, which jsdom does not fully implement;
    // a click with detail: 0 is treated as a virtual press, so fireEvent.click still works.
    fireEvent.click(button);

    await waitFor(() => expect(calls).toBe(1));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("renders nothing when there is no active session", async () => {
    server.use(meHandler({ user: null }));

    await renderWithProviders(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());
  });
});
