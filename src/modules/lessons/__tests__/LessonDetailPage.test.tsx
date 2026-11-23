import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getMeQueryKey } from "@api/generated/auth/auth";
import { getGetLessonQueryKey } from "@api/generated/lessons/lessons";
import type { LessonResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { lessonsRoutes } from "../routes";
import {
  buildCancelledLesson,
  buildLesson,
  buildMeUser,
  buildRescheduledLesson,
  buildStandaloneLesson,
  cancelLessonHandler,
  CLASS_ID,
  CLASS_NAME,
  COURSE_ID,
  COURSE_NAME,
  getLessonHandler,
  LESSON_ID,
  LESSON_NOT_FOUND_ERROR,
  LESSON_PLAN_ID,
} from "./handlers";
import {
  createDeferred,
  expectNoRequestBesidesSession,
  renderRoutes,
  server,
  setupLessonsTestServer,
} from "./test-utils";

setupLessonsTestServer();

const LESSON_ROUTE = `/lessons/${LESSON_ID}`;
const LESSON_TITLE = "Teclado, mouse e janelas";
const ACTIONS = ["Remarcar aula", "Cancelar aula", "Editar aula"] as const;
const CANCELLED_HINT = "Aula cancelada: não pode ser remarcada, cancelada nem editada.";
const ARCHIVED_HINT = "A turma está arquivada: as aulas dela ficam só para leitura.";

interface RenderOptions {
  lesson?: LessonResponseDto;
  role?: Role;
  onGet?: (call: { id: string }) => void;
}

async function renderPage({
  lesson = buildLesson(),
  role = Role.coordinator,
  onGet,
}: RenderOptions = {}) {
  server.use(getLessonHandler({ response: lesson, onCall: onGet }));
  const view = await renderRoutes(lessonsRoutes, { route: LESSON_ROUTE, user: buildMeUser(role) });
  await screen.findByRole("heading", { level: 2, name: lesson.title });
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

/** The header is the card whose heading is the title of the lesson. */
const header = (title: string = LESSON_TITLE) => card(title);

const tags = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("listitem")
    .map((tag) => tag.textContent);

const button = (name: string) => screen.getByRole("button", { name });

/** A value the lesson does not have: a dash for who sees and "Não informado" for who hears. */
function expectDash(value: HTMLElement) {
  expect(within(value).getByText("—")).toHaveAttribute("aria-hidden", "true");
  expect(within(value).getByText("Não informado")).toHaveClass("sr-only");
}

describe("LessonDetailPage", () => {
  describe("loading the lesson", () => {
    it("mounts with a single getLesson request", async () => {
      const onGet = vi.fn();
      const requests: string[] = [];
      server.events.on("request:start", ({ request }) => {
        requests.push(`${request.method} ${new URL(request.url).pathname}`);
      });

      try {
        const { queryClient } = await renderPage({ onGet });

        expect(onGet).toHaveBeenCalledExactlyOnceWith({ id: LESSON_ID });
        expect(requests.filter((request) => !request.endsWith("/auth/me"))).toEqual([
          `GET /lessons/${LESSON_ID}`,
        ]);
        // Besides the session, the only thing in the cache is the lesson: no card asks for more.
        const [sessionKey] = getMeQueryKey();
        const keys = queryClient
          .getQueryCache()
          .findAll()
          .map((query) => query.queryKey)
          .filter((key) => key[0] !== sessionKey);
        expect(keys).toEqual([getGetLessonQueryKey(LESSON_ID)]);
      } finally {
        server.events.removeAllListeners("request:start");
      }
    });

    it("shows a loading status while the lesson is on its way", async () => {
      const deferred = createDeferred();
      server.use(getLessonHandler({ delay: deferred.promise }));
      await renderRoutes(lessonsRoutes, { route: LESSON_ROUTE });

      expect(await screen.findByRole("status")).toHaveTextContent("Carregando a aula…");
      expect(screen.queryByRole("heading", { name: LESSON_TITLE })).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByRole("heading", { name: LESSON_TITLE })).toBeInTheDocument();
      expect(screen.queryByText("Carregando a aula…")).not.toBeInTheDocument();
    });

    it("shows the header, the data and the links of the lesson", async () => {
      await renderPage();

      expect(
        within(header()).getByRole("heading", { level: 2, name: LESSON_TITLE }),
      ).toBeInTheDocument();

      const data = card("Dados da aula");
      expect(valueOf(data, "Data")).toHaveTextContent(/^10\/03\/2026$/);
      expect(valueOf(data, "Horário")).toHaveTextContent(/^09:00–11:00$/);
      expect(valueOf(data, "Duração")).toHaveTextContent(/^2h$/);
      expect(valueOf(data, "Local")).toHaveTextContent(/^Laboratório 2 — Bloco B$/);
      expect(valueOf(data, "Status")).toHaveTextContent(/^Planejada$/);
      expect(valueOf(data, "Ordem no plano do curso")).toHaveTextContent(/^1ª aula da sequência$/);
      expect(
        within(valueOf(data, "Plano de aula (origem)")).getByRole("link", { name: LESSON_TITLE }),
      ).toHaveAttribute("href", `/lesson-plans/${LESSON_PLAN_ID}`);
      expect(valueOf(data, "Alunos esperados")).toHaveTextContent(/^12$/);
      expect(valueOf(data, "Monitores esperados")).toHaveTextContent(/^2$/);

      const links = card("Vínculos");
      expect(
        within(valueOf(links, "Turma")).getByRole("link", { name: CLASS_NAME }),
      ).toHaveAttribute("href", `/classes/${CLASS_ID}`);
      expect(
        within(valueOf(links, "Curso")).getByRole("link", { name: COURSE_NAME }),
      ).toHaveAttribute("href", `/courses/${COURSE_ID}`);
      expect(valueOf(links, "Edição")).toHaveTextContent(/^2026\.1$/);
      expect(valueOf(links, "Plano de aula")).toHaveTextContent(
        /^Teclado, mouse e janelas · item 1$/,
      );
    });

    it("shows the breadcrumb Aulas › date · title", async () => {
      await renderPage();

      const trail = screen.getByRole("navigation", { name: "Trilha de navegação" });
      expect(within(trail).getByRole("link", { name: "Aulas" })).toHaveAttribute(
        "href",
        "/lessons",
      );
      const current = within(trail).getByText(`10/03/2026 · ${LESSON_TITLE}`);
      expect(current).toHaveAttribute("aria-current", "page");
      expect(within(trail).getByText("›")).toHaveAttribute("aria-hidden", "true");
    });

    it("shows status, class, course, schedule, duration and location tags", async () => {
      await renderPage();

      expect(tags(header())).toEqual([
        "Planejada",
        `Turma ${CLASS_NAME}`,
        COURSE_NAME,
        "10/03/2026 · 09:00–11:00",
        "2h de aula",
        "Laboratório 2 — Bloco B",
      ]);
    });
  });

  describe("a lesson that changed", () => {
    it("shows the original date and the reason of a rescheduled lesson", async () => {
      await renderPage({ lesson: buildRescheduledLesson() });

      const changes = card("Remarcação");
      expect(valueOf(changes, "Data original")).toHaveTextContent(/^03\/03\/2026$/);
      expect(valueOf(changes, "Motivo da remarcação")).toHaveTextContent(/^Sala indisponível$/);
      expect(valueOf(changes, "Observação da remarcação")).toHaveTextContent(
        /^A sala foi usada para a prova\.$/,
      );
      // The lesson is on its new day, and a rescheduled lesson can still be changed.
      expect(valueOf(card("Dados da aula"), "Data")).toHaveTextContent(/^10\/03\/2026$/);
      for (const name of ACTIONS) expect(button(name)).toBeEnabled();
    });

    it("shows no card of changes for a lesson that was never rescheduled nor cancelled", async () => {
      await renderPage();

      expect(screen.queryByRole("heading", { name: /^Remarcação|^Cancelamento/ })).toBeNull();
      expect(screen.queryByRole("region", { name: /Remarcação|Cancelamento/ })).toBeNull();
    });

    it("shows the reason of a cancelled lesson and its actions turned off", async () => {
      await renderPage({ lesson: buildCancelledLesson() });

      const changes = card("Cancelamento");
      expect(valueOf(changes, "Motivo do cancelamento")).toHaveTextContent(/^Feriado municipal\.$/);
      expect(tags(header())[0]).toBe("Cancelada");
      expect(
        within(header())
          .getAllByRole("button")
          .map((item) => item.textContent),
      ).toEqual([...ACTIONS]);
      for (const name of ACTIONS) {
        expect(button(name)).toBeDisabled();
        expect(button(name)).toHaveAccessibleDescription(CANCELLED_HINT);
      }
    });

    it("shows a lesson that was rescheduled and then cancelled with both, in one card", async () => {
      await renderPage({
        lesson: buildCancelledLesson({
          originalDate: "2026-03-03",
          rescheduleReason: "Sala indisponível",
          rescheduleNote: null,
        }),
      });

      const changes = card("Remarcação e cancelamento");
      expect(valueOf(changes, "Data original")).toHaveTextContent(/^03\/03\/2026$/);
      expect(valueOf(changes, "Motivo do cancelamento")).toHaveTextContent(/^Feriado municipal\.$/);
    });

    it("turns the actions off for a lesson of an archived class, with the reason (RN-27)", async () => {
      const lesson = buildLesson();
      await renderPage({
        lesson: { ...lesson, class: { ...lesson.class, archivedAt: "2026-10-10T13:00:00.000Z" } },
      });

      for (const name of ACTIONS) {
        expect(button(name)).toBeDisabled();
        expect(button(name)).toHaveAccessibleDescription(ARCHIVED_HINT);
      }
    });

    it("after cancelling, the actions turn off and the focus goes to the Cancelamento card", async () => {
      const cancelled = buildCancelledLesson({ cancelReason: "Feriado municipal." });
      server.use(cancelLessonHandler({ response: cancelled }));
      const onGet = vi.fn();
      const user = userEvent.setup();
      await renderPage({ onGet });
      expect(screen.queryByRole("region", { name: "Cancelamento" })).not.toBeInTheDocument();

      await user.click(button("Cancelar aula"));
      await user.type(
        await screen.findByRole("textbox", { name: "Motivo do cancelamento" }),
        "Feriado municipal.",
      );
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar aula" }),
      );

      const region = await screen.findByRole("region", { name: "Cancelamento" });
      await waitFor(() => expect(region).toHaveFocus());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(valueOf(card("Cancelamento"), "Motivo do cancelamento")).toHaveTextContent(
        /^Feriado municipal\.$/,
      );
      expect(tags(header())[0]).toBe("Cancelada");
      for (const name of ACTIONS) {
        expect(button(name)).toBeDisabled();
        expect(button(name)).toHaveAccessibleDescription(CANCELLED_HINT);
      }
      // The answer of the cancelling is the lesson now: the screen did not ask for it again.
      expect(onGet).toHaveBeenCalledTimes(1);
    });
  });

  describe("who sees the actions", () => {
    it("member sees the lesson without the management actions", async () => {
      await renderPage({ role: Role.member });

      expect(card("Dados da aula")).toBeInTheDocument();
      expect(card("Vínculos")).toBeInTheDocument();
      expect(within(header()).queryByRole("button")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^(Remarcar|Cancelar|Editar) aula$/ }),
      ).not.toBeInTheDocument();
    });

    it("member sees the reason of a cancelled lesson, and no button, not even a turned-off one", async () => {
      await renderPage({ role: Role.member, lesson: buildCancelledLesson() });

      expect(valueOf(card("Cancelamento"), "Motivo do cancelamento")).toHaveTextContent(
        /^Feriado municipal\.$/,
      );
      expect(within(header()).queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByText(CANCELLED_HINT)).not.toBeInTheDocument();
    });

    it.each([
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])(
      "the %s sees Remarcar aula, Cancelar aula and Editar aula turned on, in the order of the Figma",
      async (_label, role) => {
        await renderPage({ role });

        expect(
          within(header())
            .getAllByRole("button")
            .map((item) => item.textContent),
        ).toEqual([...ACTIONS]);
        for (const name of ACTIONS) expect(button(name)).toBeEnabled();
        expect(button("Remarcar aula")).toHaveClass("button--tertiary");
        expect(button("Cancelar aula")).toHaveClass("button--danger-soft");
        expect(button("Editar aula")).toHaveClass("button--secondary");
      },
    );

    it("has no Registrar chamada button: it comes with the attendance module", async () => {
      await renderPage({ role: Role.coordinator });

      expect(screen.queryByRole("button", { name: "Registrar chamada" })).not.toBeInTheDocument();
      expect(screen.queryByText("Registrar chamada")).not.toBeInTheDocument();
    });
  });

  describe("what the lesson does not have yet", () => {
    it("keeps Chamada, Cobertura da aula and Registro as Em breve, with no request of their own", async () => {
      await renderPage();

      for (const title of ["Chamada", "Cobertura da aula", "Registro"]) {
        const soon = card(title);
        expect(within(soon).getByText("Em breve")).toBeInTheDocument();
        expect(within(soon).queryByRole("table")).not.toBeInTheDocument();
        expect(within(soon).queryByRole("link")).not.toBeInTheDocument();
        expect(within(soon).queryByRole("button")).not.toBeInTheDocument();
      }
      expect(screen.getAllByText("Em breve")).toHaveLength(3);
    });

    it("puts Chamada and Registro under the data, and Cobertura da aula after the links", async () => {
      await renderPage({ lesson: buildCancelledLesson() });

      const follows = (first: HTMLElement, second: HTMLElement) =>
        Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(follows(card("Dados da aula"), card("Chamada"))).toBe(true);
      expect(follows(card("Chamada"), card("Registro"))).toBe(true);
      expect(follows(card("Vínculos"), card("Cancelamento"))).toBe(true);
      expect(follows(card("Cancelamento"), card("Cobertura da aula"))).toBe(true);
    });

    it("shows a dash for teacher, material and fields the lesson does not have", async () => {
      await renderPage({
        lesson: buildStandaloneLesson({
          location: null,
          expectedStudents: null,
          expectedMonitors: null,
          subject: null,
          postNotes: null,
        }),
      });

      const data = card("Dados da aula");
      for (const label of [
        "Local",
        "Ordem no plano do curso",
        "Material",
        "Alunos esperados",
        "Monitores esperados",
        "Assunto",
        "Professor(a)",
        "Observações pós-aula",
      ]) {
        expectDash(valueOf(data, label));
      }
      expect(valueOf(data, "Plano de aula (origem)")).toHaveTextContent(
        /^Aula avulsa \(sem plano\)$/,
      );
      expect(valueOf(card("Vínculos"), "Plano de aula")).toHaveTextContent(
        /^Aula avulsa \(sem plano\)$/,
      );
      // No location, no tag for it.
      expect(tags(header())).toHaveLength(5);
    });
  });

  describe("not found", () => {
    it("shows the page of not found, with the way back to the lessons, for a lesson that does not exist", async () => {
      server.use(getLessonHandler({ error: LESSON_NOT_FOUND_ERROR }));
      await renderRoutes(lessonsRoutes, { route: LESSON_ROUTE });

      expect(
        await screen.findByRole("heading", { name: "Aula não encontrada" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Esta aula não existe ou foi removida. Volte para a lista e escolha outra.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Voltar para aulas" })).toHaveAttribute(
        "href",
        "/lessons",
      );
      expect(screen.queryByRole("heading", { name: "Dados da aula" })).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("an id that is not a UUID is not found, with no request", async () => {
      const onGet = vi.fn();
      server.use(getLessonHandler({ onCall: onGet }));
      const { queryClient } = await renderRoutes(lessonsRoutes, { route: "/lessons/1" });

      expect(
        await screen.findByRole("heading", { name: "Aula não encontrada" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(onGet).not.toHaveBeenCalled();
      expectNoRequestBesidesSession(queryClient);
    });

    it("a 404 without LESSON_NOT_FOUND is the generic error", async () => {
      server.use(getLessonHandler({ error: { statusCode: 404, error: "Not Found" } }));
      await renderRoutes(lessonsRoutes, { route: LESSON_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a aula.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Aula não encontrada" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when the lesson cannot be loaded", () => {
    it("shows the alert with Tentar de novo on a 500, which asks again", async () => {
      server.use(getLessonHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }));
      const user = userEvent.setup();
      await renderRoutes(lessonsRoutes, { route: LESSON_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a aula.",
      );
      expect(screen.queryByRole("heading", { name: LESSON_TITLE })).not.toBeInTheDocument();

      server.use(getLessonHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("heading", { name: LESSON_TITLE })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the same alert with Tentar de novo when the request never gets an answer", async () => {
      server.use(getLessonHandler({ networkError: true }));
      await renderRoutes(lessonsRoutes, { route: LESSON_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a aula.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    });
  });
});
