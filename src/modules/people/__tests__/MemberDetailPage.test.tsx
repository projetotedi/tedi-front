import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  MemberRegistrationStatus,
  MemberStatus,
  type MemberDetailResponseDto,
} from "@api/generated/model";
import { getGetMemberQueryKey } from "@api/generated/people/people";
import { buildMeUser, meHandler } from "@modules/auth/__tests__/handlers";
import { renderRoutes, server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import { Role } from "@shared/lib/role";

// Registers the "people" namespace.
import "../index";
import { peopleRoutes } from "../routes";
import {
  buildMemberDetail,
  buildSeedMemberDetail,
  FORBIDDEN_SCOPE_ERROR,
  getMemberHandler,
  MEMBER_ID,
  MEMBER_NAME,
  MEMBER_NOT_FOUND_ERROR,
} from "./handlers";

setupAuthTestServer();

const MEMBER_ROUTE = `/members/${MEMBER_ID}`;
const DATA_TITLE = "Dados do membro";
const RECORD_TITLE = "Registro e permissões";

interface RenderOptions {
  member?: MemberDetailResponseDto;
  role?: Role;
  onGet?: (call: { id: string }) => void;
}

/** Renders the route of the member and waits for the header, whose `<h2>` is the name. */
async function renderPage({
  member = buildMemberDetail(),
  role = Role.coordinator,
  onGet,
}: RenderOptions = {}) {
  server.use(
    meHandler({ user: buildMeUser({ role }) }),
    getMemberHandler({ member, onCall: onGet }),
  );
  const view = await renderRoutes(peopleRoutes, { route: MEMBER_ROUTE });
  await screen.findByRole("heading", { level: 2, name: member.name });
  return view;
}

/** The card (the root with `data-slot="card"`) whose `<h2>` is `name`. */
function card(name: string): HTMLElement {
  const root = screen.getByRole("heading", { name }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error(`No card titled "${name}"`);
  return root;
}

/** The value (`<dd>`) of the field `label` (`<dt>`) inside `scope`. */
function valueOf(scope: HTMLElement, label: string): HTMLElement {
  const value = within(scope).getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

/** The labels (`<dt>`) of `scope`, in the order they are read. */
const labels = (scope: HTMLElement) =>
  within(scope)
    .getAllByText(/.+/, { selector: "dt" })
    .map((term) => term.textContent);

/** Each label of `scope` with the text of its value, in the order they are read. */
const fields = (scope: HTMLElement) =>
  within(scope)
    .getAllByText(/.+/, { selector: "dt" })
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

const tags = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("listitem")
    .map((tag) => tag.textContent);

const header = (name = MEMBER_NAME) => card(name);
const data = () => card(DATA_TITLE);
const record = () => card(RECORD_TITLE);

function expectNoValue(value: HTMLElement, label: string) {
  const empty = within(value);
  expect(empty.getByText("—"), label).toHaveAttribute("aria-hidden", "true");
  expect(empty.getByText("Não informado"), label).toHaveClass("sr-only");
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Lists the requests the page makes, without the one of the session. */
function trackRequests() {
  const requests: string[] = [];
  server.events.on("request:start", ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  return {
    withoutSession: () => requests.filter((request) => !request.endsWith("/auth/me")),
    stop: () => server.events.removeAllListeners("request:start"),
  };
}

describe("MemberDetailPage", () => {
  describe("loading the member", () => {
    it("shows a loading state while the member is on its way", async () => {
      const deferred = createDeferred();
      server.use(meHandler(), getMemberHandler({ delay: deferred.promise }));
      await renderRoutes(peopleRoutes, { route: MEMBER_ROUTE });

      // The session loads first ("Carregando sua sessão..."), then the member.
      expect(await screen.findByText("Carregando o membro…")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Carregando o membro…");
      expect(screen.queryByRole("heading", { name: MEMBER_NAME })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: DATA_TITLE })).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByRole("heading", { name: MEMBER_NAME })).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByText("Carregando o membro…")).not.toBeInTheDocument();
    });

    it("asks GET /members/:id once, by the id of the route, and nothing else", async () => {
      const onGet = vi.fn();
      const requests = trackRequests();

      try {
        await renderPage({ onGet });

        expect(onGet).toHaveBeenCalledExactlyOnceWith({ id: MEMBER_ID });
        // Not the allocations, the hours nor the attendance: those cards are "em breve".
        expect(requests.withoutSession()).toEqual([`GET /members/${MEMBER_ID}`]);
      } finally {
        requests.stop();
      }
    });
  });

  describe("the header", () => {
    it("shows the name and the tags: role, status, RA and department", async () => {
      await renderPage();

      expect(
        within(header()).getByRole("heading", { level: 2, name: MEMBER_NAME }),
      ).toBeInTheDocument();
      expect(tags(header())).toEqual(["Membro", "Ativa", "RA 202400003", "Tecnologia"]);
    });

    it("shows Inativa for an inactive member, in the tags and in the data", async () => {
      await renderPage({ member: buildMemberDetail({ status: MemberStatus.inactive }) });

      expect(tags(header())).toEqual(["Membro", "Inativa", "RA 202400003", "Tecnologia"]);
      expect(valueOf(data(), "Status")).toHaveTextContent(/^Inativa$/);
    });

    it("has no role tag while role is null, because the profile is only granted on approval", async () => {
      await renderPage({ member: buildMemberDetail({ role: null }) });

      expect(tags(header())).toEqual(["Ativa", "RA 202400003", "Tecnologia"]);
      expectNoValue(valueOf(data(), "Perfil de acesso"), "Perfil de acesso");
    });

    it("has a tag of RA and of department only when the registration has them", async () => {
      // The seeded coordinator has an RA, but no department: she has no member profile.
      const seed = buildSeedMemberDetail();
      const first = await renderPage({ member: seed });

      expect(tags(header(seed.name))).toEqual(["Coordenadora", "Ativa", "RA a0000001"]);
      first.unmount();

      await renderPage({ member: { ...seed, ra: null } });

      expect(tags(header(seed.name))).toEqual(["Coordenadora", "Ativa"]);
    });

    it.each([
      ["coordinator", Role.coordinator],
      ["director", Role.director],
    ])(
      "has no action button in the header, for the %s: they come with GUS-148, GUS-149, GUS-163 and E5",
      async (_label, role) => {
        await renderPage({ role });

        expect(screen.queryAllByRole("button")).toHaveLength(0);
        for (const name of ["Inativar", "Editar membro", "+ Lançar horas", "+ Nova alocação"]) {
          expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
          expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
        }
      },
    );

    it("has no tag of approved hours: the hours bank is not here yet", async () => {
      await renderPage();

      expect(screen.queryByText(/aprovadas/i)).not.toBeInTheDocument();
    });
  });

  describe("the breadcrumb", () => {
    it("shows the breadcrumb Membros › name, with a link to /members for who can list", async () => {
      await renderPage({ role: Role.coordinator });

      const trail = screen.getByRole("navigation", { name: "Trilha de navegação" });
      expect(within(trail).getAllByRole("listitem")).toHaveLength(2);
      expect(within(trail).getByRole("link", { name: "Membros" })).toHaveAttribute(
        "href",
        "/members",
      );
      expect(within(trail).getByText("›")).toHaveAttribute("aria-hidden", "true");
      const current = within(trail).getByText(MEMBER_NAME);
      expect(current).toHaveAttribute("aria-current", "page");
      expect(within(trail).getAllByRole("link")).toHaveLength(1);
    });

    it("keeps Membros as plain text for who cannot open the list", async () => {
      await renderPage({ role: Role.director });

      const trail = screen.getByRole("navigation", { name: "Trilha de navegação" });
      expect(within(trail).getByText("Membros")).toBeInTheDocument();
      expect(within(trail).queryByRole("link")).not.toBeInTheDocument();
      expect(within(trail).getByText(MEMBER_NAME)).toHaveAttribute("aria-current", "page");
    });
  });

  describe("Dados do membro", () => {
    it("shows the fields of Dados do membro, in the order of the Figma, formatted", async () => {
      await renderPage();

      expect(labels(data())).toEqual([
        "Nome completo",
        "Data de nascimento",
        "Telefone",
        "E-mail pessoal",
        "Endereço",
        "Cidade",
        "Estado (UF)",
        "RA",
        "Departamento",
        "Função principal",
        "Curso da faculdade",
        "Turma da faculdade",
        "Período",
        "E-mail institucional",
        "CPF",
        "Termo de voluntariado",
        "Perfil de acesso",
        "Status",
        "Entrada no projeto",
        "Saída",
      ]);
      expect(fields(data())).toEqual([
        ["Nome completo", "Beatriz Nunes Carvalho"],
        ["Data de nascimento", "14/09/2003"],
        ["Telefone", "(11) 99191-2020"],
        ["E-mail pessoal", "bia.nunes@email.com"],
        ["Endereço", "Rua Domingos de Morais, 45 — apto 32"],
        ["Cidade", "São Paulo"],
        ["Estado (UF)", "SP"],
        ["RA", "202400003"],
        ["Departamento", "Tecnologia"],
        ["Função principal", "Ministrar aulas e apoio pedagógico"],
        ["Curso da faculdade", "Sistemas de Informação"],
        ["Turma da faculdade", "SI-2024-N"],
        ["Período", "5º"],
        ["E-mail institucional", "beatriz.nunes@inst.edu.br"],
        ["CPF", "***.***.789-00"],
        ["Termo de voluntariado", "Abrir o termo (abre em nova aba)"],
        ["Perfil de acesso", "Membro"],
        ["Status", "Ativa"],
        ["Entrada no projeto", "01/03/2024"],
        // No exit date while the member is active: the dash, which is read as "Não informado".
        ["Saída", "—Não informado"],
      ]);
    });

    it("formats a landline phone number and shows the date of the exit of a member who left", async () => {
      await renderPage({
        member: buildMemberDetail({
          phone: "1133334444",
          status: MemberStatus.inactive,
          exitDate: "2025-12-15",
          exitReason: "Concluiu a graduação",
        }),
      });

      expect(valueOf(data(), "Telefone")).toHaveTextContent(/^\(11\) 3333-4444$/);
      expect(valueOf(data(), "Saída")).toHaveTextContent(/^15\/12\/2025$/);
      // The reason is not in the Figma nor in the card of the task.
      expect(screen.queryByText("Concluiu a graduação")).not.toBeInTheDocument();
    });

    it("shows a dash, read as Não informado, in every empty field, as for a person with no member profile", async () => {
      await renderPage({ member: buildSeedMemberDetail() });

      for (const label of [
        "Data de nascimento",
        "Telefone",
        "E-mail pessoal",
        "Endereço",
        "Cidade",
        "Estado (UF)",
        "Departamento",
        "Função principal",
        "Curso da faculdade",
        "Turma da faculdade",
        "Período",
        "E-mail institucional",
        "CPF",
        "Termo de voluntariado",
        "Entrada no projeto",
        "Saída",
      ]) {
        expectNoValue(valueOf(data(), label), label);
      }
      // What the seed does have is shown as it is.
      expect(valueOf(data(), "Nome completo")).toHaveTextContent(/^Marina Albuquerque$/);
      expect(valueOf(data(), "RA")).toHaveTextContent(/^a0000001$/);
      expect(valueOf(data(), "Perfil de acesso")).toHaveTextContent(/^Coordenadora$/);
      expect(valueOf(data(), "Status")).toHaveTextContent(/^Ativa$/);
    });

    it("shows the CPF only as the API masked it", async () => {
      await renderPage();

      expect(valueOf(data(), "CPF").textContent).toBe("***.***.789-00");
      // No whole CPF anywhere on the page, masked or not by the screen.
      expect(screen.queryByText(/\d{3}\.\d{3}\.\d{3}-\d{2}/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d{11}/)).not.toBeInTheDocument();
    });

    it("links the volunteer term only for an http(s) URL", async () => {
      const first = await renderPage();

      const link = screen.getByRole("link", { name: "Abrir o termo (abre em nova aba)" });
      expect(link).toHaveAttribute("href", "https://drive.google.com/file/d/termo-beatriz/view");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(valueOf(data(), "Termo de voluntariado")).toContainElement(link);
      first.unmount();

      await renderPage({ member: buildMemberDetail({ volunteerTermUrl: "javascript:alert(1)" }) });

      expect(screen.queryByRole("link", { name: /Abrir o termo/ })).not.toBeInTheDocument();
      expect(valueOf(data(), "Termo de voluntariado")).toHaveTextContent(/^javascript:alert\(1\)$/);
    });
  });

  describe("Registro e permissões", () => {
    it("shows who approved the registration and when, and nothing else", async () => {
      await renderPage();

      expect(labels(record())).toEqual(["Cadastro aprovado por"]);
      expect(valueOf(record(), "Cadastro aprovado por")).toHaveTextContent(
        /^Ana Paula Torres em 01\/03\/2024$/,
      );
      // The contract has no author of the registration and no one who changed the profile.
      expect(screen.queryByText(/Cadastrada por/)).not.toBeInTheDocument();
      expect(screen.queryByText(/alterado por/i)).not.toBeInTheDocument();
    });

    it("keeps only the date when the reviewer was deleted", async () => {
      await renderPage({ member: buildMemberDetail({ reviewedBy: null }) });

      expect(valueOf(record(), "Cadastro aprovado por")).toHaveTextContent(/^Em 01\/03\/2024$/);
    });

    it("shows a dash when nobody approved it, read as Não informado", async () => {
      await renderPage({ member: buildMemberDetail({ reviewedBy: null, reviewedAt: null }) });

      expectNoValue(valueOf(record(), "Cadastro aprovado por"), "Cadastro aprovado por");
    });

    // `reviewedBy` and `reviewedAt` are about the review, whatever came out of it: for a rejected
    // registration they say who rejected it. The fixture keeps both filled, and none of these
    // registrations was approved, so the value has to be the dash.
    it.each([
      ["a rejected registration", MemberRegistrationStatus.rejected],
      ["a pending registration", MemberRegistrationStatus.pending],
      ["a person with no member profile", null],
    ])("shows a dash, and not who reviewed it, for %s", async (_label, registrationStatus) => {
      await renderPage({ member: buildMemberDetail({ registrationStatus }) });

      expect(valueOf(record(), "Cadastro aprovado por")).toHaveTextContent(/^—Não informado$/);
      expect(within(record()).queryByText(/Ana Paula Torres/)).not.toBeInTheDocument();
      expect(within(record()).queryByText(/01\/03\/2024/)).not.toBeInTheDocument();
    });
  });

  describe("what is not here yet", () => {
    it.each([
      ["Alocações em aulas", "As alocações do membro em aulas vão aparecer aqui em breve."],
      ["Lançamentos de horas", "Os lançamentos de horas do membro vão aparecer aqui em breve."],
      ["Banco de horas", "O banco de horas do membro vai aparecer aqui em breve."],
      ["Presença", "A presença do membro nas aulas vai aparecer aqui em breve."],
    ])("says in the card %s that it is coming soon, with no data", async (title, message) => {
      await renderPage();

      const soon = card(title);
      expect(within(soon).getByText(message)).toBeInTheDocument();
      expect(within(soon).queryByRole("table")).not.toBeInTheDocument();
      expect(within(soon).queryByRole("link")).not.toBeInTheDocument();
      expect(within(soon).queryByRole("button")).not.toBeInTheDocument();
      expect(within(soon).queryByText(/\d/)).not.toBeInTheDocument();
    });

    it("shows Alocações em aulas, Lançamentos de horas, Banco de horas and Presença as coming soon, with no table", async () => {
      await renderPage();

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.getAllByText(/(vão|vai) aparecer aqui em breve/)).toHaveLength(4);
    });
  });

  describe("the scope of the member", () => {
    it("the director sees a member of his department", async () => {
      await renderPage({ role: Role.director });

      expect(tags(header())).toEqual(["Membro", "Ativa", "RA 202400003", "Tecnologia"]);
      expect(screen.getByRole("heading", { level: 2, name: DATA_TITLE })).toBeInTheDocument();
      expect(screen.queryByText(/Você não tem acesso/)).not.toBeInTheDocument();
    });

    it("the director gets the forbidden page for a member of another department", async () => {
      server.use(
        meHandler({ user: buildMeUser({ role: Role.director }) }),
        getMemberHandler({ error: FORBIDDEN_SCOPE_ERROR }),
      );
      await renderRoutes(peopleRoutes, { route: MEMBER_ROUTE });

      expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: MEMBER_NAME })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: DATA_TITLE })).not.toBeInTheDocument();
      // It is the page of no access, not the generic error of the page.
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    });

    it("gets the forbidden page too when the permission was taken away after the route opened", async () => {
      server.use(
        meHandler(),
        getMemberHandler({ error: { statusCode: 403, error: "FORBIDDEN", message: "Forbidden" } }),
      );
      await renderRoutes(peopleRoutes, { route: MEMBER_ROUTE });

      expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: DATA_TITLE })).not.toBeInTheDocument();
    });
  });

  describe("errors", () => {
    it("shows not found for MEMBER_NOT_FOUND, with a way back for who can list", async () => {
      server.use(meHandler(), getMemberHandler({ error: MEMBER_NOT_FOUND_ERROR }));
      await renderRoutes(peopleRoutes, { route: MEMBER_ROUTE });

      expect(
        await screen.findByRole("heading", { level: 2, name: "Membro não encontrado" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Este membro não existe ou foi removido.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Voltar para Membros" })).toHaveAttribute(
        "href",
        "/members",
      );
      expect(screen.queryByRole("heading", { name: DATA_TITLE })).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("offers no way back to who cannot open the list", async () => {
      server.use(
        meHandler({ user: buildMeUser({ role: Role.director }) }),
        getMemberHandler({ error: MEMBER_NOT_FOUND_ERROR }),
      );
      await renderRoutes(peopleRoutes, { route: MEMBER_ROUTE });

      expect(
        await screen.findByRole("heading", { level: 2, name: "Membro não encontrado" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("does not take a 404 that did not come from the API for a missing member", async () => {
      server.use(meHandler(), getMemberHandler({ error: { statusCode: 404, error: "Not Found" } }));
      await renderRoutes(peopleRoutes, { route: MEMBER_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o membro. Tente novamente.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Membro não encontrado" }),
      ).not.toBeInTheDocument();
    });

    it.each([
      ["a word", "abc"],
      ["me, the profile of who is signed in", "me"],
    ])(
      "shows not found at once for an id that is not a UUID, with no request: %s",
      async (_label, id) => {
        const onGet = vi.fn();
        const requests = trackRequests();
        server.use(meHandler(), getMemberHandler({ onCall: onGet }));

        try {
          await renderRoutes(peopleRoutes, { route: `/members/${id}` });

          expect(
            await screen.findByRole("heading", { name: "Membro não encontrado" }),
          ).toBeInTheDocument();
          expect(screen.queryByRole("status")).not.toBeInTheDocument();
          expect(onGet).not.toHaveBeenCalled();
          expect(requests.withoutSession()).toEqual([]);
        } finally {
          requests.stop();
        }
      },
    );

    it("shows an error with a retry that loads the member", async () => {
      const user = userEvent.setup();
      server.use(
        meHandler(),
        getMemberHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      await renderRoutes(peopleRoutes, { route: MEMBER_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o membro. Tente novamente.",
      );
      expect(screen.queryByRole("heading", { name: DATA_TITLE })).not.toBeInTheDocument();

      server.use(getMemberHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("heading", { name: MEMBER_NAME })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("the cache", () => {
    it("drops the cached member when the page unmounts", async () => {
      const { unmount, queryClient } = await renderPage();
      expect(queryClient.getQueryState(getGetMemberQueryKey(MEMBER_ID))).toBeDefined();

      unmount();

      await waitFor(() =>
        expect(queryClient.getQueryState(getGetMemberQueryKey(MEMBER_ID))).toBeUndefined(),
      );
    });
  });

  describe("accessibility of the page", () => {
    it("has no h1 of its own: the title is on the topbar", async () => {
      await renderPage();

      expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    });

    it("has one h2 per card, the header first, in the order of the Figma", async () => {
      await renderPage();

      expect(
        screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
      ).toEqual([
        MEMBER_NAME,
        DATA_TITLE,
        "Alocações em aulas",
        "Lançamentos de horas",
        "Banco de horas",
        "Presença",
        RECORD_TITLE,
      ]);
    });

    it("gives every label a value", async () => {
      await renderPage();

      for (const title of [DATA_TITLE, RECORD_TITLE]) {
        const terms = within(card(title)).getAllByText(/.+/, { selector: "dt" });
        for (const term of terms) {
          expect(term.nextElementSibling?.tagName, term.textContent ?? "").toBe("DD");
        }
      }
    });

    it("has no h1, no table and no heading of its own while it loads", async () => {
      const deferred = createDeferred();
      server.use(meHandler(), getMemberHandler({ delay: deferred.promise }));
      await renderRoutes(peopleRoutes, { route: MEMBER_ROUTE });

      expect(await screen.findByText("Carregando o membro…")).toBeInTheDocument();
      expect(screen.queryAllByRole("heading")).toHaveLength(0);
      expect(screen.queryByRole("table")).not.toBeInTheDocument();

      deferred.resolve();
      await screen.findByRole("heading", { name: MEMBER_NAME });
    });
  });
});
