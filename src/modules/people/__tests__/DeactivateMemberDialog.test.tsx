import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getListAccessQueryKey } from "@api/generated";
import { getGetMemberQueryKey, getListMembersQueryKey } from "@api/generated/people/people";
import { renderSignedIn, server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";

import {
  DeactivateMemberDialog,
  type DeactivateMemberTarget,
} from "../components/DeactivateMemberDialog";
// Registers the "people" namespace.
import "../index";
import { todayInSaoPaulo } from "../lib/student";
import { deactivateMemberHandler, MEMBER_ID, MEMBER_NAME } from "./handlers";

setupAuthTestServer();

const MEMBER: DeactivateMemberTarget = { id: MEMBER_ID, name: MEMBER_NAME, joinedAt: "2024-03-01" };

async function renderDialog(member: DeactivateMemberTarget = MEMBER) {
  const onClose = vi.fn();
  const onDeactivated = vi.fn();
  const view = await renderSignedIn(
    <DeactivateMemberDialog member={member} onClose={onClose} onDeactivated={onDeactivated} />,
  );
  await screen.findByRole("dialog", { name: "Inativar membro" });
  return { ...view, onClose, onDeactivated };
}

const reasonField = () => screen.getByRole("textbox", { name: /^Motivo da saída/ });
const noteField = () => screen.getByRole("textbox", { name: /^Observação/ });
const exitDateGroup = () => screen.getByRole("group", { name: /^Data de saída/ });
const confirmButton = () => screen.getByRole("button", { name: "Inativar membro" });

/** Types the day, the month and the year in the segments of the exit date, from the day. */
async function typeExitDate(user: UserEvent, digits: string) {
  await user.click(within(exitDateGroup()).getAllByRole("spinbutton")[0]);
  await user.keyboard(digits);
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("DeactivateMemberDialog", () => {
  it("warns what deactivating does, names the member and starts with the focus on the reason", async () => {
    await renderDialog();

    expect(screen.getByText(`${MEMBER_NAME} deixa de participar do projeto`)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sai das opções de Nova alocação e perde o acesso ao sistema. O que já fez no projeto continua registrado.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(confirmButton()).toBeInTheDocument();
    await waitFor(() => expect(reasonField()).toHaveFocus());
  });

  it("asks the exit date, today by default, and warns against health data in the reason and the note", async () => {
    await renderDialog();

    expect(exitDateGroup()).toBeInTheDocument();
    expect(
      screen.getByText(
        "Aparece na lista de membros. Não escreva informações de saúde nem diagnósticos.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Fica guardada, mas não aparece em nenhuma tela. Não escreva informações de saúde nem diagnósticos.",
      ),
    ).toBeInTheDocument();
    expect(noteField()).toHaveValue("");
  });

  it("deactivates with the exit date of today, the reason and the note, and refreshes Nova alocação", async () => {
    const onCall = vi.fn();
    server.use(deactivateMemberHandler({ onCall }));
    const user = userEvent.setup();
    const { onClose, onDeactivated, queryClient } = await renderDialog();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.type(reasonField(), "  Formou-se.  ");
    await user.type(noteField(), "Vai fazer mestrado em outra cidade.");
    await user.click(confirmButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDeactivated).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledExactlyOnceWith({
      id: MEMBER_ID,
      body: {
        exitDate: todayInSaoPaulo(),
        reason: "Formou-se.",
        note: "Vai fazer mestrado em outra cidade.",
      },
    });
    expect(await screen.findByText(`Inativação de ${MEMBER_NAME} registrada.`)).toBeInTheDocument();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getGetMemberQueryKey(MEMBER_ID) });
    // The list of Membros and the members offered by Nova alocação (status=active) share this key.
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListMembersQueryKey() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListAccessQueryKey() });
  });

  it("leaves the note out when it is empty", async () => {
    const onCall = vi.fn();
    server.use(deactivateMemberHandler({ onCall }));
    const user = userEvent.setup();
    const { onClose } = await renderDialog();

    await user.type(reasonField(), "Mudou de cidade.");
    await user.click(confirmButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCall).toHaveBeenCalledExactlyOnceWith({
      id: MEMBER_ID,
      body: { exitDate: todayInSaoPaulo(), reason: "Mudou de cidade." },
    });
  });

  it("requires the reason, with the focus on it, and sends nothing", async () => {
    const onCall = vi.fn();
    server.use(deactivateMemberHandler({ onCall }));
    const user = userEvent.setup();
    const { onClose } = await renderDialog();

    await user.type(reasonField(), "   ");
    await user.click(confirmButton());

    expect(await screen.findByText("Informe o motivo da saída.")).toBeInTheDocument();
    expect(reasonField()).toHaveFocus();
    expect(onCall).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("refuses an exit date before the member joined the project", async () => {
    const onCall = vi.fn();
    server.use(deactivateMemberHandler({ onCall }));
    const user = userEvent.setup();
    await renderDialog();

    await typeExitDate(user, "01012024");
    await user.type(reasonField(), "Formou-se.");
    await user.click(confirmButton());

    expect(
      await screen.findByText("A saída não pode ser antes da entrada no projeto."),
    ).toBeInTheDocument();
    expect(onCall).not.toHaveBeenCalled();
  });

  it("refuses an exit date in the future", async () => {
    const onCall = vi.fn();
    server.use(deactivateMemberHandler({ onCall }));
    const user = userEvent.setup();
    await renderDialog();

    await typeExitDate(user, "01012099");
    await user.type(reasonField(), "Formou-se.");
    await user.click(confirmButton());

    expect(
      await screen.findByText("Informe uma data entre 01/01/2000 e hoje."),
    ).toBeInTheDocument();
    expect(onCall).not.toHaveBeenCalled();
  });

  it("puts the 400 EXIT_DATE_BEFORE_JOINED_AT of the API on the exit date", async () => {
    server.use(
      deactivateMemberHandler({ error: { statusCode: 400, error: "EXIT_DATE_BEFORE_JOINED_AT" } }),
    );
    const user = userEvent.setup();
    const { onClose } = await renderDialog({ ...MEMBER, joinedAt: null });

    await user.type(reasonField(), "Formou-se.");
    await user.click(confirmButton());

    expect(
      await screen.findByText("A saída não pode ser antes da entrada no projeto."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(exitDateGroup()).getAllByRole("spinbutton")[0]).toHaveFocus(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    [
      { statusCode: 409, error: "LAST_COORDINATOR" },
      "Esta é a última coordenação ativa. Promova outra pessoa a Coordenação antes de inativá-la.",
    ],
    [{ statusCode: 403, error: "OWN_ACCOUNT" }, "Você não pode inativar a própria conta."],
    [
      { statusCode: 409, error: "MEMBER_INACTIVE" },
      "Este membro já está inativo. Atualize a lista.",
    ],
    [{ statusCode: 500, error: "INTERNAL" }, "Não foi possível inativar. Tente de novo."],
  ])("says a refusal above the buttons and stays open: %o", async (error, message) => {
    server.use(deactivateMemberHandler({ error }));
    const user = userEvent.setup();
    const { onClose, onDeactivated } = await renderDialog();

    await user.type(reasonField(), "Formou-se.");
    await user.click(confirmButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    await waitFor(() => expect(alert.parentElement).toHaveFocus());
    expect(onClose).not.toHaveBeenCalled();
    expect(onDeactivated).not.toHaveBeenCalled();
  });

  it("says a network failure", async () => {
    server.use(deactivateMemberHandler({ networkError: true }));
    const user = userEvent.setup();
    await renderDialog();

    await user.type(reasonField(), "Formou-se.");
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conectar. Tente de novo.",
    );
  });

  it("Voltar closes without a request", async () => {
    const onCall = vi.fn();
    server.use(deactivateMemberHandler({ onCall }));
    const user = userEvent.setup();
    const { onClose } = await renderDialog();

    await user.type(reasonField(), "Formou-se.");
    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCall).not.toHaveBeenCalled();
  });

  it("blocks Voltar and Escape while deactivating, and sends it once", async () => {
    const deferred = createDeferred();
    const onCall = vi.fn();
    server.use(deactivateMemberHandler({ delay: deferred.promise, onCall }));
    const user = userEvent.setup();
    const { onClose } = await renderDialog();

    await user.type(reasonField(), "Formou-se.");
    await user.dblClick(confirmButton());
    await screen.findByRole("button", { name: "Inativando…" });

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();

    deferred.resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCall).toHaveBeenCalledTimes(1);
  });
});
