import { toastQueue } from "@heroui/react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast, ToastProvider } from "../Toast";

afterEach(() => {
  toast.clear();
  toastQueue.destroy();
});

function renderProvider() {
  return render(<ToastProvider regionLabel="Notificações" closeLabel="Fechar notificação" />);
}

describe("Toast", () => {
  it("shows a success message inside a named region", async () => {
    renderProvider();

    act(() => {
      toast.success("Plano de aula criado.");
    });

    const region = await screen.findByRole("region", { name: "Notificações" });
    expect(within(region).getByText("Plano de aula criado.")).toBeInTheDocument();
  });

  it("announces the message to assistive technology as an alert", async () => {
    renderProvider();

    act(() => {
      toast.success("Plano de aula criado.");
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Plano de aula criado.");
  });

  it("shows the description under the message", async () => {
    renderProvider();

    act(() => {
      toast.success("Plano de aula arquivado.", { description: "Ele saiu das novas sequências." });
    });

    expect(await screen.findByText("Plano de aula arquivado.")).toBeInTheDocument();
    expect(screen.getByText("Ele saiu das novas sequências.")).toBeInTheDocument();
  });

  it("shows an error message", async () => {
    renderProvider();

    act(() => {
      toast.error("Não foi possível reativar o plano.");
    });

    expect(await screen.findByText("Não foi possível reativar o plano.")).toBeInTheDocument();
  });

  it("closes with the close button, which has the label given to the provider", async () => {
    const user = userEvent.setup();
    renderProvider();

    act(() => {
      toast.success("Plano de aula criado.");
    });
    await screen.findByText("Plano de aula criado.");
    await user.click(screen.getByRole("button", { name: "Fechar notificação" }));

    expect(screen.queryByText("Plano de aula criado.")).not.toBeInTheDocument();
  });

  it("gives the close button a 44px touch target that is always visible", async () => {
    renderProvider();

    act(() => {
      toast.success("Plano de aula criado.");
    });

    const close = await screen.findByRole("button", { name: "Fechar notificação" });
    expect(close).toHaveClass("size-11", "opacity-100", "pointer-events-auto");
  });

  it("keeps the text at 16px", async () => {
    renderProvider();

    act(() => {
      toast.success("Plano de aula criado.", { description: "Detalhe" });
    });

    expect(await screen.findByText("Plano de aula criado.")).toHaveClass("text-base");
    expect(screen.getByText("Detalhe")).toHaveClass("text-base");
  });

  it("dismisses by itself after eight seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderProvider();

      act(() => {
        toast.success("Plano de aula criado.");
      });
      expect(await screen.findByText("Plano de aula criado.")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(7900);
      });
      expect(screen.getByText("Plano de aula criado.")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(screen.queryByText("Plano de aula criado.")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clear removes every message", async () => {
    renderProvider();

    act(() => {
      toast.success("Plano de aula criado.");
    });
    await screen.findByText("Plano de aula criado.");

    act(() => {
      toast.clear();
    });

    expect(screen.queryByText("Plano de aula criado.")).not.toBeInTheDocument();
  });
});
