import { toastQueue } from "@heroui/react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import i18n from "@shared/i18n";
import { toast } from "@shared/ui";

import { AppProviders } from "../providers";

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
});

afterEach(() => {
  toast.clear();
  toastQueue.destroy();
});

describe("AppProviders", () => {
  it("renders its children", () => {
    render(
      <AppProviders>
        <p>Conteúdo do app</p>
      </AppProviders>,
    );

    expect(screen.getByText("Conteúdo do app")).toBeInTheDocument();
  });

  it("mounts the toast region, so any module can show a toast", async () => {
    render(
      <AppProviders>
        <p>Conteúdo do app</p>
      </AppProviders>,
    );

    act(() => {
      toast.success("Plano de aula criado.");
    });

    const region = await screen.findByRole("region", { name: "Notificações" });
    expect(within(region).getByText("Plano de aula criado.")).toBeInTheDocument();
  });

  it("labels the close button in the current language", async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <p>Conteúdo do app</p>
      </AppProviders>,
    );

    act(() => {
      toast.success("Plano de aula criado.");
    });
    await user.click(await screen.findByRole("button", { name: "Fechar notificação" }));

    expect(screen.queryByText("Plano de aula criado.")).not.toBeInTheDocument();
  });
});
