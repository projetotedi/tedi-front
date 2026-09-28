import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Dropdown } from "../Dropdown";

const items = [
  { id: "profile", label: "Perfil" },
  { id: "signOut", label: "Sair" },
];

describe("Dropdown", () => {
  it("opens with the keyboard, shows the header and runs the chosen item", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <Dropdown
        label="Menu do perfil"
        trigger={<span>Coordenadora</span>}
        header={<p>Ana Paula Torres</p>}
        items={items}
        onAction={onAction}
      />,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Menu do perfil" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Ana Paula Torres")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onAction).toHaveBeenCalledWith("signOut");
  });

  it("keeps a 44px touch target on the trigger and the items", async () => {
    render(
      <Dropdown label="Menu do perfil" trigger="Coordenadora" items={items} onAction={vi.fn()} />,
    );

    const trigger = screen.getByRole("button", { name: "Menu do perfil" });
    expect(trigger).toHaveClass("min-h-11");

    await userEvent.click(trigger);

    expect(await screen.findByRole("menuitem", { name: "Perfil" })).toHaveClass("min-h-11");
  });
});
