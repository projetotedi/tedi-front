import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { PendingInvitesButton } from "../components/PendingInvitesButton";
import { buildInviteListItem, listInvitesHandler, revokeInviteHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const TWO_INVITES = [
  buildInviteListItem({ id: "invite-1" }),
  buildInviteListItem({ id: "invite-2" }),
];

describe("PendingInvitesButton", () => {
  it("asks only for pending invites and shows how many there are", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listInvitesHandler({ data: TWO_INVITES, onCall }));

    await renderWithProviders(<PendingInvitesButton />);

    expect(
      await screen.findByRole("button", { name: "Convites pendentes (2)" }),
    ).toBeInTheDocument();
    expect(onCall.mock.calls[0]?.[0].get("status")).toBe("pending");
  });

  it("opens the pending invites dialog", async () => {
    server.use(listInvitesHandler({ data: TWO_INVITES }));
    const user = userEvent.setup();

    await renderWithProviders(<PendingInvitesButton />);
    const button = await screen.findByRole("button", { name: "Convites pendentes (2)" });
    expect(button).toBeEnabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(button);

    const dialog = await screen.findByRole("dialog", { name: "Convites pendentes (2)" });
    expect(within(dialog).getAllByRole("row")).toHaveLength(3);
  });

  it("the button count follows a revoke", async () => {
    let invites = [...TWO_INVITES];
    server.use(
      http.get("*/invites", () => HttpResponse.json(invites)),
      revokeInviteHandler({
        onCall: (id) => {
          invites = invites.filter((invite) => invite.id !== id);
        },
      }),
    );
    const user = userEvent.setup();

    await renderWithProviders(<PendingInvitesButton />);
    await user.click(await screen.findByRole("button", { name: "Convites pendentes (2)" }));
    const dialog = await screen.findByRole("dialog", { name: "Convites pendentes (2)" });
    await user.click(within(dialog).getAllByRole("button", { name: /^Revogar convite/ })[0]!);
    const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
    await user.click(within(confirmation).getByRole("button", { name: "Revogar" }));

    // O botão fica atrás do modal (fora da árvore de acessibilidade): daí `hidden`.
    expect(
      await screen.findByRole("button", { name: "Convites pendentes (1)", hidden: true }),
    ).toBeInTheDocument();
  });

  it("shows zero when there are no pending invites", async () => {
    server.use(listInvitesHandler({ data: [] }));

    await renderWithProviders(<PendingInvitesButton />);

    expect(
      await screen.findByRole("button", { name: "Convites pendentes (0)" }),
    ).toBeInTheDocument();
  });

  it("renders nothing while the request is loading", async () => {
    server.use(
      http.get("*/invites", async () => {
        await delay("infinite");
        return HttpResponse.json([]);
      }),
    );

    await renderWithProviders(<PendingInvitesButton />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing when the request fails", async () => {
    const onCall = vi.fn();
    server.use(listInvitesHandler({ error: { statusCode: 500, error: "INTERNAL" }, onCall }));

    const { queryClient } = await renderWithProviders(<PendingInvitesButton />);
    await waitFor(() => expect(onCall).toHaveBeenCalled());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
