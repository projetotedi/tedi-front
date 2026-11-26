import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { EnrollmentStatus } from "@api/generated/model";

import { ChangeEnrollmentStatusDialog } from "../components/ChangeEnrollmentStatusDialog";
import { todayCalendarDate } from "../lib/format";
import { renderWithProviders, server, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

const ENROLLMENT_ID = "01999a3e-7c1b-7000-8000-000000000401";

function useUpdateHandler(answer: () => Response = () => HttpResponse.json({})) {
  const bodies: unknown[] = [];
  server.use(
    http.patch("*/enrollments/:id", async ({ request }) => {
      bodies.push(await request.json());
      return answer();
    }),
  );
  return bodies;
}

async function renderDialog() {
  const view = await renderWithProviders(
    <ChangeEnrollmentStatusDialog
      enrollment={{
        id: ENROLLMENT_ID,
        studentName: "Sebastião Rocha Alves",
        status: EnrollmentStatus.active,
        enrolledAt: "2026-03-01T12:00:00.000Z",
      }}
      classLabel="Informática Básica — Turma A · INFO-A · 2026.1"
      onClose={() => {}}
    />,
  );
  const dialog = await screen.findByRole("dialog", { name: "Alterar situação da matrícula" });
  return { ...view, dialog };
}

describe("ChangeEnrollmentStatusDialog", () => {
  it("shows who and how the enrollment is now, and asks for the new status", async () => {
    const user = userEvent.setup();
    const bodies = useUpdateHandler();
    const { dialog } = await renderDialog();

    expect(within(dialog).getByText("Sebastião Rocha Alves · Aluno")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Informática Básica — Turma A · INFO-A · 2026.1"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Situação atual: Ativa · matriculado em 01/03/2026"),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Salvar situação" }));

    expect(await within(dialog).findByText("Escolha a nova situação.")).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it("sends the new status from today, and the reason only when filled in", async () => {
    const user = userEvent.setup();
    const bodies = useUpdateHandler();
    const { dialog } = await renderDialog();

    await user.click(within(dialog).getByRole("radio", { name: /Desistente/ }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar situação" }));

    expect(
      await screen.findByText("Situação da matrícula de Sebastião Rocha Alves alterada"),
    ).toBeInTheDocument();
    expect(bodies).toEqual([
      { status: EnrollmentStatus.dropped, effectiveDate: todayCalendarDate() },
    ]);
  });

  it("puts a day the API refuses on the date field", async () => {
    const user = userEvent.setup();
    useUpdateHandler(() =>
      HttpResponse.json(
        {
          statusCode: 400,
          error: "EFFECTIVE_DATE_BEFORE_ENROLLMENT",
          message: "No.",
          details: [{ field: "effectiveDate", message: "No." }],
        },
        { status: 400 },
      ),
    );
    const { dialog } = await renderDialog();

    await user.click(within(dialog).getByRole("radio", { name: /Concluída/ }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar situação" }));

    expect(
      await within(dialog).findByText("A data não pode ser antes da matrícula."),
    ).toBeInTheDocument();
  });

  it("explains a full class when going back to active", async () => {
    const user = userEvent.setup();
    useUpdateHandler(() =>
      HttpResponse.json(
        {
          statusCode: 409,
          error: "CLASS_FULL",
          message: "Full.",
          details: [{ field: "status", message: "0" }],
        },
        { status: 409 },
      ),
    );
    const { dialog } = await renderDialog();

    await user.click(within(dialog).getByRole("radio", { name: /Ativa/ }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar situação" }));

    expect(
      await within(dialog).findByText("A turma não tem mais vagas. Ninguém foi matriculado."),
    ).toBeInTheDocument();
  });
});
