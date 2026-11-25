import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { useAuth } from "../hooks/useAuth";
import { usePermissionCheck } from "../hooks/usePermissionCheck";
import { buildMeUser, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const SELF = "01952ef7-0000-7000-8000-000000000001";
const OTHER = "01952ef7-0000-7000-8000-000000000002";

/** Asks the same check for several targets in one render, as a table does for its rows. */
function Probe() {
  const { status } = useAuth();
  const check = usePermissionCheck();
  const answers = [
    check("hours.review"),
    check("hours.review", { personId: OTHER }),
    check("hours.review", { personId: SELF }),
    check("hours.viewOthers"),
  ];
  return <p>{`${status}:${answers.map(String).join(",")}`}</p>;
}

function renderProbe() {
  return renderWithProviders(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe("usePermissionCheck", () => {
  it("answers every question with the permission map of /auth/me, the person's own entry included", async () => {
    server.use(meHandler({ user: buildMeUser({ id: SELF, role: Role.coordinator }) }));
    await renderProbe();

    expect(await screen.findByText("authenticated:true,true,false,true")).toBeInTheDocument();
  });

  it("answers the scope of the director, who does not review hours", async () => {
    server.use(meHandler({ user: buildMeUser({ id: SELF, role: Role.director }) }));
    await renderProbe();

    expect(await screen.findByText("authenticated:false,false,false,true")).toBeInTheDocument();
  });

  it("denies everything without a session", async () => {
    server.use(meHandler({ user: null }));
    await renderProbe();

    expect(await screen.findByText("anonymous:false,false,false,false")).toBeInTheDocument();
  });
});
