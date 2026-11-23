import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MemberRegistrationStatus, type InviteListItemDto } from "@api/generated/model";
import { getListMembersQueryKey } from "@api/generated/people/people";
import { Role } from "@shared/lib/role";
import { toast } from "@shared/ui";

import { AuthProvider } from "../AuthProvider";
import { AccessPage } from "../pages/AccessPage";
import { authProtectedRoutes } from "../routes";
import {
  buildInviteListItem,
  buildMember,
  buildMeUser,
  createInviteHandler,
  listInvitesHandler,
  listMembersHandler,
  meHandler,
} from "./handlers";
import { PERMISSIONS_BY_ROLE } from "./fixtures/permissions";
import {
  buildMemberRegistration,
  getMemberRegistrationHandler,
  listDepartmentsHandler,
  REGISTRATION_ID,
  rejectMemberRegistrationHandler,
  REVIEW_DEPARTMENTS,
} from "./member-registration-handlers";
import { renderRoutes, renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

beforeEach(() => {
  server.use(listInvitesHandler());
});

afterEach(() => {
  toast.clear();
});

type OnCall = ReturnType<typeof vi.fn<(params: URLSearchParams) => void>>;

function lastParams(onCall: OnCall): URLSearchParams | undefined {
  return onCall.mock.calls.at(-1)?.[0];
}

/** The page reads `invites.manage` from /auth/me, so it needs the AuthProvider and a session. */
function renderAccessPage(user = buildMeUser({ role: Role.coordinator }), route = "/") {
  server.use(meHandler({ user }));
  return renderWithProviders(
    <AuthProvider>
      <AccessPage />
    </AuthProvider>,
    { route },
  );
}

function buildPeople(count: number) {
  return Array.from({ length: count }, (_, index) =>
    buildMember({ id: `person-${index + 1}`, name: `Pessoa ${index + 1}` }),
  );
}

/** Answers with no rows when `isMiss` recognises the filters of the request; else gives 3 people. */
function membersHandlerWhere(isMiss: (params: URLSearchParams) => boolean, onCall?: OnCall) {
  return http.get("*/members", ({ request }) => {
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

const searchBox = () => screen.getByRole("textbox", { name: "Buscar por nome ou RA" });

describe("route /members", () => {
  it("coordinator sees the members card", async () => {
    server.use(
      meHandler({ user: buildMeUser({ role: Role.coordinator }) }),
      listMembersHandler({ data: [], total: 0 }),
    );

    await renderRoutes(authProtectedRoutes, { route: "/members" });

    expect(await screen.findByRole("heading", { name: "Membros (0)" })).toBeInTheDocument();
  });

  it("the /members route declares its route title", () => {
    expect(authProtectedRoutes[0]?.handle).toEqual({ title: "common:nav.members" });
  });

  it("director sees the list without invite actions nor Validar", async () => {
    const onInvitesCall = vi.fn();
    server.use(
      meHandler({ user: buildMeUser({ role: Role.director }) }),
      listMembersHandler({
        data: [
          buildMember({ id: "person-1", name: "Ana Torres" }),
          buildMember({
            id: "person-2",
            name: "Lucas Souza",
            role: null,
            accessEnabled: false,
            mainFunction: null,
            registrationStatus: MemberRegistrationStatus.pending,
          }),
        ],
      }),
      listInvitesHandler({ onCall: onInvitesCall }),
    );

    await renderRoutes(authProtectedRoutes, { route: "/members" });

    expect(await screen.findByRole("cell", { name: "Ana Torres" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Membros (2)" })).toBeInTheDocument();
    // Within the row: the hidden <select> of the Status filter also has an option "A validar".
    expect(
      within(screen.getByRole("row", { name: /Lucas Souza/ })).getByText("A validar"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Gerar link de cadastro" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Convites pendentes/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Validar/ })).not.toBeInTheDocument();
    expect(onInvitesCall).not.toHaveBeenCalled();
  });

  it("member gets the forbidden page and neither GET /members nor GET /invites is requested", async () => {
    const onMembersCall = vi.fn();
    const onInvitesCall = vi.fn();
    server.use(
      meHandler({ user: buildMeUser({ role: Role.member }) }),
      listMembersHandler({ onCall: onMembersCall }),
      listInvitesHandler({ onCall: onInvitesCall }),
    );

    await renderRoutes(authProtectedRoutes, { route: "/members" });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(onMembersCall).not.toHaveBeenCalled();
    expect(onInvitesCall).not.toHaveBeenCalled();
  });

  it("a coordinator without members.list gets the forbidden page: the route asks for members.list", async () => {
    const onMembersCall = vi.fn();
    server.use(
      meHandler({
        user: buildMeUser({
          role: Role.coordinator,
          permissions: { ...PERMISSIONS_BY_ROLE.coordinator, "members.list": "none" },
        }),
      }),
      listMembersHandler({ onCall: onMembersCall }),
    );

    await renderRoutes(authProtectedRoutes, { route: "/members" });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(onMembersCall).not.toHaveBeenCalled();
  });
});

describe("AccessPage", () => {
  it("hides Gerar link de cadastro without invites.manage", async () => {
    server.use(listMembersHandler({ data: buildPeople(1), total: 1 }));

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

  it("does not request pending invites nor offer the invite action without invites.manage", async () => {
    const invitesCall = vi.fn();
    server.use(
      listMembersHandler({ data: [], total: 0 }),
      listInvitesHandler({ onCall: invitesCall }),
    );

    await renderAccessPage(
      buildMeUser({
        permissions: { ...PERMISSIONS_BY_ROLE.coordinator, "invites.manage": "none" },
      }),
    );

    expect(await screen.findByRole("heading", { name: "Nenhum membro ainda" })).toBeInTheDocument();
    expect(
      screen.getByText("Os membros aparecem aqui assim que concluírem o cadastro."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Gere um link de cadastro/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Gerar link de cadastro" }),
    ).not.toBeInTheDocument();
    expect(invitesCall).not.toHaveBeenCalled();
  });

  it("requests GET /members with page 1 and limit 12 and no filter", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listMembersHandler({ data: buildPeople(3), total: 3, onCall }));

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    const params = onCall.mock.calls[0]?.[0];
    expect(params?.get("page")).toBe("1");
    expect(params?.get("limit")).toBe("12");
    for (const key of ["search", "role", "status", "registrationStatus", "enabled"]) {
      expect(params?.has(key), key).toBe(false);
    }
  });

  it("shows the department and the main function of each member", async () => {
    server.use(
      listMembersHandler({
        data: [
          buildMember({
            id: "person-1",
            name: "Ana Torres",
            department: { id: "d1", name: "Tecnologia" },
            mainFunction: "Monitora de informática",
          }),
        ],
      }),
    );

    await renderAccessPage();

    const row = await screen.findByRole("row", { name: /Ana Torres/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("Tecnologia");
    expect(cells[3]).toHaveTextContent("Monitora de informática");
  });

  it("shows the total in the card title and the summary", async () => {
    server.use(listMembersHandler({ data: buildPeople(12), total: 16 }));

    await renderAccessPage();

    expect(await screen.findByRole("heading", { name: "Membros (16)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Membros (16)" })).toBeInTheDocument();
    expect(screen.getByText("Mostrando 12 de 16 membros")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(13);
  });

  it("first load shows the loading status, the title without total and keeps the create button", async () => {
    server.use(
      http.get("*/members", async () => {
        await delay("infinite");
        return HttpResponse.json({ data: [], page: 1, limit: 12, total: 0 });
      }),
    );

    await renderAccessPage();

    expect(screen.getByRole("status")).toHaveTextContent("Carregando membros…");
    expect(screen.getByRole("heading", { name: "Membros" })).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Gerar link de cadastro" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it("shows error with retry", async () => {
    server.use(listMembersHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
    const user = userEvent.setup();

    await renderAccessPage();

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByRole("heading", { name: "Não foi possível carregar os membros" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar link de cadastro" })).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Tentar de novo" });

    server.use(listMembersHandler({ data: [buildMember({ name: "Ana Torres" })], total: 1 }));
    await user.click(retryButton);

    expect(await screen.findByRole("cell", { name: "Ana Torres" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the error panel and the retry button mounted while retrying", async () => {
    server.use(listMembersHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
    const user = userEvent.setup();

    await renderAccessPage();

    const retryButton = await screen.findByRole("button", { name: "Tentar de novo" });
    server.use(
      http.get("*/members", async () => {
        await delay("infinite");
        return HttpResponse.json({ data: [], page: 1, limit: 12, total: 0 });
      }),
    );
    await user.click(retryButton);

    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBe(retryButton);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("empty list shows the empty state, keeps the column headers and hides the footer", async () => {
    server.use(listMembersHandler({ data: [], total: 0 }));

    await renderAccessPage();

    expect(await screen.findByRole("heading", { name: "Nenhum membro ainda" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Paginação da lista de membros" }),
    ).not.toBeInTheDocument();
  });

  it("the empty state offers a second Gerar link de cadastro that opens the dialog", async () => {
    server.use(listMembersHandler({ data: [], total: 0 }));
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("heading", { name: "Nenhum membro ainda" });

    expect(screen.getAllByRole("button", { name: "Gerar link de cadastro" })).toHaveLength(2);
    expect(
      screen.getByText(
        "Gere um link de cadastro e envie para a pessoa. Ela aparece aqui assim que concluir o cadastro.",
      ),
    ).toBeInTheDocument();
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
      listMembersHandler({ data: buildPeople(3) }),
      listInvitesHandler({
        data: [buildInviteListItem({ id: "invite-1" }), buildInviteListItem({ id: "invite-2" })],
      }),
    );

    await renderAccessPage();

    const pending = await screen.findByRole("button", { name: "Convites pendentes (2)" });
    const create = screen.getByRole("button", { name: "Gerar link de cadastro" });
    expect(pending).toBeDisabled();
    expect(pending.parentElement).toBe(create.parentElement);
    expect(pending.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("generating an invite refreshes the pending invites count", async () => {
    const pendingInvites: InviteListItemDto[] = [];
    server.use(
      listMembersHandler({ data: buildPeople(3) }),
      listInvitesHandler({ data: pendingInvites }),
      createInviteHandler({ onCall: () => pendingInvites.push(buildInviteListItem()) }),
    );
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("button", { name: "Convites pendentes (0)" });

    await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
    await user.click(screen.getByRole("button", { name: "Gerar link" }));
    await user.click(await screen.findByRole("button", { name: "Concluir" }));

    expect(
      await screen.findByRole("button", { name: "Convites pendentes (1)" }),
    ).toBeInTheDocument();
  });

  it("a search without matches shows Nada encontrado and Limpar filtros brings the list back", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(membersHandlerWhere((params) => params.get("search") === "zzz", onCall));
    const user = userEvent.setup();

    const { router } = await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    const search = searchBox();
    await user.type(search, "zzz");
    expect(
      await screen.findByRole("heading", { name: "Nada encontrado" }, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe("?search=zzz");
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    const callsBeforeClearing = onCall.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

    // A deadline shorter than the debounce (400 ms) proves that clearing does not wait for it.
    expect(
      await screen.findByRole("cell", { name: "Pessoa 1" }, { timeout: 300 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nada encontrado" })).not.toBeInTheDocument();
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(router.state.location.search).toBe("");
    const laterSearches = onCall.mock.calls
      .slice(callsBeforeClearing)
      .map(([p]) => p.get("search"));
    expect(laterSearches).not.toContain("zzz");
  });

  it("a role filter without matches shows Nada encontrado, not the empty state", async () => {
    server.use(membersHandlerWhere((params) => params.has("role")));
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Diretor" }));

    expect(await screen.findByRole("heading", { name: "Nada encontrado" })).toBeInTheDocument();
    expect(screen.queryByText("Nenhum membro ainda")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeInTheDocument();
  });

  it("clearing the filters resets the role and status selects and the URL", async () => {
    server.use(
      membersHandlerWhere((params) => params.has("role") || params.has("registrationStatus")),
    );
    const user = userEvent.setup();

    const { router } = await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Diretor" }));
    await user.click(await screen.findByRole("button", { name: "Limpar filtros" }));

    expect(await screen.findByRole("cell", { name: "Pessoa 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Papel: todos/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Status: todos/ })).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
  });

  it("waiting for an uncached list after clearing shows the loading state, never the empty state", async () => {
    const deferred = createDeferred();
    let holdUnfilteredList = false;
    server.use(
      http.get("*/members", async ({ request }) => {
        const isMiss = new URL(request.url).searchParams.get("search") === "zzz";
        if (!isMiss && holdUnfilteredList) await deferred.promise;
        const data = isMiss ? [] : buildPeople(3);
        return HttpResponse.json({ data, page: 1, limit: 12, total: data.length });
      }),
    );
    const user = userEvent.setup();

    const { queryClient } = await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });
    await user.type(searchBox(), "zzz");
    await screen.findByRole("heading", { name: "Nada encontrado" }, { timeout: 2000 });

    queryClient.removeQueries({ queryKey: getListMembersQueryKey({ page: 1, limit: 12 }) });
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
          http.get("*/members", async () => {
            await delay("infinite");
            return HttpResponse.json({ data: [], page: 1, limit: 12, total: 0 });
          }),
        );
        await renderAccessPage();
        await screen.findByRole("status");
      },
    ],
    [
      "error",
      async () => {
        server.use(listMembersHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
        await renderAccessPage();
        await screen.findByRole("alert");
      },
    ],
    [
      "empty",
      async () => {
        server.use(listMembersHandler({ data: [], total: 0 }));
        await renderAccessPage();
        await screen.findByRole("heading", { name: "Nenhum membro ainda" });
      },
    ],
    [
      "noResults",
      async () => {
        server.use(membersHandlerWhere((params) => params.has("status")));
        const user = userEvent.setup();
        await renderAccessPage();
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

  it("Papel filter sends role, returns to page 1 and goes to the URL", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listMembersHandler({ data: buildPeople(12), total: 30, onCall }));
    const user = userEvent.setup();

    const { router } = await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: "Página 3" }));
    await waitFor(() => expect(lastParams(onCall)?.get("page")).toBe("3"));

    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Diretor" }));

    await waitFor(() => {
      expect(lastParams(onCall)?.get("role")).toBe("director");
      expect(lastParams(onCall)?.get("page")).toBe("1");
    });
    expect(router.state.location.search).toBe("?role=director");
  });

  it("Status filter sends status=inactive for Inativo and drops it for Todos", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listMembersHandler({ data: buildPeople(3), total: 3, onCall }));
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Inativo" }));
    await waitFor(() => expect(lastParams(onCall)?.get("status")).toBe("inactive"));
    expect(lastParams(onCall)?.has("enabled")).toBe(false);
    expect(lastParams(onCall)?.has("registrationStatus")).toBe(false);

    await user.click(screen.getByRole("button", { name: /Status: Inativo/ }));
    await user.click(await screen.findByRole("option", { name: "Todos" }));
    await waitFor(() => expect(lastParams(onCall)?.has("status")).toBe(false));
  });

  it("Status filter sends status=active with enabled=true for Ativo", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listMembersHandler({ data: buildPeople(3), total: 3, onCall }));
    const user = userEvent.setup();

    await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Ativo" }));

    await waitFor(() => {
      expect(lastParams(onCall)?.get("status")).toBe("active");
      expect(lastParams(onCall)?.get("enabled")).toBe("true");
    });
    expect(lastParams(onCall)?.has("registrationStatus")).toBe(false);
  });

  it("Status filter sends registrationStatus=pending for A validar", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listMembersHandler({ data: buildPeople(3), total: 3, onCall }));
    const user = userEvent.setup();

    const { router } = await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "A validar" }));

    await waitFor(() => expect(lastParams(onCall)?.get("registrationStatus")).toBe("pending"));
    expect(lastParams(onCall)?.has("status")).toBe(false);
    expect(lastParams(onCall)?.has("enabled")).toBe(false);
    expect(router.state.location.search).toBe("?status=pending");
  });

  it("search is sent after typing, returns to page 1 and replaces the entry of the URL", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listMembersHandler({ data: buildPeople(12), total: 30, onCall }));
    const user = userEvent.setup();

    const { router } = await renderAccessPage();
    await screen.findByRole("cell", { name: "Pessoa 1" });

    await user.click(screen.getByRole("button", { name: "Página 2" }));
    await waitFor(() => expect(lastParams(onCall)?.get("page")).toBe("2"));

    await user.type(searchBox(), "Ana");

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
    expect(router.state.location.search).toBe("?search=Ana");
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("numbered pagination requests the pressed page, marks it as current and goes to the URL", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listMembersHandler({ data: buildPeople(12), total: 30, onCall }));
    const user = userEvent.setup();

    const { router } = await renderAccessPage();
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
    expect(router.state.location.search).toBe("?page=3");
  });

  it("next and previous buttons move one page", async () => {
    const onCall = vi.fn<(params: URLSearchParams) => void>();
    server.use(listMembersHandler({ data: buildPeople(12), total: 30, onCall }));
    const user = userEvent.setup();

    await renderAccessPage();
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
      http.get("*/members", async ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        if (page === 2) await deferred.promise;
        return HttpResponse.json({
          data: [buildMember({ id: `page-${page}`, name: `Pessoa da página ${page}` })],
          page,
          limit: 12,
          total: 30,
        });
      }),
    );
    const user = userEvent.setup();

    await renderAccessPage();
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
    server.use(listMembersHandler({ data: buildPeople(5), total: 5 }));

    await renderAccessPage();

    expect(await screen.findByText("Mostrando 5 de 5 membros")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Paginação da lista de membros" }),
    ).not.toBeInTheDocument();
  });

  describe("filters in the URL", () => {
    it("reads the search, the filters and the page from the URL", async () => {
      const onCall = vi.fn<(params: URLSearchParams) => void>();
      server.use(listMembersHandler({ data: buildPeople(12), total: 30, onCall }));

      await renderAccessPage(
        buildMeUser({ role: Role.coordinator }),
        "/?search=Ana&role=director&status=pending&page=2",
      );
      await screen.findByRole("cell", { name: "Pessoa 1" });

      const params = onCall.mock.calls[0]?.[0];
      expect(params?.get("search")).toBe("Ana");
      expect(params?.get("role")).toBe("director");
      expect(params?.get("registrationStatus")).toBe("pending");
      expect(params?.get("page")).toBe("2");
      expect(searchBox()).toHaveValue("Ana");
      expect(screen.getByRole("button", { name: /Papel: Diretor/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Status: A validar/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Página 2" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("reads an unknown role, status or page as no filter", async () => {
      const onCall = vi.fn<(params: URLSearchParams) => void>();
      server.use(listMembersHandler({ data: buildPeople(3), total: 3, onCall }));

      await renderAccessPage(
        buildMeUser({ role: Role.coordinator }),
        "/?role=superadmin&status=rejected&page=0",
      );
      await screen.findByRole("cell", { name: "Pessoa 1" });

      const params = onCall.mock.calls[0]?.[0];
      expect(params?.has("role")).toBe(false);
      expect(params?.has("status")).toBe(false);
      expect(params?.has("registrationStatus")).toBe(false);
      expect(params?.get("page")).toBe("1");
      expect(screen.getByRole("button", { name: /Papel: todos/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Status: todos/ })).toBeInTheDocument();
    });

    it("does not write to the URL when it is opened with the search already in it", async () => {
      server.use(listMembersHandler({ data: buildPeople(3), total: 3 }));

      const { router } = await renderAccessPage(
        buildMeUser({ role: Role.coordinator }),
        "/?search=Ana",
      );
      await screen.findByRole("cell", { name: "Pessoa 1" });
      // Longer than the debounce: a write would have happened by now.
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(router.state.location.search).toBe("?search=Ana");
      expect(router.state.historyAction).toBe("POP");
    });

    it("the box follows the URL when it changes without the box (Back, a link of the menu)", async () => {
      const onCall = vi.fn<(params: URLSearchParams) => void>();
      server.use(listMembersHandler({ data: buildPeople(3), total: 3, onCall }));

      const { router } = await renderAccessPage(
        buildMeUser({ role: Role.coordinator }),
        "/?search=Ana",
      );
      await screen.findByRole("cell", { name: "Pessoa 1" });
      expect(searchBox()).toHaveValue("Ana");

      await act(() => router.navigate("/"));

      await waitFor(() => expect(searchBox()).toHaveValue(""));
      await waitFor(() => expect(lastParams(onCall)?.has("search")).toBe(false));
      expect(router.state.location.search).toBe("");
    });
  });

  describe("Validar", () => {
    const TECHNOLOGY = REVIEW_DEPARTMENTS[1];
    const OTHER_REGISTRATION_ID = "01952ef7-0000-7000-8000-0000000000c2";

    /** The registration of Lucas as the list shows it right after he accepted the invite. */
    const LUCAS = buildMember({
      id: REGISTRATION_ID,
      name: "Lucas Andrade Souza",
      ra: "202600117",
      role: null,
      accessEnabled: false,
      department: TECHNOLOGY,
      mainFunction: null,
      joinedAt: null,
      registrationStatus: MemberRegistrationStatus.pending,
    });
    const MARTA = buildMember({
      id: OTHER_REGISTRATION_ID,
      name: "Marta Reis Campos",
      role: null,
      accessEnabled: false,
      mainFunction: null,
      joinedAt: null,
      registrationStatus: MemberRegistrationStatus.pending,
    });
    const TITLE = "Validar cadastro de membro";
    const validateButton = (name: string) => `Validar cadastro de ${name}`;

    /**
     * Through the route, which waits for the session: the permissions are known when the page first
     * renders, so a button that must be missing is not missing only because /auth/me is on its way.
     */
    function renderMembersRoute(
      user = buildMeUser({ role: Role.coordinator }),
      route = "/members",
    ) {
      server.use(meHandler({ user }));
      return renderRoutes(authProtectedRoutes, { route });
    }

    it("a freshly accepted registration is listed as A validar and Validar opens the validation dialog", async () => {
      const onRegistrationCall = vi.fn();
      server.use(
        listMembersHandler({ data: [buildMember({ id: "person-1", name: "Ana Torres" }), LUCAS] }),
        getMemberRegistrationHandler({ onCall: onRegistrationCall }),
        listDepartmentsHandler(),
      );
      const user = userEvent.setup();

      await renderMembersRoute();

      const row = await screen.findByRole("row", { name: /Lucas Andrade Souza/ });
      const cells = within(row).getAllByRole("cell");
      expect(within(row).getByText("A validar")).toBeInTheDocument();
      expect(cells[2]).toHaveTextContent("Tecnologia");
      expect(
        within(screen.getByRole("row", { name: /Ana Torres/ })).queryByRole("button", {
          name: /^Validar/,
        }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(
        await within(row).findByRole("button", { name: validateButton("Lucas Andrade Souza") }),
      );

      expect(await screen.findByRole("dialog", { name: TITLE })).toBeInTheDocument();
      await waitFor(() => expect(onRegistrationCall).toHaveBeenCalledWith(REGISTRATION_ID));
    });

    it("opens the registration of the row that was pressed", async () => {
      const onRegistrationCall = vi.fn();
      server.use(
        listMembersHandler({ data: [LUCAS, MARTA] }),
        getMemberRegistrationHandler({
          registration: buildMemberRegistration({
            id: OTHER_REGISTRATION_ID,
            name: "Marta Reis Campos",
          }),
          onCall: onRegistrationCall,
        }),
        listDepartmentsHandler(),
      );
      const user = userEvent.setup();

      await renderMembersRoute();
      await user.click(
        await screen.findByRole("button", { name: validateButton("Marta Reis Campos") }),
      );

      expect(await screen.findByRole("dialog", { name: TITLE })).toBeInTheDocument();
      await waitFor(() => expect(onRegistrationCall).toHaveBeenCalledWith(OTHER_REGISTRATION_ID));
      expect(onRegistrationCall).not.toHaveBeenCalledWith(REGISTRATION_ID);
    });

    it("closing the dialog leaves the list and the URL where they were", async () => {
      server.use(
        listMembersHandler({ data: [LUCAS] }),
        getMemberRegistrationHandler(),
        listDepartmentsHandler(),
      );
      const user = userEvent.setup();

      const { router } = await renderMembersRoute(undefined, "/members?status=pending");
      await user.click(
        await screen.findByRole("button", { name: validateButton("Lucas Andrade Souza") }),
      );
      await screen.findByRole("dialog", { name: TITLE });

      await user.click(screen.getByRole("button", { name: "Voltar" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(
        screen.getByRole("button", { name: validateButton("Lucas Andrade Souza") }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/members");
      expect(router.state.location.search).toBe("?status=pending");
    });

    it("deciding in the dialog refreshes the list: the row says Recusado and stops offering Validar", async () => {
      const onListCall = vi.fn<(params: URLSearchParams) => void>();
      server.use(
        listMembersHandler({ data: [LUCAS], onCall: onListCall }),
        getMemberRegistrationHandler(),
        listDepartmentsHandler(),
      );
      const user = userEvent.setup();

      await renderMembersRoute();
      await user.click(
        await screen.findByRole("button", { name: validateButton("Lucas Andrade Souza") }),
      );
      await screen.findByRole("dialog", { name: TITLE });
      await screen.findByRole("textbox", { name: /Função principal/ });
      const callsBeforeDeciding = onListCall.mock.calls.length;

      server.use(
        listMembersHandler({
          data: [{ ...LUCAS, registrationStatus: MemberRegistrationStatus.rejected }],
          onCall: onListCall,
        }),
        rejectMemberRegistrationHandler(),
      );
      await user.type(
        screen.getByRole("textbox", { name: /Observação da validação/ }),
        "O RA não confere com o termo.",
      );
      await user.click(screen.getByRole("button", { name: "Recusar" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() =>
        expect(
          within(screen.getByRole("row", { name: /Lucas Andrade Souza/ })).getByText("Recusado"),
        ).toBeInTheDocument(),
      );
      expect(onListCall.mock.calls.length).toBeGreaterThan(callsBeforeDeciding);
      expect(
        screen.queryByRole("button", { name: validateButton("Lucas Andrade Souza") }),
      ).not.toBeInTheDocument();
    });

    it("a coordinator without invites.manage sees A validar but no Validar, and nothing is requested", async () => {
      const onRegistrationCall = vi.fn();
      server.use(
        listMembersHandler({ data: [LUCAS] }),
        getMemberRegistrationHandler({ onCall: onRegistrationCall }),
        listDepartmentsHandler(),
      );

      await renderMembersRoute(
        buildMeUser({
          permissions: { ...PERMISSIONS_BY_ROLE.coordinator, "invites.manage": "none" },
        }),
      );

      const row = await screen.findByRole("row", { name: /Lucas Andrade Souza/ });
      expect(within(row).getByText("A validar")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Validar/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onRegistrationCall).not.toHaveBeenCalled();
    });

    it("A validar in the Status filter lists the pending registrations, each with Validar", async () => {
      const onCall = vi.fn<(params: URLSearchParams) => void>();
      server.use(
        http.get("*/members", ({ request }) => {
          const params = new URL(request.url).searchParams;
          onCall(params);
          const data = params.get("registrationStatus") === "pending" ? [LUCAS, MARTA] : [];
          return HttpResponse.json({ data, page: 1, limit: 12, total: data.length });
        }),
      );

      await renderMembersRoute(undefined, "/members?status=pending");

      expect(await screen.findAllByRole("button", { name: /^Validar cadastro de/ })).toHaveLength(
        2,
      );
      expect(onCall.mock.calls[0]?.[0].get("registrationStatus")).toBe("pending");
    });
  });
});
