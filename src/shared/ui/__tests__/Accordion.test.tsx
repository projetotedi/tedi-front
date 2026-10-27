import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Accordion, type AccordionProps, type AccordionSection } from "../Accordion";

const sections: AccordionSection[] = [
  { id: "catalog", title: "Catálogo", icon: "catalog.svg", content: <a href="/courses">Cursos</a> },
  { id: "classes", title: "Turmas", content: <a href="/enrollments">Matrículas</a> },
];

type HarnessProps = Partial<Omit<AccordionProps, "expandedKeys">> & { initial?: string[] };

/** Guarda o estado de quem usa o `Accordion`, que é controlado. */
function Harness({ initial = [], onExpandedChange, ...props }: HarnessProps) {
  const [expandedKeys, setExpandedKeys] = useState(initial);

  return (
    <Accordion
      items={sections}
      expandedKeys={expandedKeys}
      onExpandedChange={(keys) => {
        setExpandedKeys(keys);
        onExpandedChange?.(keys);
      }}
      {...props}
    />
  );
}

describe("Accordion", () => {
  it("renders one button per section", () => {
    render(<Harness />);

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Catálogo",
      "Turmas",
    ]);
  });

  it("keeps the icon and the chevron out of the accessibility tree", () => {
    render(<Harness />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Catálogo" })).toBeInTheDocument();
  });

  it("exposes aria-expanded and aria-controls pointing to the panel", async () => {
    render(<Harness />);

    const button = screen.getByRole("button", { name: "Catálogo" });
    const panelId = button.getAttribute("aria-controls") as string;
    const panel = document.getElementById(panelId) as HTMLElement;

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("role", "group");
    expect(panel).toHaveAttribute("aria-labelledby", button.id);
    expect(panel).toHaveAttribute("aria-hidden", "true");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("group", { name: "Catálogo" })).toBe(panel);
  });

  it("toggles a section with the mouse", async () => {
    render(<Harness />);

    const button = screen.getByRole("button", { name: "Catálogo" });

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles a section with Enter and Space", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const button = screen.getByRole("button", { name: "Catálogo" });
    await user.tab();
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "true");

    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("hides the content of a collapsed section", async () => {
    render(<Harness />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Catálogo" }));

    expect(screen.getByRole("link", { name: "Cursos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Matrículas" })).not.toBeInTheDocument();
  });

  it("opens the sections listed in expandedKeys", () => {
    render(<Harness initial={["classes"]} />);

    expect(screen.getByRole("button", { name: "Turmas" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Catálogo" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("link", { name: "Matrículas" })).toBeInTheDocument();
  });

  it("calls onExpandedChange with string keys", async () => {
    const onExpandedChange = vi.fn();
    render(<Harness onExpandedChange={onExpandedChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Catálogo" }));
    expect(onExpandedChange).toHaveBeenLastCalledWith(["catalog"]);

    await userEvent.click(screen.getByRole("button", { name: "Turmas" }));
    expect(onExpandedChange).toHaveBeenLastCalledWith(["catalog", "classes"]);

    await userEvent.click(screen.getByRole("button", { name: "Catálogo" }));
    expect(onExpandedChange).toHaveBeenLastCalledWith(["classes"]);
  });

  it("opens one section at a time when allowsMultipleExpanded is off", async () => {
    render(<Harness allowsMultipleExpanded={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Catálogo" }));
    await userEvent.click(screen.getByRole("button", { name: "Turmas" }));

    expect(screen.getByRole("button", { name: "Catálogo" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Turmas" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the 48px row and the 16px font", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Catálogo" })).toHaveClass("min-h-12", "text-base");
  });
});
