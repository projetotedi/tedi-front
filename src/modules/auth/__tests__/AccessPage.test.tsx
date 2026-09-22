import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { InviteListItemDtoStatus, InviteType } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { AccessTable } from "../components/AccessTable";
import { InvitesTable } from "../components/InvitesTable";
import { AccessPage } from "../pages/AccessPage";
import { authProtectedRoutes } from "../routes";
import {
  buildAccess,
  buildCreateInviteResponse,
  buildInviteListItem,
  buildMeUser,
  createInviteHandler,
  listAccessHandler,
  listInvitesHandler,
  meHandler,
} from "./handlers";
import { renderRoutes, renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

describe("AccessTable", () => {
  it("renders one row per person with name, RA and translated role", async () => {
    server.use(
      listAccessHandler({
        data: [
          buildAccess({ id: "1", name: "Ana Coordenadora", ra: "2024RA0001", role: Role.director }),
          buildAccess({
            id: "2",
            name: "Beto Diretor",
            ra: "2024RA0002",
            email: "beto@example.com",
            role: Role.member,
          }),
        ],
        total: 2,
      }),
    );

    await renderWithProviders(<AccessTable />);

    expect(await screen.findByRole("cell", { name: "Ana Coordenadora" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Beto Diretor" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2024RA0001" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2024RA0002" })).toBeInTheDocument();
    expect(screen.getByText("Diretor(a)")).toBeInTheDocument();
    expect(screen.getByText("Membro")).toBeInTheDocument();
  });

  it("shows a superadmin as Coordenadora", async () => {
    server.use(
      listAccessHandler({
        data: [buildAccess({ role: Role.superadmin })],
        total: 1,
      }),
    );

    await renderWithProviders(<AccessTable />);

    expect(await screen.findByText("Coordenadora")).toBeInTheDocument();
  });

  it("shows loading status", async () => {
    server.use(
      http.get("*/access", async () => {
        await delay("infinite");
        return HttpResponse.json({ data: [], page: 1, limit: 20, total: 0 });
      }),
    );

    await renderWithProviders(<AccessTable />);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando pessoas");
  });

  it("shows error with retry", async () => {
    server.use(listAccessHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
    const user = userEvent.setup();

    await renderWithProviders(<AccessTable />);

    await screen.findByText("Não foi possível carregar as pessoas com acesso.");
    const retryButton = screen.getByRole("button", { name: "Tentar de novo" });

    server.use(listAccessHandler({ data: [buildAccess()], total: 1 }));
    await user.click(retryButton);

    expect(await screen.findByRole("cell", { name: "Ana Coordenadora" })).toBeInTheDocument();
  });

  it("empty access list shows the empty message", async () => {
    server.use(listAccessHandler({ data: [], total: 0 }));

    await renderWithProviders(<AccessTable />);

    expect(await screen.findByText("Nenhum acesso encontrado")).toBeInTheDocument();
  });

  it("resets to page 1 when a new search is submitted", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: [buildAccess()], total: 25, limit: 20, onCall }));
    const user = userEvent.setup();

    await renderWithProviders(<AccessTable />);
    await screen.findByRole("cell", { name: "Ana Coordenadora" });

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(onCall.mock.calls.at(-1)?.[0].get("page")).toBe("2"));

    await user.type(screen.getByLabelText("Buscar por nome ou RA"), "Ana");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => {
      const params = onCall.mock.calls.at(-1)?.[0];
      expect(params?.get("page")).toBe("1");
      expect(params?.get("search")).toBe("Ana");
    });
  });

  it("requests the next page", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: [buildAccess()], total: 25, limit: 20, onCall }));
    const user = userEvent.setup();

    await renderWithProviders(<AccessTable />);
    await screen.findByRole("cell", { name: "Ana Coordenadora" });

    await user.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() => {
      expect(onCall.mock.calls.at(-1)?.[0].get("page")).toBe("2");
    });
  });
});

