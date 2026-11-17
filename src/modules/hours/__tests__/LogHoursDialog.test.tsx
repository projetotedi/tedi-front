import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  getGetHoursOverviewQueryKey,
  getGetMemberHoursQueryKey,
  getGetMyHoursSummaryQueryKey,
  getListPendingHourEntriesQueryKey,
} from "@api/generated/hours/hours";

import { LogHoursButton } from "../components/LogHoursButton";
import { LogHoursDialog, type LogHoursDialogProps } from "../components/LogHoursDialog";
import {
  BEATRIZ_ID,
  BEATRIZ_NAME,
  logHoursForMemberHandler,
  logMyHoursHandler,
  type ApiErrorBody,
  type LogCall,
} from "./entries-handlers";
import {
  createDeferred,
  freezeToday,
  renderWithProviders,
  server,
  setupHoursEntriesTestServer,
} from "./entries-test-utils";

setupHoursEntriesTestServer();

const BEATRIZ = { id: BEATRIZ_ID, name: BEATRIZ_NAME };

const dialog = () => screen.getByRole("dialog", { name: /^Lançar horas/ });
const activityField = () => within(dialog()).getByRole("textbox", { name: /^Atividade/ });
const categorySelect = () => within(dialog()).getByRole("button", { name: /Categoria/ });
const dateField = () => within(dialog()).getByLabelText(/^Data/);
const hoursField = () => within(dialog()).getByRole("textbox", { name: /^Horas/ });
const notesField = () => within(dialog()).getByRole("textbox", { name: /^Observações/ });
const submitButton = () =>
  within(dialog()).getByRole("button", { name: /^(Lançar horas|Lançando…)$/ });
const cancelButton = () => within(dialog()).getByRole("button", { name: "Cancelar" });
const closeButton = () => within(dialog()).getByRole("button", { name: "Fechar" });

/** What a field says under it, by the id its input is described by. */
function errorOf(field: HTMLElement): string {
  const ids = field.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();
}

interface FormValues {
  activity?: string;
  category?: string | null;
  date?: string;
  hours?: string;
  notes?: string;
}

/** The values of the Figma, with the category the API takes (Planejamento: Aula is never offered). */
const FIGMA_OWN: Required<FormValues> = {
  activity: "Preparação de material da aula 12",
  category: "Planejamento",
  date: "2026-03-10",
  hours: "2h30",
  notes: "Revisão do roteiro e ajustes nos slides da aula.",
};

const FIGMA_ON_BEHALF: Required<FormValues> = {
  activity: "Montagem do estande da feira de tecnologia",
  category: "Evento",
  date: "2026-03-10",
  hours: "3h",
  notes: "Beatriz não conseguiu lançar; horas confirmadas pela diretoria.",
};

async function fill(user: UserEvent, values: FormValues) {
  if (values.activity) await user.type(activityField(), values.activity);
  if (values.category) {
    await user.click(categorySelect());
    await user.click(await screen.findByRole("option", { name: values.category }));
  }
  // The native date field has no picker in jsdom: it is filled with `change`.
  if (values.date !== undefined) fireEvent.change(dateField(), { target: { value: values.date } });
  if (values.hours) await user.type(hoursField(), values.hours);
  if (values.notes) await user.type(notesField(), values.notes);
}

async function renderDialog(props: Partial<LogHoursDialogProps> = {}) {
  const onClose = vi.fn();
  const onLogged = vi.fn();
  const view = await renderWithProviders(
    <LogHoursDialog onClose={onClose} onLogged={onLogged} {...props} />,
  );
  await screen.findByRole("dialog", { name: /^Lançar horas/ });
  return { ...view, onClose, onLogged };
}

/** The alert of the dialog that took the focus (the toast is a live region too, outside it). */
function focusedIssue(): HTMLElement {
  const issue = within(dialog()).getByText(
    /Não foi possível|Você não pode|Não encontramos|Para lançar/,
  );
  const box = issue.closest<HTMLElement>("[tabindex='-1']");
  if (box === null) throw new Error("The issue is not in a focusable box");
  return box;
}

