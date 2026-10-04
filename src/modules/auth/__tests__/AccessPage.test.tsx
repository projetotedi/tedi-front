import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getListAccessQueryKey } from "@api/generated";
import { Role } from "@shared/lib/role";

import { AccessPage } from "../pages/AccessPage";
import { authProtectedRoutes } from "../routes";
import {
  buildAccess,
  buildInviteListItem,
  buildMeUser,
  listAccessHandler,
  listInvitesHandler,
  meHandler,
} from "./handlers";
import { renderRoutes, renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

beforeEach(() => {
  server.use(listInvitesHandler());
});

type OnCall = ReturnType<typeof vi.fn<(params: URLSearchParams) => void>>;

function lastParams(onCall: OnCall): URLSearchParams | undefined {
  return onCall.mock.calls.at(-1)?.[0];
}

function buildPeople(count: number) {
  return Array.from({ length: count }, (_, index) =>
    buildAccess({ id: `person-${index + 1}`, name: `Pessoa ${index + 1}` }),
  );
}

/** Responde sem linhas quando `isMiss` reconhece os filtros da requisição; senão devolve 3 pessoas. */
function accessHandlerWhere(isMiss: (params: URLSearchParams) => boolean, onCall?: OnCall) {
  return http.get("*/access", ({ request }) => {
    const params = new URL(request.url).searchParams;
    onCall?.(params);
    const data = isMiss(params) ? [] : buildPeople(3);
    return HttpResponse.json({ data, page: 1, limit: 12, total: data.length });
  });
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

    expect(await screen.findByRole("heading", { name: "Membros (0)" })).toBeInTheDocument();
  });

  it("the /members route declares its route title", () => {
    expect(authProtectedRoutes[0]?.handle).toEqual({ title: "common:nav.members" });
  });

  it("director gets the forbidden page and neither GET /access nor GET /invites is requested", async () => {
    const onAccessCall = vi.fn();
    const onInvitesCall = vi.fn();
    server.use(
      meHandler({ user: buildMeUser({ role: Role.director }) }),
      listAccessHandler({ onCall: onAccessCall }),
      listInvitesHandler({ onCall: onInvitesCall }),
    );

    await renderRoutes(authProtectedRoutes, { route: "/members" });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(onAccessCall).not.toHaveBeenCalled();
    expect(onInvitesCall).not.toHaveBeenCalled();
  });
});

