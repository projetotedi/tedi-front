import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { PendingApplicationsButton } from "../components/PendingApplicationsButton";
import {
  buildMeUser,
  buildMeUserWithoutManageOwn,
  buildPendingApplications,
  createApplicationsBackend,
  listPendingApplicationsHandler,
  type PendingApplicationsCall,
} from "./application-handlers";
import {
  createDeferred,
  expectNoRequestTo,
  server,
  setupAssignmentsTestServer,
} from "./test-utils";
import { renderAsMember } from "./application-test-utils";

setupAssignmentsTestServer();

const openButton = (name: string | RegExp = "Candidaturas pendentes (3)") =>
  screen.getByRole("button", { name });
const lessonBlock = (name: string) => screen.getByRole("region", { name });
/**
 * The Fechar of the footer of the dialog. The X in the corner has the same name, so the name does not
 * say which is which and neither is found by its place: the footer one is the one with the text.
 */
const footerClose = (dialog: HTMLElement) =>
  within(dialog).getByText("Fechar", { selector: "button" });

describe("PendingApplicationsButton", () => {
  describe("who sees it", () => {
    it("the member does not see it, not even disabled, and nothing is asked of the API", async () => {
      const onCall = vi.fn<(call: PendingApplicationsCall) => void>();
      server.use(listPendingApplicationsHandler({ onCall }));

      const { queryClient } = await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.member),
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByText(/Candidaturas pendentes/)).not.toBeInTheDocument();
      expectNoRequestTo(queryClient, "/applications");
      expect(onCall).not.toHaveBeenCalled();
    });

    it("does not see it without a session either, and nothing is asked", async () => {
      const onCall = vi.fn<(call: PendingApplicationsCall) => void>();
      server.use(listPendingApplicationsHandler({ onCall }));

      const { queryClient } = await renderAsMember(<PendingApplicationsButton />, {
        user: null,
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expectNoRequestTo(queryClient, "/applications");
      expect(onCall).not.toHaveBeenCalled();
    });

    it.each([
      ["director", Role.director],
      ["coordinator", Role.coordinator],
      ["superadmin", Role.superadmin],
    ])("the %s sees it, with the total of the queue", async (_label, role) => {
      server.use(listPendingApplicationsHandler());

      await renderAsMember(<PendingApplicationsButton />, { user: buildMeUser(role) });

      const button = await screen.findByRole("button", { name: "Candidaturas pendentes (3)" });
      expect(button).toHaveClass("button--secondary", "min-h-11");
    });

    it("asks only for who reviews: a profile that can apply but not review sees nothing", async () => {
      const onCall = vi.fn<(call: PendingApplicationsCall) => void>();
      server.use(listPendingApplicationsHandler({ onCall }));

      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUserWithoutManageOwn(Role.member),
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("the number", () => {
    it("is the total of GET /applications?status=pending, asked once", async () => {
      const onCall = vi.fn<(call: PendingApplicationsCall) => void>();
      server.use(listPendingApplicationsHandler({ onCall }));

      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });

      expect(
        await screen.findByRole("button", { name: "Candidaturas pendentes (3)" }),
      ).toBeInTheDocument();
      expect(onCall).toHaveBeenCalledExactlyOnceWith({ status: "pending" });
    });

    it("counts applications, not lessons", async () => {
      server.use(listPendingApplicationsHandler({ response: buildPendingApplications() }));

      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });

      expect(await screen.findByRole("button", { name: /\(3\)$/ })).toBeInTheDocument();
    });

    it("is left out while it loads, and the button can already be pressed", async () => {
      const deferred = createDeferred();
      server.use(listPendingApplicationsHandler({ delay: deferred.promise }));

      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });

      expect(openButton("Candidaturas pendentes")).toBeEnabled();

      deferred.resolve();
      expect(
        await screen.findByRole("button", { name: "Candidaturas pendentes (3)" }),
      ).toBeInTheDocument();
    });

    it("is left out when the queue cannot be read, and the dialog opens on the error", async () => {
      server.use(listPendingApplicationsHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });

      await waitFor(() => expect(openButton("Candidaturas pendentes")).toBeEnabled());
      await user.click(openButton("Candidaturas pendentes"));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar as candidaturas pendentes.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    });

    it("stays on the screen with 0, enabled: a disabled button takes no focus", async () => {
      server.use(listPendingApplicationsHandler({ response: buildPendingApplications([]) }));
      const user = userEvent.setup();
      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });

      const button = await screen.findByRole("button", { name: "Candidaturas pendentes (0)" });
      expect(button).toBeEnabled();

      await user.click(button);

      const dialog = await screen.findByRole("dialog", { name: "Candidaturas pendentes (0)" });
      expect(within(dialog).getByText("Nenhuma candidatura pendente.")).toBeVisible();
    });
  });

  describe("the dialog", () => {
    it("opens the dialog Candidaturas pendentes (3), with the queue", async () => {
      server.use(listPendingApplicationsHandler());
      const user = userEvent.setup();
      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });
      await screen.findByRole("button", { name: "Candidaturas pendentes (3)" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(openButton());

      const dialog = await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" });
      expect(within(dialog).getAllByRole("region")).toHaveLength(2);
      expect(within(dialog).getByText("Beatriz Nunes · Monitor(a)")).toBeInTheDocument();
    });

    it("gives the focus back to the button when Fechar closes the dialog", async () => {
      server.use(listPendingApplicationsHandler());
      const user = userEvent.setup();
      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });
      await screen.findByRole("button", { name: "Candidaturas pendentes (3)" });
      await user.click(openButton());
      const dialog = await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" });

      await user.click(footerClose(dialog));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(openButton()).toHaveFocus());
    });

    it("gives the focus back to the button when Esc closes the dialog", async () => {
      server.use(listPendingApplicationsHandler());
      const user = userEvent.setup();
      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });
      await screen.findByRole("button", { name: "Candidaturas pendentes (3)" });
      await user.click(openButton());
      await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" });

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(openButton()).toHaveFocus());
    });

    it("opens a fresh dialog each time", async () => {
      server.use(...createApplicationsBackend().handlers);
      const user = userEvent.setup();
      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });
      await screen.findByRole("button", { name: "Candidaturas pendentes (3)" });
      await user.click(openButton());
      await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" });
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await user.click(openButton());

      expect(
        await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" }),
      ).toBeInTheDocument();
    });
  });

  describe("confirming", () => {
    it("updates the counter and the coverage after Confirmar: the title goes from (3) to (2), the block from Monitores 2 de 3 to Monitores 3 de 3, and the button, after Fechar, says (2)", async () => {
      const backend = createApplicationsBackend();
      server.use(...backend.handlers);
      const user = userEvent.setup();
      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });
      await screen.findByRole("button", { name: "Candidaturas pendentes (3)" });
      await user.click(openButton());
      await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" });
      // Beatriz (monitor) and Diego are pending in the same lesson, which has two of three monitors.
      expect(
        within(lessonBlock("Aula 5 · E-mail do zero")).getByText(
          /Professor\(a\) 0 de 1 · Monitores 2 de 3$/,
        ),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Beatriz Nunes" }),
      );

      expect(
        await screen.findByRole("dialog", { name: "Candidaturas pendentes (2)" }),
      ).toBeInTheDocument();
      expect(
        within(lessonBlock("Aula 5 · E-mail do zero")).getByText(
          /Professor\(a\) 0 de 1 · Monitores 3 de 3$/,
        ),
      ).toBeInTheDocument();
      expect(backend.calls.approved).toHaveLength(1);

      const dialog = screen.getByRole("dialog");
      await user.click(footerClose(dialog));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(openButton("Candidaturas pendentes (2)")).toBeInTheDocument();
      await waitFor(() => expect(openButton("Candidaturas pendentes (2)")).toHaveFocus());
    });

    it("updates the counter of the button behind the dialog as soon as the queue is read again", async () => {
      server.use(...createApplicationsBackend().handlers);
      const user = userEvent.setup();
      await renderAsMember(<PendingApplicationsButton />, {
        user: buildMeUser(Role.coordinator),
      });
      await screen.findByRole("button", { name: "Candidaturas pendentes (3)" });
      await user.click(openButton());
      await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" });

      await user.click(
        screen.getByRole("button", { name: "Recusar a candidatura de Carla Menezes" }),
      );

      await screen.findByRole("dialog", { name: "Candidaturas pendentes (2)" });
      // The button is outside the dialog, so it is out of the accessibility tree while it is open.
      expect(
        screen.getByRole("button", { name: "Candidaturas pendentes (2)", hidden: true }),
      ).toBeInTheDocument();
    });
  });
});