describe("LogHoursDialog", () => {
  freezeToday();

  describe("own", () => {
    it("opens with today in Data, the other fields empty and the focus on Atividade", async () => {
      await renderDialog();

      expect(dateField()).toHaveValue("2026-03-16");
      expect(activityField()).toHaveValue("");
      expect(hoursField()).toHaveValue("");
      expect(notesField()).toHaveValue("");
      expect(categorySelect()).toHaveTextContent("Selecione a categoria");
      await waitFor(() => expect(activityField()).toHaveFocus());
    });

    it("offers Planejamento, Evento, Gestão, Reunião, Atendimento and Outros, without Aula", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(categorySelect());

      const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
      expect(options).toEqual([
        "Planejamento",
        "Evento",
        "Gestão",
        "Reunião",
        "Atendimento",
        "Outros",
      ]);
    });

    it("marks Atividade, Categoria, Data and Horas as required, and Observações not", async () => {
      await renderDialog();

      expect(activityField()).toBeRequired();
      expect(dateField()).toBeRequired();
      expect(hoursField()).toBeRequired();
      expect(notesField()).not.toBeRequired();
      // The select has no native required input: its field carries the mark the asterisk is drawn from.
      expect(
        within(dialog()).getByText("Categoria").closest("[data-slot='select']"),
      ).toHaveAttribute("data-required", "true");
    });

    it("has no Vínculo field", async () => {
      await renderDialog();

      expect(screen.queryByText(/Vínculo/)).not.toBeInTheDocument();
      expect(within(dialog()).getAllByRole("textbox")).toHaveLength(3);
    });

    it("sends POST /me/hour-entries with 150 minutes for 2h30, the trimmed activity and the notes", async () => {
      const onMine = vi.fn<(call: LogCall) => void>();
      const onMember = vi.fn<(call: LogCall) => void>();
      server.use(
        logMyHoursHandler({ onCall: onMine }),
        logHoursForMemberHandler({ onCall: onMember }),
      );
      const user = userEvent.setup();
      const { onClose, onLogged } = await renderDialog();

      await fill(user, { ...FIGMA_OWN, activity: `  ${FIGMA_OWN.activity}  ` });
      await user.click(submitButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onMine).toHaveBeenCalledExactlyOnceWith({
        memberId: null,
        body: {
          activity: "Preparação de material da aula 12",
          category: "planning",
          date: "2026-03-10",
          declaredMinutes: 150,
          notes: "Revisão do roteiro e ajustes nos slides da aula.",
        },
      });
      expect(onMember).not.toHaveBeenCalled();
      expect(onLogged).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending", declaredMinutes: 150 }),
      );
    });

    it("sends the notes as null when left blank", async () => {
      const onCall = vi.fn<(call: LogCall) => void>();
      server.use(logMyHoursHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await fill(user, { ...FIGMA_OWN, notes: "" });
      await user.type(notesField(), "   ");
      await user.click(submitButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        memberId: null,
        body: expect.objectContaining({ notes: null }),
      });
    });

    it("shows the error of each required field, focuses Atividade and sends nothing", async () => {
      const onCall = vi.fn<(call: LogCall) => void>();
      server.use(logMyHoursHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      fireEvent.change(dateField(), { target: { value: "" } });
      await user.click(submitButton());

      expect(await within(dialog()).findByText("Descreva a atividade.")).toBeInTheDocument();
      expect(within(dialog()).getByText("Escolha a categoria.")).toBeInTheDocument();
      expect(errorOf(dateField())).toBe("Informe a data.");
      expect(errorOf(hoursField())).toBe("Informe as horas.");
      expect(errorOf(activityField())).toBe("Descreva a atividade.");
      await waitFor(() => expect(activityField()).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("focuses Categoria when it is the first invalid field", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await fill(user, { activity: "Reunião de planejamento", hours: "1h" });
      await user.click(submitButton());

      expect(await within(dialog()).findByText("Escolha a categoria.")).toBeInTheDocument();
      await waitFor(() => expect(categorySelect()).toHaveFocus());
    });

    it("says Use o formato 2h30. for 2:30, and Informe de 0h01 a 24h. for 0h", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await fill(user, { ...FIGMA_OWN, hours: "2:30" });
      await user.click(submitButton());

      await waitFor(() => expect(errorOf(hoursField())).toBe("Use o formato 2h30."));
      await waitFor(() => expect(hoursField()).toHaveFocus());

      await user.clear(hoursField());
      await user.type(hoursField(), "0h");
      await user.click(submitButton());

      await waitFor(() => expect(errorOf(hoursField())).toBe("Informe de 0h01 a 24h."));
    });

    it("refuses a date after today", async () => {
      const onCall = vi.fn<(call: LogCall) => void>();
      server.use(logMyHoursHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await fill(user, { ...FIGMA_OWN, date: "2026-03-17" });
      await user.click(submitButton());

      await waitFor(() => expect(errorOf(dateField())).toBe("A data não pode ser depois de hoje."));
      await waitFor(() => expect(dateField()).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
    });

    it("shows the toast with the hours and the day, closes and gives the focus back", async () => {
      server.use(logMyHoursHandler());
      const user = userEvent.setup();
      await renderWithProviders(<LogHoursButton />);
      const button = screen.getByRole("button", { name: "Lançar horas" });
      await user.click(button);
      await screen.findByRole("dialog", { name: "Lançar horas" });

      await fill(user, FIGMA_OWN);
      await user.click(submitButton());

      expect(await screen.findByText("Horas lançadas")).toBeInTheDocument();
      expect(
        screen.getByText("2h30 em 10/03, aguardando a validação da coordenação."),
      ).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(button).toHaveFocus());
    });

    it("while sending, says Lançando…, ignores a second press and keeps X, Esc and Cancelar off", async () => {
      const response = createDeferred();
      const onCall = vi.fn<(call: LogCall) => void>();
      server.use(logMyHoursHandler({ delay: response.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await fill(user, FIGMA_OWN);
      await user.click(submitButton());
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));

      expect(submitButton()).toHaveTextContent("Lançando…");
      expect(cancelButton()).toBeDisabled();
      expect(closeButton()).toBeDisabled();
      expect(dialog().querySelector("form")).toHaveAttribute("aria-busy", "true");
      await user.keyboard("{Escape}");
      await user.click(cancelButton());
      await user.click(submitButton());
      expect(onClose).not.toHaveBeenCalled();
      expect(onCall).toHaveBeenCalledTimes(1);

      response.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("sends once when Lançar horas is pressed twice before the first answer", async () => {
      const response = createDeferred();
      const onCall = vi.fn<(call: LogCall) => void>();
      server.use(logMyHoursHandler({ delay: response.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();
      await fill(user, FIGMA_OWN);

      // Two presses in the same tick: the button is not off yet, because the validation of the
      // form runs before anything is sent.
      fireEvent.click(submitButton());
      fireEvent.click(submitButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      response.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("closes with the X while nothing is being sent, and sends nothing", async () => {
      const onCall = vi.fn<(call: LogCall) => void>();
      server.use(logMyHoursHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(closeButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });

    it("closes with Esc while nothing is being sent, and sends nothing", async () => {
      const onCall = vi.fn<(call: LogCall) => void>();
      server.use(logMyHoursHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();
      await waitFor(() => expect(activityField()).toHaveFocus());

      await user.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });

    it("puts a 400 VALIDATION_FAILED on the fields it points at, with the focus on the first", async () => {
      const error: ApiErrorBody = {
        statusCode: 400,
        error: "VALIDATION_FAILED",
        details: [
          { field: "declaredMinutes", message: "declaredMinutes must not be greater than 1440" },
          { field: "activity", message: "activity should not be empty" },
        ],
      };
      server.use(logMyHoursHandler({ error }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await fill(user, FIGMA_OWN);
      await user.click(submitButton());

      await waitFor(() => expect(errorOf(activityField())).toBe("Confira este campo."));
      expect(errorOf(hoursField())).toBe("Confira este campo.");
      expect(errorOf(notesField())).toBe("");
      await waitFor(() => expect(activityField()).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("puts 400 HOUR_ENTRY_DATE_IN_FUTURE on Data", async () => {
      server.use(
        logMyHoursHandler({ error: { statusCode: 400, error: "HOUR_ENTRY_DATE_IN_FUTURE" } }),
      );
      const user = userEvent.setup();
      await renderDialog();

      await fill(user, { ...FIGMA_OWN, date: "2026-03-16" });
      await user.click(submitButton());

      await waitFor(() => expect(errorOf(dateField())).toBe("A data não pode ser depois de hoje."));
      await waitFor(() => expect(dateField()).toHaveFocus());
    });

    it("shows a network failure as an alert with the focus, and a new attempt clears it", async () => {
      server.use(logMyHoursHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await fill(user, FIGMA_OWN);
      await user.click(submitButton());

      const alert = await within(dialog()).findByRole("alert");
      expect(alert).toHaveTextContent(
        "Não foi possível lançar as horas. Verifique a conexão e tente de novo.",
      );
      await waitFor(() => expect(focusedIssue()).toHaveFocus());
      expect(submitButton()).toBeEnabled();

      const response = createDeferred();
      server.use(logMyHoursHandler({ delay: response.promise }));
      await user.click(submitButton());

      await waitFor(() => expect(submitButton()).toHaveTextContent("Lançando…"));
      expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
      response.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe("on behalf of a member", () => {
    it("is titled Lançar horas para Beatriz Nunes Carvalho and described by the notice", async () => {
      await renderDialog({ member: BEATRIZ });

      const named = screen.getByRole("dialog", {
        name: "Lançar horas para Beatriz Nunes Carvalho",
      });
      expect(named).toHaveAccessibleDescription(
        /Você está lançando em nome de Beatriz Nunes Carvalho\./,
      );
      expect(named).toHaveAccessibleDescription(
        /Fica registrado quem fez o lançamento, e ele entra como pendente de validação da coordenação\./,
      );
      const notice = within(named).getByText(/Você está lançando em nome de/);
      expect(
        notice.compareDocumentPosition(activityField()) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("sends POST /members/:id/hour-entries for that member and never /me/hour-entries", async () => {
      const onMine = vi.fn<(call: LogCall) => void>();
      const onMember = vi.fn<(call: LogCall) => void>();
      server.use(
        logMyHoursHandler({ onCall: onMine }),
        logHoursForMemberHandler({ onCall: onMember }),
      );
      const user = userEvent.setup();
      const { onClose, onLogged } = await renderDialog({ member: BEATRIZ });

      await fill(user, FIGMA_ON_BEHALF);
      await user.click(submitButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onMember).toHaveBeenCalledExactlyOnceWith({
        memberId: BEATRIZ_ID,
        body: {
          activity: "Montagem do estande da feira de tecnologia",
          category: "event",
          date: "2026-03-10",
          declaredMinutes: 180,
          notes: "Beatriz não conseguiu lançar; horas confirmadas pela diretoria.",
        },
      });
      expect(onMine).not.toHaveBeenCalled();
      expect(onLogged).toHaveBeenCalledWith(
        expect.objectContaining({ personId: BEATRIZ_ID, origin: "on_behalf" }),
      );
    });

    it("says Horas lançadas para Beatriz Nunes Carvalho in the toast", async () => {
      server.use(logHoursForMemberHandler());
      const user = userEvent.setup();
      await renderDialog({ member: BEATRIZ });

      await fill(user, FIGMA_ON_BEHALF);
      await user.click(submitButton());

      expect(
        await screen.findByText("Horas lançadas para Beatriz Nunes Carvalho"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("3h em 10/03, aguardando a validação da coordenação."),
      ).toBeInTheDocument();
    });

    it("invalidates the hours of that member, the queue and the overview, and not my hours", async () => {
      server.use(logHoursForMemberHandler());
      const user = userEvent.setup();
      const { queryClient, onClose } = await renderDialog({ member: BEATRIZ });
      const memberHours = getGetMemberHoursQueryKey(BEATRIZ_ID, { page: 1 });
      const myHours = getGetMyHoursSummaryQueryKey();
      const queue = getListPendingHourEntriesQueryKey();
      const overview = getGetHoursOverviewQueryKey();
      for (const queryKey of [memberHours, myHours, queue, overview]) {
        queryClient.setQueryData(queryKey, { cached: true });
      }

      await fill(user, FIGMA_ON_BEHALF);
      await user.click(submitButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(queryClient.getQueryState(memberHours)?.isInvalidated).toBe(true));
      expect(queryClient.getQueryState(queue)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(overview)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(myHours)?.isInvalidated).toBe(false);
    });

    it("shows 403 FORBIDDEN_SCOPE as an alert, with the focus, and turns Lançar horas off", async () => {
      server.use(
        logHoursForMemberHandler({ error: { statusCode: 403, error: "FORBIDDEN_SCOPE" } }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderDialog({ member: BEATRIZ });

      await fill(user, FIGMA_ON_BEHALF);
      await user.click(submitButton());

      const alert = await within(dialog()).findByRole("alert");
      expect(alert).toHaveTextContent("Você não pode lançar horas para esta pessoa.");
      await waitFor(() => expect(focusedIssue()).toHaveFocus());
      expect(submitButton()).toBeDisabled();
      expect(submitButton()).toHaveAccessibleDescription(
        "Você não pode lançar horas para esta pessoa.",
      );
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows 404 MEMBER_NOT_FOUND as an alert and turns Lançar horas off", async () => {
      server.use(
        logHoursForMemberHandler({ error: { statusCode: 404, error: "MEMBER_NOT_FOUND" } }),
      );
      const user = userEvent.setup();
      await renderDialog({ member: BEATRIZ });

      await fill(user, FIGMA_ON_BEHALF);
      await user.click(submitButton());

      const alert = await within(dialog()).findByRole("alert");
      expect(alert).toHaveTextContent(
        "Não encontramos este membro. Atualize a página e tente de novo.",
      );
      await waitFor(() => expect(focusedIssue()).toHaveFocus());
      expect(submitButton()).toBeDisabled();
    });

    it("shows 400 SELF_ON_BEHALF_NOT_ALLOWED as a warning and turns Lançar horas off", async () => {
      server.use(
        logHoursForMemberHandler({
          error: { statusCode: 400, error: "SELF_ON_BEHALF_NOT_ALLOWED" },
        }),
      );
      const user = userEvent.setup();
      await renderDialog({ member: BEATRIZ });

      await fill(user, FIGMA_ON_BEHALF);
      await user.click(submitButton());

      expect(
        await within(dialog()).findByText(
          "Para lançar as suas próprias horas, use + Lançar horas no Meu perfil.",
        ),
      ).toBeInTheDocument();
      // A warning is not an alert: it is read because it takes the focus.
      expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(focusedIssue()).toHaveFocus());
      expect(submitButton()).toBeDisabled();
    });
  });
});
