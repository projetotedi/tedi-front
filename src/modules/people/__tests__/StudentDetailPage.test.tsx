import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccessibilityNeed, type StudentDetailDto } from "@api/generated/model";
import { getGetStudentQueryKey } from "@api/generated/people/people";
import { buildMeUser, meHandler } from "@modules/auth/__tests__/handlers";
import { renderRoutes, server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import { Role } from "@shared/lib/role";

// Registers the "people" namespace.
import "../index";
import {
  buildStudentDetail,
  getStudentHandler,
  STUDENT_CREATOR_NAME,
  STUDENT_ID,
  STUDENT_NAME,
  STUDENT_NOT_FOUND_ERROR,
} from "./handlers";
import { peopleRoutes } from "./test-routes";

setupAuthTestServer();

const STUDENT_ROUTE = `/students/${STUDENT_ID}`;
const ACCESSIBILITY_TITLE = "Necessidades de acessibilidade";
const ACCESSIBILITY_EMPTY = "Nenhuma necessidade de acessibilidade registrada.";

interface RenderOptions {
  student?: StudentDetailDto;
  role?: Role;
  onGet?: (call: { id: string }) => void;
}

/** Renders the route of the student and waits for the header, whose `<h2>` is the name. */
async function renderPage({
  student = buildStudentDetail(),
  role = Role.coordinator,
  onGet,
}: RenderOptions = {}) {
  server.use(
    meHandler({ user: buildMeUser({ role }) }),
    getStudentHandler({ student, onCall: onGet }),
  );
  const view = await renderRoutes(peopleRoutes, { route: STUDENT_ROUTE });
  await screen.findByRole("heading", { level: 2, name: student.name });
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

const tags = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("listitem")
    .map((tag) => tag.textContent);

const header = () => card(STUDENT_NAME);
const accessibilityTable = () => screen.getByRole("table", { name: ACCESSIBILITY_TITLE });
const cellsOf = (row: HTMLElement) => within(row).getAllByRole("cell");

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

describe("StudentDetailPage", () => {
  describe("loading the student", () => {
    it("shows a loading state while the student is on its way", async () => {
      const deferred = createDeferred();
      server.use(meHandler(), getStudentHandler({ delay: deferred.promise }));
      await renderRoutes(peopleRoutes, { route: STUDENT_ROUTE });

      // The session loads first ("Carregando sua sessão..."), then the student.
      expect(await screen.findByText("Carregando o aluno…")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Carregando o aluno…");
      expect(screen.queryByRole("heading", { name: STUDENT_NAME })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Dados pessoais" })).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByRole("heading", { name: STUDENT_NAME })).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByText("Carregando o aluno…")).not.toBeInTheDocument();
    });

    it("asks GET /students/:id once, by the id of the route, and nothing else", async () => {
      const onGet = vi.fn();
      const requests = trackRequests();

      try {
        await renderPage({ onGet });

        expect(onGet).toHaveBeenCalledExactlyOnceWith({ id: STUDENT_ID });
        expect(requests.withoutSession()).toEqual([`GET /students/${STUDENT_ID}`]);
      } finally {
        requests.stop();
      }
    });

    it("shows the name and the tags: status, age and accessibility", async () => {
      await renderPage();

      expect(
        within(header()).getByRole("heading", { level: 2, name: STUDENT_NAME }),
      ).toBeInTheDocument();
      expect(tags(header())).toEqual(["Ativa", "67 anos", "Acessibilidade: visual"]);
    });

    it("has no tag of active classes: the enrollments are not in the contract yet", async () => {
      await renderPage();

      expect(tags(header()).join(" ")).not.toMatch(/turma/i);
      expect(screen.queryByText(/turmas ativas/i)).not.toBeInTheDocument();
    });

    it.each([
      [AccessibilityNeed.hearing, "Acessibilidade: auditiva"],
      [AccessibilityNeed.motor, "Acessibilidade: motora"],
      [AccessibilityNeed.cognitive, "Acessibilidade: cognitiva"],
      [AccessibilityNeed.other, "Acessibilidade: outra"],
    ])("names the category %s in the tag, in lower case", async (accessibilityNeed, tag) => {
      await renderPage({ student: buildStudentDetail({ accessibilityNeed }) });

      expect(tags(header())).toContain(tag);
    });

    it("has no tag of accessibility when the category is none", async () => {
      await renderPage({
        student: buildStudentDetail({
          accessibilityNeed: AccessibilityNeed.none,
          classNeeds: null,
          supportResource: null,
        }),
      });

      expect(tags(header())).toEqual(["Ativa", "67 anos"]);
    });

    it("counts a single year in the singular", async () => {
      await renderPage({ student: buildStudentDetail({ age: 1 }) });

      expect(tags(header())).toContain("1 ano");
    });
  });

  describe("Dados pessoais", () => {
    it("shows the twelve fields of the Figma, in its order, formatted", async () => {
      await renderPage();

      const personal = card("Dados pessoais");

      expect(labels(personal)).toEqual([
        "Nome completo",
        "Data de nascimento",
        "Idade",
        "Telefone",
        "E-mail",
        "Escolaridade",
        "Tem smartphone",
        "Tem computador",
        "Como conheceu o TEDI",
        "Contato de emergência",
        "Telefone de emergência",
        "Cadastrada por",
      ]);
      expect(valueOf(personal, "Nome completo")).toHaveTextContent(/^Maria da Silva Santos$/);
      expect(valueOf(personal, "Data de nascimento")).toHaveTextContent(/^14\/03\/1959$/);
      expect(valueOf(personal, "Idade")).toHaveTextContent(/^67 anos$/);
      expect(valueOf(personal, "Telefone")).toHaveTextContent(/^\(11\) 98765-4321$/);
      expect(valueOf(personal, "E-mail")).toHaveTextContent(/^maria\.santos@example\.com$/);
      expect(valueOf(personal, "Escolaridade")).toHaveTextContent(/^Ensino médio completo$/);
      expect(valueOf(personal, "Tem smartphone")).toHaveTextContent(/^Sim$/);
      expect(valueOf(personal, "Tem computador")).toHaveTextContent(/^Não$/);
      expect(valueOf(personal, "Como conheceu o TEDI")).toHaveTextContent(
        /^Indicação de uma amiga$/,
      );
      expect(valueOf(personal, "Contato de emergência")).toHaveTextContent(/^João Santos$/);
      expect(valueOf(personal, "Telefone de emergência")).toHaveTextContent(/^\(11\) 91234-5678$/);
      expect(valueOf(personal, "Cadastrada por")).toHaveTextContent(
        /^Beatriz Nunes — 18\/02\/2026$/,
      );
    });

    it("shows the age the API sent, and does not work it out from the birth date", async () => {
      await renderPage({ student: buildStudentDetail({ birthDate: "2020-01-01", age: 67 }) });

      expect(valueOf(card("Dados pessoais"), "Idade")).toHaveTextContent(/^67 anos$/);
    });

    it("formats a landline phone number too", async () => {
      await renderPage({
        student: buildStudentDetail({
          phone: "1133334444",
          emergencyContact: { name: "João Santos", phone: "1155556666" },
        }),
      });

      const personal = card("Dados pessoais");
      expect(valueOf(personal, "Telefone")).toHaveTextContent(/^\(11\) 3333-4444$/);
      expect(valueOf(personal, "Telefone de emergência")).toHaveTextContent(/^\(11\) 5555-6666$/);
    });

    it("shows a dash, read as Não informado, in every field the registration left empty", async () => {
      await renderPage({
        student: buildStudentDetail({
          phone: null,
          email: null,
          education: null,
          hasSmartphone: null,
          hasComputer: null,
          howFoundUs: null,
          emergencyContact: { name: null, phone: null },
        }),
      });

      const personal = card("Dados pessoais");
      for (const label of [
        "Telefone",
        "E-mail",
        "Escolaridade",
        "Tem smartphone",
        "Tem computador",
        "Como conheceu o TEDI",
        "Contato de emergência",
        "Telefone de emergência",
      ]) {
        const value = within(valueOf(personal, label));
        expect(value.getByText("—"), label).toHaveAttribute("aria-hidden", "true");
        expect(value.getByText("Não informado"), label).toHaveClass("sr-only");
      }
      // What the registration does have is still there.
      expect(valueOf(personal, "Nome completo")).toHaveTextContent(/^Maria da Silva Santos$/);
      expect(valueOf(personal, "Data de nascimento")).toHaveTextContent(/^14\/03\/1959$/);
    });

    it("does not take an unknown yes/no for a Não", async () => {
      await renderPage({
        student: buildStudentDetail({ hasSmartphone: null, hasComputer: false }),
      });

      const personal = card("Dados pessoais");
      expect(valueOf(personal, "Tem smartphone")).not.toHaveTextContent(/^Não$/);
      expect(valueOf(personal, "Tem smartphone")).toHaveTextContent("Não informado");
      expect(valueOf(personal, "Tem computador")).toHaveTextContent(/^Não$/);
    });

    it("keeps only the date of the registration when the person who registered was deleted", async () => {
      await renderPage({ student: buildStudentDetail({ createdBy: null }) });

      expect(valueOf(card("Dados pessoais"), "Cadastrada por")).toHaveTextContent(
        /^Em 18\/02\/2026$/,
      );
    });
  });

  describe("Necessidades de acessibilidade", () => {
    it("is a table with the four columns of the Figma and one row", async () => {
      await renderPage();

      const table = accessibilityTable();
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((column) => column.textContent),
      ).toEqual(["Categoria", "O que a pessoa precisa", "Recurso de apoio", "Registrado por"]);

      const rows = within(table).getAllByRole("row");
      expect(rows).toHaveLength(2);
      expect(cellsOf(rows[1]).map((cell) => cell.textContent)).toEqual([
        "Visual",
        "Sentar perto da tela e material com letra grande",
        "Lupa e fonte ampliada",
        STUDENT_CREATOR_NAME,
      ]);
      expect(within(card(ACCESSIBILITY_TITLE)).queryByText(ACCESSIBILITY_EMPTY)).toBeNull();
    });

    it("says there is no record, under the headers, for a student with none", async () => {
      await renderPage({
        student: buildStudentDetail({
          accessibilityNeed: AccessibilityNeed.none,
          classNeeds: null,
          supportResource: null,
        }),
      });

      const table = accessibilityTable();
      expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
      expect(within(table).getAllByRole("row")).toHaveLength(2);
      expect(within(table).getByText(ACCESSIBILITY_EMPTY)).toBeInTheDocument();
      expect(within(table).queryByText("Nenhuma")).not.toBeInTheDocument();
    });

    it("keeps the row of a none category that has text written, with Nenhuma in the category", async () => {
      await renderPage({
        student: buildStudentDetail({
          accessibilityNeed: AccessibilityNeed.none,
          classNeeds: "Prefere ficar perto da porta",
          supportResource: null,
        }),
      });

      const table = accessibilityTable();
      const rows = within(table).getAllByRole("row");
      expect(rows).toHaveLength(2);
      expect(cellsOf(rows[1])[0]).toHaveTextContent(/^Nenhuma$/);
      expect(cellsOf(rows[1])[1]).toHaveTextContent("Prefere ficar perto da porta");
      expect(within(table).queryByText(ACCESSIBILITY_EMPTY)).not.toBeInTheDocument();
      // No category, so no tag of accessibility in the header.
      expect(tags(header())).toEqual(["Ativa", "67 anos"]);
    });

    it("shows a dash, read as Não informado, for what is not written and for a deleted author", async () => {
      await renderPage({
        student: buildStudentDetail({ classNeeds: null, supportResource: null, createdBy: null }),
      });

      const cells = cellsOf(within(accessibilityTable()).getAllByRole("row")[1]);
      expect(cells[0]).toHaveTextContent(/^Visual$/);
      for (const cell of cells.slice(1)) {
        expect(within(cell).getByText("—")).toHaveAttribute("aria-hidden", "true");
        expect(within(cell).getByText("Não informado")).toHaveClass("sr-only");
      }
    });
  });

  describe("Registro", () => {
    it("has only who registered the student and the date of the last change", async () => {
      await renderPage();

      const record = card("Registro");
      expect(labels(record)).toEqual(["Cadastrada por", "Última atualização"]);
      expect(valueOf(record, "Cadastrada por")).toHaveTextContent(/^Beatriz Nunes$/);
      expect(valueOf(record, "Última atualização")).toHaveTextContent(/^20\/10\/2026$/);
    });

    it("shows a dash, read as Não informado, when the person who registered was deleted", async () => {
      await renderPage({ student: buildStudentDetail({ createdBy: null }) });

      const value = within(valueOf(card("Registro"), "Cadastrada por"));
      expect(value.getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(value.getByText("Não informado")).toHaveClass("sr-only");
      expect(valueOf(card("Registro"), "Última atualização")).toHaveTextContent(/^20\/10\/2026$/);
    });
  });

  describe("what is not in the contract yet", () => {
    it.each([
      ["Matrículas", "As matrículas do aluno vão aparecer aqui em breve."],
      ["Resumo", "O resumo do aluno vai aparecer aqui em breve."],
      ["Histórico de cursos", "O histórico de cursos do aluno vai aparecer aqui em breve."],
    ])("says in the card %s that it is coming soon, with no data", async (title, message) => {
      await renderPage();

      const unavailable = card(title);
      expect(within(unavailable).getByText(message)).toBeInTheDocument();
      expect(within(unavailable).queryByRole("table")).not.toBeInTheDocument();
      expect(within(unavailable).queryByRole("link")).not.toBeInTheDocument();
      expect(within(unavailable).queryByRole("button")).not.toBeInTheDocument();
      expect(within(unavailable).queryByText(/\d/)).not.toBeInTheDocument();
    });

    it("has a single table, the one of accessibility", async () => {
      await renderPage();

      expect(screen.getAllByRole("table")).toEqual([accessibilityTable()]);
    });

    it("has no level column in the course history", async () => {
      await renderPage();

      expect(screen.queryByRole("columnheader", { name: /nível/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/nível/i)).not.toBeInTheDocument();
    });

    it("does not ask for the enrollments", async () => {
      const requests = trackRequests();

      try {
        await renderPage();

        expect(requests.withoutSession().join(" ")).not.toMatch(/enrollments/);
      } finally {
        requests.stop();
      }
    });
  });

  describe("the actions area", () => {
    it.each([
      ["coordinator", Role.coordinator],
      ["director", Role.director],
    ])(
      "gives the %s Matricular em turma, to the enrollment screen with the student",
      async (_label, role) => {
        const user = userEvent.setup();
        const { router } = await renderPage({ role });

        await user.click(screen.getByRole("button", { name: "Matricular em turma" }));

        expect(router.state.location.pathname).toBe("/enrollments");
        expect(router.state.location.search).toBe(`?studentId=${buildStudentDetail().id}`);
      },
    );

    it("disables Editar dados and Matricular em turma and offers Reativar aluno for an archived student", async () => {
      await renderPage({ student: buildStudentDetail({ archivedAt: "2026-10-10T13:00:00.000Z" }) });

      expect(screen.getByRole("button", { name: "Matricular em turma" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Editar dados" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Reativar aluno" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Arquivar aluno" })).not.toBeInTheDocument();
    });

    it("gives the coordinator Editar dados and Arquivar aluno", async () => {
      await renderPage({ role: Role.coordinator });

      expect(screen.getByRole("button", { name: "Editar dados" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Arquivar aluno" })).toBeInTheDocument();
    });

    it("gives the director Editar dados, but not Arquivar aluno", async () => {
      await renderPage({ role: Role.director });

      expect(screen.getByRole("button", { name: "Editar dados" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Arquivar aluno" })).not.toBeInTheDocument();
    });

    it("has none of the actions for a member", async () => {
      await renderPage({ role: Role.member });

      for (const name of [
        "Editar dados",
        "Arquivar aluno",
        "Reativar aluno",
        "Matricular em turma",
      ]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
    });
  });

  describe("an archived student", () => {
    const archived = {
      archivedAt: "2026-10-10T13:00:00.000Z",
      archiveReason: "Mudou de cidade",
    };

    it("shows Arquivada in the tags, no Ativa, and a notice with the date and the reason", async () => {
      await renderPage({ student: buildStudentDetail(archived) });

      expect(tags(header())).toEqual(["Arquivada", "67 anos", "Acessibilidade: visual"]);
      expect(screen.getByText("Cadastro arquivado em 10/10/2026.")).toBeInTheDocument();
      expect(screen.getByText("Motivo: Mudou de cidade")).toBeInTheDocument();
    });

    it("shows the notice without a reason when nobody wrote one", async () => {
      await renderPage({ student: buildStudentDetail({ ...archived, archiveReason: null }) });

      expect(screen.getByText("Cadastro arquivado em 10/10/2026.")).toBeInTheDocument();
      expect(screen.queryByText(/Motivo/)).not.toBeInTheDocument();
    });

    it("does not show a reason that is only spaces", async () => {
      await renderPage({ student: buildStudentDetail({ ...archived, archiveReason: "   " }) });

      expect(screen.getByText("Cadastro arquivado em 10/10/2026.")).toBeInTheDocument();
      expect(screen.queryByText(/Motivo/)).not.toBeInTheDocument();
    });

    it("keeps the whole registration readable", async () => {
      await renderPage({ student: buildStudentDetail(archived) });

      expect(valueOf(card("Dados pessoais"), "Telefone")).toHaveTextContent("(11) 98765-4321");
      expect(cellsOf(within(accessibilityTable()).getAllByRole("row")[1])[2]).toHaveTextContent(
        "Lupa e fonte ampliada",
      );
      expect(valueOf(card("Registro"), "Última atualização")).toHaveTextContent("20/10/2026");
    });

    it("is not announced as an alert: it is born with the page", async () => {
      await renderPage({ student: buildStudentDetail(archived) });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows no notice for an active student", async () => {
      await renderPage();

      expect(screen.queryByText(/Cadastro arquivado/)).not.toBeInTheDocument();
      expect(tags(header())).toContain("Ativa");
    });
  });

  describe("errors", () => {
    it("shows a page of not found, with no way back, for an unknown student", async () => {
      server.use(meHandler(), getStudentHandler({ error: STUDENT_NOT_FOUND_ERROR }));
      await renderRoutes(peopleRoutes, { route: STUDENT_ROUTE });

      expect(
        await screen.findByRole("heading", { level: 2, name: "Aluno não encontrado" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Este aluno não existe ou foi removido.")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Dados pessoais" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not take a 404 that did not come from the API for a student that does not exist", async () => {
      server.use(
        meHandler(),
        getStudentHandler({ error: { statusCode: 404, error: "Not Found" } }),
      );
      await renderRoutes(peopleRoutes, { route: STUDENT_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o aluno. Tente novamente.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Aluno não encontrado" }),
      ).not.toBeInTheDocument();
    });

    it("shows not found at once for an id that is not a UUID, with no request", async () => {
      const onGet = vi.fn();
      const requests = trackRequests();
      server.use(meHandler(), getStudentHandler({ onCall: onGet }));

      try {
        await renderRoutes(peopleRoutes, { route: "/students/abc" });

        expect(
          await screen.findByRole("heading", { name: "Aluno não encontrado" }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(onGet).not.toHaveBeenCalled();
        expect(requests.withoutSession()).toEqual([]);
      } finally {
        requests.stop();
      }
    });

    it("shows an error with a retry that loads the student", async () => {
      const user = userEvent.setup();
      server.use(
        meHandler(),
        getStudentHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      await renderRoutes(peopleRoutes, { route: STUDENT_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o aluno. Tente novamente.",
      );
      expect(screen.queryByRole("heading", { name: "Dados pessoais" })).not.toBeInTheDocument();

      server.use(getStudentHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("heading", { name: STUDENT_NAME })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("health data (LGPD)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("writes nothing about the student to the console", async () => {
      const spies = (["debug", "error", "info", "log", "warn"] as const).map((method) =>
        vi.spyOn(console, method).mockImplementation(() => undefined),
      );

      // The whole page, and then the paths that only an archived student without an author takes.
      const first = await renderPage();
      first.unmount();
      await renderPage({
        student: buildStudentDetail({ createdBy: null, archivedAt: "2026-10-10T13:00:00.000Z" }),
      });

      const written = spies
        .flatMap((spy) => spy.mock.calls)
        .flat()
        .map(String)
        .join("\n");
      for (const secret of [
        "Maria",
        "Santos",
        "visual",
        "Visual",
        "Lupa",
        "letra grande",
        "87654321",
        "maria.santos",
      ]) {
        expect(written).not.toContain(secret);
      }
    });

    it("drops the cached student when the page unmounts", async () => {
      const { unmount, queryClient } = await renderPage();
      expect(queryClient.getQueryState(getGetStudentQueryKey(STUDENT_ID))).toBeDefined();

      unmount();

      await waitFor(() =>
        expect(queryClient.getQueryState(getGetStudentQueryKey(STUDENT_ID))).toBeUndefined(),
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
        STUDENT_NAME,
        "Dados pessoais",
        ACCESSIBILITY_TITLE,
        "Matrículas",
        "Resumo",
        "Histórico de cursos",
        "Registro",
      ]);
    });

    it("names the table by its caption and gives every label a value", async () => {
      await renderPage();

      expect(accessibilityTable()).toHaveAccessibleName(ACCESSIBILITY_TITLE);
      for (const title of ["Dados pessoais", "Registro"]) {
        const terms = within(card(title)).getAllByText(/.+/, { selector: "dt" });
        for (const term of terms) {
          expect(term.nextElementSibling?.tagName, term.textContent ?? "").toBe("DD");
        }
      }
    });

    it("has no h1, no table and no heading of its own while it loads", async () => {
      const deferred = createDeferred();
      server.use(meHandler(), getStudentHandler({ delay: deferred.promise }));
      await renderRoutes(peopleRoutes, { route: STUDENT_ROUTE });

      expect(await screen.findByText("Carregando o aluno…")).toBeInTheDocument();
      expect(screen.queryAllByRole("heading")).toHaveLength(0);
      expect(screen.queryByRole("table")).not.toBeInTheDocument();

      deferred.resolve();
      await screen.findByRole("heading", { name: STUDENT_NAME });
    });
  });
});
