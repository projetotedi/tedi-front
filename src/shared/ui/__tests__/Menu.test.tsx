import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Menu, type MenuProps } from "../Menu";

function renderMenu(props: Partial<MenuProps> = {}) {
  const onSignOut = vi.fn();
  const onSettings = vi.fn();
  render(
    <Menu
      triggerLabel="Menu do perfil"
      menuLabel="Opções do perfil"
      trigger={<span>CO</span>}
      items={[
        { id: "settings", label: "Configurações", onAction: onSettings },
        { id: "sign-out", label: "Sair", onAction: onSignOut },
      ]}
      {...props}
    />,
  );
  return { onSignOut, onSettings };
}

describe("Menu", () => {
  it("names the trigger by its label and starts closed", () => {
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Menu do perfil" });
    expect(trigger).toHaveAttribute("aria-haspopup");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens a named menu with the items", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Menu do perfil" }));

    // O React Aria nomeia o menu pelo gatilho (`aria-labelledby`), que vence o `aria-label`.
    const menu = await screen.findByRole("menu", { name: "Menu do perfil" });
    expect(menu).toHaveAttribute("aria-label", "Opções do perfil");
    expect(screen.getByRole("menuitem", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sair" })).toBeInTheDocument();
  });

  it("calls the chosen action and closes the menu", async () => {
    const user = userEvent.setup();
    const { onSignOut, onSettings } = renderMenu();

    await user.click(screen.getByRole("button", { name: "Menu do perfil" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sair" }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSettings).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens with Enter and focuses the first item", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.tab();
    expect(screen.getByRole("button", { name: "Menu do perfil" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("menuitem", { name: "Configurações" })).toHaveFocus();
  });

  it("chooses an item with the keyboard and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const { onSignOut } = renderMenu();

    await user.tab();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // O React Aria devolve o foco ao gatilho no próximo quadro de animação.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Menu do perfil" })).toHaveFocus(),
    );
  });

  it("closes with Escape without calling any action", async () => {
    const user = userEvent.setup();
    const { onSignOut, onSettings } = renderMenu();

    await user.click(screen.getByRole("button", { name: "Menu do perfil" }));
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onSignOut).not.toHaveBeenCalled();
    expect(onSettings).not.toHaveBeenCalled();
  });

  it("keeps the 44px touch target on the trigger and on every item", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Menu do perfil" });
    expect(trigger).toHaveClass("min-h-11");

    await user.click(trigger);
    for (const item of await screen.findAllByRole("menuitem")) {
      expect(item).toHaveClass("min-h-11", "text-base");
    }
  });
});