describe("AccessPage", () => {
  it("requests page 1 with limit 12 and no filter", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: buildPeople(3), total: 3, onCall }));

    await renderWithProviders(<AccessPage />);
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

    await renderWithProviders(<AccessPage />);

    expect(await screen.findByRole("heading", { name: "Membros (16)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Membros (16)" })).toBeInTheDocument();
    expect(screen.getByText("Mostrando 12 de 16 membros")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(13);
  });

  it("first load shows the loading status, the title without total and keeps the create button", async () => {
    server.use(
      http.get("*/access", async () => {
        await delay("infinite");
        return HttpResponse.json({ data: [], page: 1, limit: 12, total: 0 });
      }),
    );

    await renderWithProviders(<AccessPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando membros…");
    expect(screen.getByRole("heading", { name: "Membros" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar link de cadastro" })).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it("shows error with retry", async () => {
    server.use(listAccessHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
    const user = userEvent.setup();

    await renderWithProviders(<AccessPage />);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByRole("heading", { name: "Não foi possível carregar os membros" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar link de cadastro" })).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Tentar de novo" });

    server.use(listAccessHandler({ data: [buildAccess({ name: "Ana Torres" })], total: 1 }));
    await user.click(retryButton);

    expect(await screen.findByRole("cell", { name: "Ana Torres" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("empty list shows the empty state, keeps the column headers and hides the footer", async () => {
    server.use(listAccessHandler({ data: [], total: 0 }));

    await renderWithProviders(<AccessPage />);

    expect(await screen.findByRole("heading", { name: "Nenhum membro ainda" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Paginação da lista de membros" }),
    ).not.toBeInTheDocument();
  });

  it("the empty state offers a second Gerar link de cadastro that opens the dialog", async () => {
    server.use(listAccessHandler({ data: [], total: 0 }));
    const user = userEvent.setup();

    await renderWithProviders(<AccessPage />);
    await screen.findByRole("heading", { name: "Nenhum membro ainda" });

    expect(screen.getAllByRole("button", { name: "Gerar link de cadastro" })).toHaveLength(2);
    await user.click(
      within(screen.getByTestId("access-list")).getByRole("button", {
        name: "Gerar link de cadastro",
      }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Gerar link de cadastro" }),
    ).toBeInTheDocument();
  });

  it("shows the pending invites count next to the create button", async () => {
    server.use(
      listAccessHandler({ data: buildPeople(3) }),
      listInvitesHandler({
        data: [buildInviteListItem({ id: "invite-1" }), buildInviteListItem({ id: "invite-2" })],
      }),
    );

    await renderWithProviders(<AccessPage />);

    const pending = await screen.findByRole("button", { name: "Convites pendentes (2)" });
    const create = screen.getByRole("button", { name: "Gerar link de cadastro" });
    expect(pending).toBeDisabled();
    expect(pending.parentElement).toBe(create.parentElement);
    expect(pending.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a search without matches shows Nada encontrado and Limpar filtros brings the list back", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(accessHandlerWhere((params) => params.get("search") === "zzz", onCall));
    const user = userEvent.setup();

    await renderWithProviders(<AccessPage />);
    await screen.findByRole("cell", { name: "Pessoa 1" });

    const search = screen.getByRole("textbox", { name: "Buscar por nome ou RA" });
    await user.type(search, "zzz");
    expect(
      await screen.findByRole("heading", { name: "Nada encontrado" }, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    const callsBeforeClearing = onCall.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

    // O prazo menor que o debounce (400 ms) prova que apagar a busca não espera por ele.
    expect(
      await screen.findByRole("cell", { name: "Pessoa 1" }, { timeout: 300 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nada encontrado" })).not.toBeInTheDocument();
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    const laterSearches = onCall.mock.calls
      .slice(callsBeforeClearing)
      .map(([p]) => p.get("search"));
    expect(laterSearches).not.toContain("zzz");
  });

  it("a role filter without matches shows Nada encontrado, not the empty state", async () => {
    server.use(accessHandlerWhere((params) => params.has("role")));
    const user = userEvent.setup();

    await renderWithProviders(<AccessPage />);
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Diretor" }));

    expect(await screen.findByRole("heading", { name: "Nada encontrado" })).toBeInTheDocument();
    expect(screen.queryByText("Nenhum membro ainda")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeInTheDocument();
  });

  it("clearing the filters resets the role and status selects", async () => {
    server.use(accessHandlerWhere((params) => params.has("role") || params.has("enabled")));
    const user = userEvent.setup();

    await renderWithProviders(<AccessPage />);
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Diretor" }));
    await user.click(await screen.findByRole("button", { name: "Limpar filtros" }));

    expect(await screen.findByRole("cell", { name: "Pessoa 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Papel: todos/ })).toBeInTheDocument();
  });

  it("waiting for an uncached list after clearing shows the loading state, never the empty state", async () => {
    const deferred = createDeferred();
    let holdUnfilteredList = false;
    server.use(
      http.get("*/access", async ({ request }) => {
        const isMiss = new URL(request.url).searchParams.get("search") === "zzz";
        if (!isMiss && holdUnfilteredList) await deferred.promise;
        const data = isMiss ? [] : buildPeople(3);
        return HttpResponse.json({ data, page: 1, limit: 12, total: data.length });
      }),
    );
    const user = userEvent.setup();

    const { queryClient } = await renderWithProviders(<AccessPage />);
    await screen.findByRole("cell", { name: "Pessoa 1" });
    await user.type(screen.getByRole("textbox", { name: "Buscar por nome ou RA" }), "zzz");
    await screen.findByRole("heading", { name: "Nada encontrado" }, { timeout: 2000 });

    queryClient.removeQueries({ queryKey: getListAccessQueryKey({ page: 1, limit: 12 }) });
    holdUnfilteredList = true;
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Carregando membros…");
    expect(screen.queryByText("Nenhum membro ainda")).not.toBeInTheDocument();

    deferred.resolve();
    expect(await screen.findByRole("cell", { name: "Pessoa 1" })).toBeInTheDocument();
  });

  const LIST_STATES: Array<[string, () => Promise<void>]> = [
    [
      "loading",
      async () => {
        server.use(
          http.get("*/access", async () => {
            await delay("infinite");
            return HttpResponse.json({ data: [], page: 1, limit: 12, total: 0 });
          }),
        );
        await renderWithProviders(<AccessPage />);
        await screen.findByRole("status");
      },
    ],
    [
      "error",
      async () => {
        server.use(listAccessHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
        await renderWithProviders(<AccessPage />);
        await screen.findByRole("alert");
      },
    ],
    [
      "empty",
      async () => {
        server.use(listAccessHandler({ data: [], total: 0 }));
        await renderWithProviders(<AccessPage />);
        await screen.findByRole("heading", { name: "Nenhum membro ainda" });
      },
    ],
    [
      "noResults",
      async () => {
        server.use(accessHandlerWhere((params) => params.has("enabled")));
        const user = userEvent.setup();
        await renderWithProviders(<AccessPage />);
        await screen.findByRole("cell", { name: "Pessoa 1" });
        await user.click(screen.getByRole("button", { name: /Status: todos/ }));
        await user.click(await screen.findByRole("option", { name: "Inativo" }));
        await screen.findByRole("heading", { name: "Nada encontrado" });
      },
    ],
  ];

  it.each(LIST_STATES)(
    "the %s state shows neither the summary nor the pagination",
    async (_state, arrange) => {
      await arrange();

      expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: "Paginação da lista de membros" }),
      ).not.toBeInTheDocument();
    },
  );

  it("Papel filter sends role and returns to page 1", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listAccessHandler({ data: buildPeople(12), total: 30, onCall }));
    const user = userEvent.setup();

    await renderWithProviders(<AccessPage />);
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

    await renderWithProviders(<AccessPage />);
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

    await renderWithProviders(<AccessPage />);
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

    await renderWithProviders(<AccessPage />);
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

    await renderWithProviders(<AccessPage />);
    await screen.findByRole("cell", { name: "Pessoa 1" });
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(lastParams(onCall)?.get("page")).toBe("2"));

    await user.click(screen.getByRole("button", { name: "Página anterior" }));
    await waitFor(() => expect(lastParams(onCall)?.get("page")).toBe("1"));
  });

  it("keeps the rows of the current page, marked as busy, while the next one loads", async () => {
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

    await renderWithProviders(<AccessPage />);
    await screen.findByRole("cell", { name: "Pessoa da página 1" });
    expect(screen.getByTestId("access-list")).not.toHaveAttribute("aria-busy");

    await user.click(screen.getByRole("button", { name: "Página 2" }));

    expect(screen.getByRole("cell", { name: "Pessoa da página 1" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("access-list")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Carregando membros…")).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();

    deferred.resolve();
    expect(await screen.findByRole("cell", { name: "Pessoa da página 2" })).toBeInTheDocument();
    expect(screen.getByTestId("access-list")).not.toHaveAttribute("aria-busy");
    expect(screen.getByText("Mostrando 1 de 30 membros")).toBeInTheDocument();
  });

  it("hides pagination when everything fits in one page", async () => {
    server.use(listAccessHandler({ data: buildPeople(5), total: 5 }));

    await renderWithProviders(<AccessPage />);

    expect(await screen.findByText("Mostrando 5 de 5 membros")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Paginação da lista de membros" }),
    ).not.toBeInTheDocument();
  });
});
