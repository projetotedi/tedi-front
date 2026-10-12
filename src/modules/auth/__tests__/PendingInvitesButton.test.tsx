import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { PendingInvitesButton } from "../components/PendingInvitesButton";
import { buildInviteListItem, listInvitesHandler } from "./handlers";
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

  it("is disabled until the invites modal exists", async () => {
    server.use(listInvitesHandler({ data: TWO_INVITES }));

    await renderWithProviders(<PendingInvitesButton />);

    expect(await screen.findByRole("button", { name: "Convites pendentes (2)" })).toBeDisabled();
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
