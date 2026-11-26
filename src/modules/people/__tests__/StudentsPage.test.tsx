import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  AccessibilityNeed,
  type StudentByEnrollmentItemResponseDto,
  type StudentListItemResponseDto,
} from "@api/generated/model";
import { buildMeUser, meHandler } from "@modules/auth/__tests__/handlers";
import { renderRoutes, server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import { Role } from "@shared/lib/role";

import { peopleRoutes } from "./test-routes";

setupAuthTestServer();

const MARIA: StudentListItemResponseDto = {
  id: "01999a3e-7c1b-7000-8000-000000000801",
  name: "Maria da Silva Santos",
  age: 67,
  birthDate: "1959-05-10",
  email: null,
  phone: "11988881234",
  accessibilityNeed: AccessibilityNeed.visual,
  createdAt: "2026-02-10T12:00:00.000Z",
};

const JOAO: StudentListItemResponseDto = {
  ...MARIA,
  id: "01999a3e-7c1b-7000-8000-000000000802",
  name: "João Pereira Costa",
  age: 72,
  phone: null,
  accessibilityNeed: AccessibilityNeed.none,
};

const MARIA_ENROLLED: StudentByEnrollmentItemResponseDto = {
  ...MARIA,
  currentClasses: [
    {
      id: "01999a3e-7c1b-7000-8000-0000000009c1",
      code: "INFO-A",
      name: "Informática Básica — A",
      edition: { id: "e", name: "2026.1" },
    },
  ],
};

interface Calls {
  plain: Record<string, string>[];
  byEnrollment: Record<string, string>[];
}

function useStudentHandlers({
  plain = [MARIA, JOAO],
  byEnrollment = [MARIA_ENROLLED],
  error = false,
}: {
  plain?: StudentListItemResponseDto[];
  byEnrollment?: StudentByEnrollmentItemResponseDto[];
  error?: boolean;
} = {}): Calls {
  const calls: Calls = { plain: [], byEnrollment: [] };
  const params = (url: string) => Object.fromEntries(new URL(url).searchParams);
  // `*/students` would also match `/enrollments/students`: the more specific one comes first.
  server.use(
    http.get("*/enrollments/students", ({ request }) => {
      calls.byEnrollment.push(params(request.url));
      return HttpResponse.json({
        data: byEnrollment,
        total: byEnrollment.length,
        page: 1,
        limit: 10,
      });
    }),
    http.get("*/students", ({ request }) => {
      calls.plain.push(params(request.url));
      if (error) return HttpResponse.json({ statusCode: 500, error: "X" }, { status: 500 });
      return HttpResponse.json({ data: plain, total: plain.length, page: 1, limit: 10 });
    }),
    http.get("*/classes", () => HttpResponse.json({ data: [], total: 0, page: 1, limit: 100 })),
  );
  return calls;
}

async function renderPage(route = "/students", role = Role.coordinator) {
  server.use(meHandler({ user: buildMeUser({ role }) }));
  return renderRoutes(peopleRoutes, { route });
}

describe("StudentsPage", () => {
  it("lists the students alphabetically with age and phone, and the classes as — without a filter", async () => {
    const calls = useStudentHandlers();
    await renderPage();

    const table = await screen.findByRole("table", { name: "Alunos (2)" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByRole("link", { name: "Maria da Silva Santos" })).toHaveAttribute(
      "href",
      `/students/${MARIA.id}`,
    );
    expect(rows[0]).toHaveTextContent("67");
    expect(rows[0]).toHaveTextContent("(11) 98888-1234");
    expect(calls.plain[0]).toMatchObject({ page: "1", limit: "10", sort: "name" });
    expect(calls.byEnrollment).toEqual([]);
  });

  it("opens the record when the row is clicked", async () => {
    useStudentHandlers();
    const { router } = await renderPage();

    const table = await screen.findByRole("table", { name: "Alunos (2)" });
    await userEvent.click(within(table).getByText("72"));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/students/${JOAO.id}`));
  });

  it("searches by phone through the URL, back to page 1", async () => {
    const calls = useStudentHandlers();
    const { router } = await renderPage("/students?page=2");

    await screen.findByRole("table", { name: "Alunos (2)" });
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar aluno" }), "98888");

    await waitFor(() => expect(router.state.location.search).toBe("?search=98888"));
    await waitFor(() => expect(calls.plain.at(-1)).toMatchObject({ search: "98888", page: "1" }));
  });

  it("reads the list by enrollment with Situação, keeping the search, and shows the class", async () => {
    const calls = useStudentHandlers();
    await renderPage("/students?search=maria&situation=enrolled");

    const table = await screen.findByRole("table", { name: "Alunos (1)" });
    expect(within(table).getByText("Informática Básica — A")).toBeInTheDocument();
    expect(within(table).getByText("Matriculado")).toBeInTheDocument();
    expect(calls.byEnrollment[0]).toMatchObject({ search: "maria", situation: "enrolled" });
    expect(calls.plain).toEqual([]);
  });

  it("filters by accessibility with listStudents", async () => {
    const calls = useStudentHandlers();
    await renderPage("/students?accessibility=visual");

    await screen.findByRole("table");
    expect(calls.plain[0]).toMatchObject({ accessibilityNeed: "visual" });
  });

  it("says there is no student yet, and offers Limpar filtros when a filter finds nobody", async () => {
    useStudentHandlers({ plain: [] });
    await renderPage();
    expect(await screen.findByText("Nenhum aluno ainda")).toBeInTheDocument();
  });

  it("offers Limpar filtros when the search finds nobody", async () => {
    useStudentHandlers({ plain: [] });
    const { router } = await renderPage("/students?search=zzz");

    await userEvent.click(await screen.findByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("offers Tentar de novo when the list fails", async () => {
    useStudentHandlers({ error: true });
    await renderPage();

    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