describe("InvitesTable", () => {
  it("translates pending and expired statuses", async () => {
    server.use(
      listInvitesHandler({
        data: [
          buildInviteListItem({
            id: "1",
            status: InviteListItemDtoStatus.pending,
            role: Role.member,
          }),
          buildInviteListItem({
            id: "2",
            status: InviteListItemDtoStatus.expired,
            role: Role.director,
          }),
        ],
      }),
    );

    await renderWithProviders(<InvitesTable />);

    expect(await screen.findByText("Pendente")).toBeInTheDocument();
    expect(screen.getByText("Expirado")).toBeInTheDocument();
  });

  it("shows a dash for the role of a password_reset invite", async () => {
    server.use(
      listInvitesHandler({
        data: [buildInviteListItem({ type: InviteType.password_reset, role: null })],
      }),
    );

    await renderWithProviders(<InvitesTable />);

    expect(await screen.findByRole("cell", { name: "—" })).toBeInTheDocument();
    expect(screen.getByText("Redefinição de senha")).toBeInTheDocument();
  });

  it("empty invites list shows the empty message", async () => {
    server.use(listInvitesHandler({ data: [] }));

    await renderWithProviders(<InvitesTable />);

    expect(await screen.findByText("Nenhum convite encontrado")).toBeInTheDocument();
  });

  it("shows error with retry", async () => {
    server.use(listInvitesHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
    const user = userEvent.setup();

    await renderWithProviders(<InvitesTable />);

    await screen.findByText("Não foi possível carregar os convites.");
    const retryButton = screen.getByRole("button", { name: "Tentar de novo" });

    server.use(listInvitesHandler({ data: [buildInviteListItem()] }));
    await user.click(retryButton);

    expect(await screen.findByText("Pendente")).toBeInTheDocument();
  });
});

describe("route /access", () => {
  it("coordinator sees the People and Invites tabs", async () => {
    server.use(
      meHandler({ user: buildMeUser({ role: Role.coordinator }) }),
      listAccessHandler({ data: [], total: 0 }),
      listInvitesHandler({ data: [] }),
    );

    await renderRoutes(authProtectedRoutes, { route: "/access" });

    expect(await screen.findByRole("tab", { name: "Pessoas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Convites" })).toBeInTheDocument();
  });

  it("director gets the forbidden page and /access is never requested", async () => {
    const onCall = vi.fn();
    server.use(
      meHandler({ user: buildMeUser({ role: Role.director }) }),
      listAccessHandler({ onCall }),
    );

    await renderRoutes(authProtectedRoutes, { route: "/access" });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(onCall).not.toHaveBeenCalled();
  });
});

describe("AccessPage", () => {
  it("empty access list shows the empty message and keeps the create button", async () => {
    server.use(listAccessHandler({ data: [], total: 0 }), listInvitesHandler({ data: [] }));

    await renderWithProviders(<AccessPage />);

    expect(await screen.findByText("Nenhum acesso encontrado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar convite" })).toBeInTheDocument();
  });

  it("after generating, invites list is refetched and shows the new pending invite in the Invites tab", async () => {
    // GET /invites começa vazio; o handler de POST /invites troca a resposta do GET (como o
    // back faria de verdade), provando que a lista é buscada de novo e mostra o item novo,
    // e não apenas um estado local otimista.
    server.use(
      listAccessHandler({ data: [buildAccess()], total: 1 }),
      listInvitesHandler({ data: [] }),
      createInviteHandler({
        response: buildCreateInviteResponse({ role: Role.member }),
        onCall: () => {
          server.use(
            listInvitesHandler({
              data: [
                buildInviteListItem({
                  status: InviteListItemDtoStatus.pending,
                  role: Role.member,
                }),
              ],
            }),
          );
        },
      }),
    );
    const user = userEvent.setup();
    await renderWithProviders(<AccessPage />);

    await screen.findByRole("cell", { name: "Ana Coordenadora" });
    expect(screen.getByRole("tab", { name: "Pessoas", selected: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));
    await user.click(screen.getByRole("button", { name: "Gerar link" }));
    await screen.findByLabelText("Link do convite");
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(
      await screen.findByRole("tab", { name: "Convites", selected: true }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Pendente")).toBeInTheDocument();
  });
});
