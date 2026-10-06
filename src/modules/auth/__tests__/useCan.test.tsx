import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Permission, PermissionTarget } from "@shared/lib/permissions";
import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { useAuth } from "../hooks/useAuth";
import { useCan } from "../hooks/useCan";
import { buildMeUser, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

function Probe({ permission, target }: { permission: Permission; target?: PermissionTarget }) {
  const { status } = useAuth();
  const allowed = useCan(permission, target);
  return (
    <p data-testid="probe">
      {status}:{String(allowed)}
    </p>
  );
}

function renderProbe(permission: Permission, target?: PermissionTarget) {
  return renderWithProviders(
    <AuthProvider>
      <Probe permission={permission} target={target} />
    </AuthProvider>,
  );
}

describe("useCan", () => {
  it("returns false without a session", async () => {
    server.use(meHandler({ user: null }));
    await renderProbe("catalog.view");

    expect(await screen.findByText("anonymous:false")).toBeInTheDocument();
  });

  it("reads the permission map from /auth/me", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.coordinator }) }));
    await renderProbe("members.deactivate");

    expect(await screen.findByText("authenticated:true")).toBeInTheDocument();
  });

  it("follows a permission map that denies what the role would normally allow", async () => {
    const coordinator = buildMeUser({ role: Role.coordinator });
    server.use(
      meHandler({
        user: buildMeUser({
          role: Role.coordinator,
          permissions: { ...coordinator.permissions, "members.deactivate": "none" },
        }),
      }),
    );
    await renderProbe("members.deactivate");

    expect(await screen.findByText("authenticated:false")).toBeInTheDocument();
  });

  it("uses serverGrant for a department-scoped permission with a target", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.director }) }));
    await renderProbe("members.edit", { personId: "other", serverGrant: true });

    expect(await screen.findByText("authenticated:true")).toBeInTheDocument();
  });
});
