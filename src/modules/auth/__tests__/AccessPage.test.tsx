import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { AccessPage } from "../pages/AccessPage";
import { authProtectedRoutes } from "../routes";
import { buildAccess, buildMeUser, listAccessHandler, meHandler } from "./handlers";
import { PERMISSIONS_BY_ROLE } from "./fixtures/permissions";
import { renderRoutes, renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

type OnCall = ReturnType<typeof vi.fn<(params: URLSearchParams) => void>>;

function lastParams(onCall: OnCall): URLSearchParams | undefined {
  return onCall.mock.calls.at(-1)?.[0];
}

/** A página lê `invites.manage` do /auth/me, então precisa do AuthProvider e de uma sessão. */
function renderAccessPage(user = buildMeUser({ role: Role.coordinator })) {
  server.use(meHandler({ user }));
  return renderWithProviders(
    <AuthProvider>
      <AccessPage />
    </AuthProvider>,
  );
}

function buildPeople(count: number) {
  return Array.from({ length: count }, (_, index) =>
    buildAccess({ id: `person-${index + 1}`, name: `Pessoa ${index + 1}` }),
  );
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("route /members", () => {
  it("coordinator sees the members card", async () => {
    server.use(
      meHandler({ user: buildMeUser({ role: Role.coordinator }) }),
      listAccessHandler({ data: [], total: 0 }),
    );

    await renderRoutes(authProtectedRoutes, { route: "/members" });

    expect(
      await screen.findByRole("heading", { name: "Alocações de membros (0)" }),
    ).toBeInTheDocument();
  });

  it("the /members route declares its route title", () => {
    expect(authProtectedRoutes[0]?.handle).toEqual({ title: "common:nav.members" });
  });

  it("director gets the forbidden page and GET /access is never requested", async () => {
    const onCall = vi.fn();
    server.use(
      meHandler({ user: buildMeUser({ role: Role.director }) }),
      listAccessHandler({ onCall }),
    );

    await renderRoutes(authProtectedRoutes, { route: "/members" });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(onCall).not.toHaveBeenCalled();
  });
});

describe("AccessPage", () => {
  it("hides Gerar link de cadastro without invites.manage", async () => {
    server.use(listAccessHandler({ data: buildPeople(1), total: 1 }));

    await renderAccessPage(
      buildMeUser({
        permissions: { ...PERMISSIONS_BY_ROLE.coordinator, "invites.manage": "none" },
      }),
    );
    await screen.findByRole("cell", { name: "Pessoa 1" });

    expect(
      screen.queryByRole("button", { name: "Gerar link de cadastro" }),
    ).not.toBeInTheDocument();
  });

  it("requests page 1 with limit 12 and no filter", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: buildPeople(3), total: 3, onCall }));

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    const params = onCall.mock.calls[0]?.[0];
    expect(params?.get("page")).toBe("1");
    expect(params?.get("limit")).toBe("12");
    expect(params?.has("search")).toBe(false);
    expect(params?.has("role")).toBe(false);
    expect(params?.has("enabled")).toBe(false);
  });

  it("shows the total in the card title and the summary", async () => {
    server.use(listAccessHandler({ data: buildPeople(12), total: 16 }));

    await renderAccessPage();

    expect(
      await screen.findByRole("heading", { name: "Alocações de membros (16)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Alocações de membros (16)" })).toBeInTheDocument();
    expect(screen.getByText("Mostrando 12 de 16 alocações")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(13);
  });

  it("shows loading status without the total and keeps the create button", async () => {
    server.use(
      http.get("*/access", async () => {
        await delay("infinite");
        return HttpResponse.json({ data: [], page: 1, limit: 12, total: 0 });
      }),
    );

    await renderAccessPage();

    expect(screen.getByRole("status")).toHaveTextContent("Carregando pessoas");
    expect(screen.getByRole("heading", { name: "Alocações de membros" })).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Gerar link de cadastro" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it("shows error with retry", async () => {
    server.use(listAccessHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
    const user = userEvent.setup();

    await renderAccessPage();

    await screen.findByText("Não foi possível carregar as pessoas com acesso.");
    expect(
      await screen.findByRole("button", { name: "Gerar link de cadastro" }),
    ).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Tentar de novo" });

    server.use(listAccessHandler({ data: [buildAccess({ name: "Ana Torres" })], total: 1 }));
    await user.click(retryButton);

    expect(await screen.findByRole("cell", { name: "Ana Torres" })).toBeInTheDocument();
  });

  it("empty list shows the empty message, keeps Gerar link de cadastro and hides the footer", async () => {
    server.use(listAccessHandler({ data: [], total: 0 }));

    await renderAccessPage();

    expect(await screen.findByText("Nenhum acesso encontrado")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Gerar link de cadastro" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Paginação da lista de membros" }),
    ).not.toBeInTheDocument();
  });

  it("Papel filter sends role and returns to page 1", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: buildPeople(12), total: 30, onCall }));
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: "Página 3" }));
    await waitFor(() => expect(lastParams(onCall)?.get("page")).toBe("3"));

    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Diretor" }));

    await waitFor(() => {
      expect(lastParams(onCall)?.get("role")).toBe("director");
      expect(lastParams(onCall)?.get("page")).toBe("1");
    });
  });

  it("Status filter sends enabled=false for Inativo and drops it for Todos", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: buildPeople(3), total: 3, onCall }));
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Inativo" }));
    await waitFor(() => expect(lastParams(onCall)?.get("enabled")).toBe("false"));

    await user.click(screen.getByRole("button", { name: /Status: Inativo/ }));
    await user.click(await screen.findByRole("option", { name: "Todos" }));
    await waitFor(() => expect(lastParams(onCall)?.has("enabled")).toBe(false));
  });

  it("search is sent after typing and returns to page 1", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: buildPeople(12), total: 30, onCall }));
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: "Página 2" }));
    await waitFor(() => expect(lastParams(onCall)?.get("page")).toBe("2"));

    await user.type(screen.getByRole("textbox", { name: "Buscar por nome ou RA" }), "Ana");

    await waitFor(
      () => {
        expect(lastParams(onCall)?.get("search")).toBe("Ana");
        expect(lastParams(onCall)?.get("page")).toBe("1");
      },
      { timeout: 2000 },
    );
    const searches = onCall.mock.calls.map(([params]) => params.get("search"));
    expect(searches).not.toContain("A");
    expect(searches).not.toContain("An");
  });

  it("numbered pagination requests the pressed page and marks it as current", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: buildPeople(12), total: 30, onCall }));
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });
    expect(screen.getByRole("button", { name: "Página 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(screen.getByRole("button", { name: "Página 3" }));

    await waitFor(() => expect(lastParams(onCall)?.get("page")).toBe("3"));
    expect(screen.getByRole("button", { name: "Página 3" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Página 1" })).not.toHaveAttribute("aria-current");
  });

  it("next and previous buttons move one page", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: buildPeople(12), total: 30, onCall }));
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(lastParams(onCall)?.get("page")).toBe("2"));

    await user.click(screen.getByRole("button", { name: "Página anterior" }));
    await waitFor(() => expect(lastParams(onCall)?.get("page")).toBe("1"));
  });

  it("keeps the rows of the current page while the next one loads", async () => {
    const deferred = createDeferred();
    server.use(
      http.get("*/access", async ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        if (page === 2) await deferred.promise;
        return HttpResponse.json({
          data: [buildAccess({ id: `page-${page}`, name: `Pessoa da página ${page}` })],
          page,
          limit: 12,
          total: 30,
        });
      }),
    );
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa da página 1" });

    await user.click(screen.getByRole("button", { name: "Página 2" }));

    expect(screen.getByRole("cell", { name: "Pessoa da página 1" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    deferred.resolve();
    expect(await screen.findByRole("cell", { name: "Pessoa da página 2" })).toBeInTheDocument();
  });

  it("hides pagination when everything fits in one page", async () => {
    server.use(listAccessHandler({ data: buildPeople(5), total: 5 }));

    await renderAccessPage();

    expect(await screen.findByText("Mostrando 5 de 5 alocações")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Paginação da lista de membros" }),
    ).not.toBeInTheDocument();
  });
});
