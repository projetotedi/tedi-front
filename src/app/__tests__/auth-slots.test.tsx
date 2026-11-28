import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { MemberStatus, type MemberListItemResponseDto } from "@api/generated/model";
import { createAuthProtectedRoutes } from "@modules/auth";
import {
  buildMember,
  buildMeUser,
  listInvitesHandler,
  meHandler,
} from "@modules/auth/__tests__/handlers";
import { listDepartmentsHandler } from "@modules/auth/__tests__/member-registration-handlers";
import { renderRoutes, server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import {
  buildMemberDetail,
  deactivateMemberHandler,
  getMemberHandler,
  MEMBER_ID,
  MEMBER_NAME,
  updateMemberHandler,
} from "@modules/people/__tests__/handlers";
import { Role } from "@shared/lib/role";

import { authRouteSlots } from "../auth-slots";

setupAuthTestServer();

const routes = createAuthProtectedRoutes(authRouteSlots);

/**
 * `GET /members` with state: the writes change the row, as the API does, and the list that comes
 * back after them shows it.
 */
function statefulMembers() {
  let rows: MemberListItemResponseDto[] = [
    buildMember({ id: MEMBER_ID, name: MEMBER_NAME, role: Role.member }),
  ];
  const listCalls = vi.fn();
  server.use(
    http.get("*/members", () => {
      listCalls();
      return HttpResponse.json({ data: rows, page: 1, limit: 12, total: rows.length });
    }),
  );
  return {
    listCalls,
    change: (patch: Partial<MemberListItemResponseDto>) => {
      rows = rows.map((row) => ({ ...row, ...patch }));
    },
  };
}

/** The list of Membros with the real slots, for the coordination. */
async function renderMembers() {
  server.use(
    meHandler({ user: buildMeUser({ role: Role.coordinator }) }),
    listInvitesHandler(),
    getMemberHandler(),
    listDepartmentsHandler(),
  );
  await renderRoutes(routes, { route: "/members" });
  await screen.findByRole("cell", { name: MEMBER_NAME });
}

const rowOf = (name: string) =>
  within(screen.getByRole("table", { name: "Membros do TEDI", hidden: true }))
    .getByText(name)
    .closest("tr")!;

describe("the dialogs of a row of Membros, filled by the app", () => {
  it("the pencil opens Editar membro of people, which saves the data and refreshes the list", async () => {
    const { change, listCalls } = statefulMembers();
    server.use(
      updateMemberHandler({
        onCall: ({ body }) => change({ name: String(body.name) }),
      }),
    );
    const user = userEvent.setup();
    await renderMembers();
    const callsBefore = listCalls.mock.calls.length;

    await user.click(screen.getByRole("button", { name: `Editar ${MEMBER_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: "Editar membro" });
    const name = await within(dialog).findByRole("textbox", { name: /^Nome completo/ });
    expect(name).toHaveValue(MEMBER_NAME);
    expect(within(dialog).getByRole("region", { name: "Acesso ao sistema" })).toBeInTheDocument();
    await user.clear(name);
    await user.type(name, "Beatriz Nunes");
    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("cell", { name: "Beatriz Nunes" })).toBeInTheDocument();
    expect(listCalls.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("the bin opens Inativar membro of people: the member turns Inativo, without the bin, and the focus goes to the title", async () => {
    const { change } = statefulMembers();
    const onDeactivate = vi.fn();
    server.use(
      deactivateMemberHandler({
        member: buildMemberDetail(),
        onCall: (call) => {
          onDeactivate(call);
          change({ status: MemberStatus.inactive, accessEnabled: false });
        },
      }),
    );
    const user = userEvent.setup();
    await renderMembers();

    await user.click(screen.getByRole("button", { name: `Inativar ${MEMBER_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: "Inativar membro" });
    expect(
      within(dialog).getByText(`${MEMBER_NAME} deixa de participar do projeto`),
    ).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Motivo da saída/ }),
      "Formou-se.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Inativar membro" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onDeactivate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MEMBER_ID,
        body: expect.objectContaining({ reason: "Formou-se." }),
      }),
    );
    await waitFor(() =>
      expect(within(rowOf(MEMBER_NAME)).getByText("Inativo")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: `Inativar ${MEMBER_NAME}` }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Membros (1)")).toHaveFocus());
  });
});
