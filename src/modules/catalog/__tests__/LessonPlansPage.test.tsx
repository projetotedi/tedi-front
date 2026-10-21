import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { LessonPlansPage } from "../pages/LessonPlansPage";
import { buildLessonPlan, buildMeUser, createLessonPlanHandler } from "./handlers";
import { renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const newPlanButton = () => screen.queryByRole("button", { name: "+ Novo plano de aula" });

describe("LessonPlansPage", () => {
  describe("permissions", () => {
    it.each([
      ["coordinator", Role.coordinator],
      ["director", Role.director],
    ])("the %s sees + Novo plano de aula", async (_label, role) => {
      await renderWithProviders(<LessonPlansPage />, { user: buildMeUser(role) });

      expect(newPlanButton()).toBeInTheDocument();
    });

    it("the member does not see the buttons to create, edit and archive", async () => {
      await renderWithProviders(<LessonPlansPage />, { user: buildMeUser(Role.member) });

      expect(screen.getByRole("heading", { name: "Planos de aula" })).toBeInTheDocument();
      expect(newPlanButton()).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Novo plano de aula/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Arquivar/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("hides the creation entry points whenever the permission is missing, whatever the profile", async () => {
      const user = buildMeUser(Role.coordinator);
      await renderWithProviders(<LessonPlansPage />, {
        user: { ...user, permissions: { ...user.permissions, "lessonPlans.manage": "none" } },
      });

      expect(newPlanButton()).not.toBeInTheDocument();
    });
  });

  describe("content", () => {
    it("shows the Planos de aula card with the notice that the list is coming", async () => {
      await renderWithProviders(<LessonPlansPage />);

      const region = screen.getByRole("region", { name: "Planos de aula" });
      expect(within(region).getByRole("heading", { name: "Planos de aula" })).toBeInTheDocument();
      expect(
        within(region).getByRole("heading", {
          name: "A listagem de planos de aula chega em breve",
        }),
      ).toBeInTheDocument();
      expect(
        within(region).getByText("Os planos cadastrados aparecerão aqui."),
      ).toBeInTheDocument();
    });

    it("does not request a list: the listing is not part of this screen yet", async () => {
      const onList = vi.fn();
      server.use(
        http.get("*/lesson-plans", () => {
          onList();
          return HttpResponse.json([]);
        }),
      );

      await renderWithProviders(<LessonPlansPage />);

      expect(screen.getByRole("region", { name: "Planos de aula" })).toBeInTheDocument();
      expect(onList).not.toHaveBeenCalled();
    });
  });

  describe("creating a plan", () => {
    it("opens the Novo plano de aula dialog from the button", async () => {
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlansPage />);

      await user.click(newPlanButton()!);

      expect(await screen.findByRole("dialog", { name: "Novo plano de aula" })).toBeInTheDocument();
    });

    it("Cancelar goes back to the page and gives the focus back to the button", async () => {
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlansPage />);
      await user.click(newPlanButton()!);
      await screen.findByRole("dialog", { name: "Novo plano de aula" });

      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(newPlanButton()).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
    });

    it("creates a plan, shows the toast and goes back to the page", async () => {
      const onCall = vi.fn();
      server.use(
        createLessonPlanHandler({ response: buildLessonPlan({ title: "Plano novo" }), onCall }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlansPage />);
      await user.click(newPlanButton()!);
      await screen.findByRole("dialog", { name: "Novo plano de aula" });
      await user.type(screen.getByRole("textbox", { name: "Título do plano" }), "Plano novo");
      await user.type(screen.getByRole("textbox", { name: "Horas" }), "1");
      await user.type(screen.getByRole("textbox", { name: "Minutos" }), "30");
      await user.type(screen.getByRole("textbox", { name: "Conteúdo 1" }), "Teclado e mouse");

      await user.click(screen.getByRole("button", { name: "Salvar plano" }));

      expect(await screen.findByText("Plano de aula criado.")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(onCall).toHaveBeenCalledWith({
        body: {
          title: "Plano novo",
          objective: null,
          expectedDurationMinutes: 90,
          contents: ["Teclado e mouse"],
          materialUrl: null,
        },
      });
      expect(screen.getByRole("heading", { name: "Planos de aula" })).toBeInTheDocument();
    });

    it("keeps the dialog open with the field errors when the form is invalid", async () => {
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlansPage />);
      await user.click(newPlanButton()!);
      await screen.findByRole("dialog", { name: "Novo plano de aula" });

      await user.click(screen.getByRole("button", { name: "Salvar plano" }));

      expect(await screen.findByText("Informe o título do plano.")).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Novo plano de aula" })).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("textbox", { name: "Título do plano" })).toHaveFocus(),
      );
    });
  });
});
