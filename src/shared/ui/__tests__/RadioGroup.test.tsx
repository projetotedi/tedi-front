import { createRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RadioGroup, type RadioGroupProps, type RadioOption } from "../RadioGroup";

const OPTIONS: RadioOption[] = [
  { value: "monitor", label: "Monitor(a)", description: "Apoia os alunos individualmente" },
  { value: "teacher", label: "Professor(a)", description: "Conduz a aula" },
];

function Harness({
  onChange,
  initialValue = null,
  ...props
}: Partial<Omit<RadioGroupProps, "value">> & { initialValue?: string | null }) {
  const [value, setValue] = useState<string | null>(initialValue);

  return (
    <RadioGroup
      label="Papel na aula"
      options={OPTIONS}
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("RadioGroup", () => {
  it("names the group by its label", () => {
    render(<Harness />);

    expect(screen.getByRole("radiogroup", { name: "Papel na aula" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("gives each radio its name and its description", () => {
    render(<Harness />);

    expect(screen.getByRole("radio", { name: "Monitor(a)" })).toHaveAccessibleDescription(
      "Apoia os alunos individualmente",
    );
    expect(screen.getByRole("radio", { name: "Professor(a)" })).toHaveAccessibleDescription(
      "Conduz a aula",
    );
  });

  it("starts with nothing chosen when the value is null", () => {
    render(<Harness />);

    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  it("shows the chosen option from the value", () => {
    render(<Harness initialValue="teacher" />);

    expect(screen.getByRole("radio", { name: "Professor(a)" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Monitor(a)" })).not.toBeChecked();
  });

  it("calls onChange with the value of the option that was clicked", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(screen.getByText("Professor(a)"));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("teacher");
    expect(screen.getByRole("radio", { name: "Professor(a)" })).toBeChecked();
  });

  it("moves the choice with the arrow keys", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initialValue="monitor" />);
    const monitor = screen.getByRole("radio", { name: "Monitor(a)" });
    monitor.focus();

    await userEvent.keyboard("{ArrowDown}");

    expect(onChange).toHaveBeenLastCalledWith("teacher");
    expect(screen.getByRole("radio", { name: "Professor(a)" })).toBeChecked();
  });

  it("disables an option: it is not chosen by the click nor by the arrow keys", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        onChange={onChange}
        initialValue="monitor"
        options={[
          OPTIONS[0],
          { ...OPTIONS[1], description: "Sem vaga nesta aula", isDisabled: true },
        ]}
      />,
    );
    const teacher = screen.getByRole("radio", { name: "Professor(a)" });
    expect(teacher).toBeDisabled();
    expect(teacher).toHaveAccessibleDescription("Sem vaga nesta aula");
    expect(screen.getByRole("radio", { name: "Monitor(a)" })).toBeEnabled();

    await userEvent.click(screen.getByText("Professor(a)"));
    screen.getByRole("radio", { name: "Monitor(a)" }).focus();
    await userEvent.keyboard("{ArrowDown}{ArrowRight}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Monitor(a)" })).toBeChecked();
    expect(teacher).not.toBeChecked();
  });

  it("disables the whole group", () => {
    render(<Harness isDisabled />);

    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });

  it("marks the group as required, with an asterisk drawn by the style of the label", () => {
    render(<Harness isRequired />);

    expect(screen.getByRole("radiogroup", { name: "Papel na aula" })).toBeRequired();
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-required", "true");
    expect(screen.getByRole("radiogroup").textContent).not.toContain("*");
  });

  it("keeps the asterisk and the red of an invalid group off the options: only the label of the group shows them", () => {
    render(<Harness isRequired errorMessage="Escolha o papel na aula." />);

    // The style of the label draws the asterisk on every label under a required element, and
    // paints it red under an invalid one; the options opt out of both.
    for (const name of ["Monitor(a)", "Professor(a)"]) {
      expect(screen.getByText(name)).toHaveClass("after:hidden", "text-foreground");
    }
    expect(screen.getByText("Papel na aula")).not.toHaveClass("after:hidden");
  });

  it("links the description to the group and hides it behind the error", () => {
    const { rerender } = render(<Harness description="Escolha uma das opções." />);
    expect(screen.getByRole("radiogroup")).toHaveAccessibleDescription("Escolha uma das opções.");

    rerender(
      <RadioGroup
        label="Papel na aula"
        options={OPTIONS}
        value={null}
        onChange={() => {}}
        description="Escolha uma das opções."
        errorMessage="Escolha o papel na aula."
      />,
    );

    expect(screen.queryByText("Escolha uma das opções.")).not.toBeInTheDocument();
  });

  it("makes the group invalid and described by the error", () => {
    render(<Harness errorMessage="Escolha o papel na aula." />);

    const group = screen.getByRole("radiogroup", { name: "Papel na aula" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Escolha o papel na aula.");
    expect(screen.getByText("Escolha o papel na aula.")).toBeVisible();
  });

  it("does not mark the group as invalid without an error message", () => {
    render(<Harness />);

    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("puts the ref on the first enabled option", () => {
    const inputRef = createRef<HTMLInputElement>();
    render(
      <Harness inputRef={inputRef} options={[{ ...OPTIONS[0], isDisabled: true }, OPTIONS[1]]} />,
    );

    expect(inputRef.current).toBe(screen.getByRole("radio", { name: "Professor(a)" }));
  });

  it("puts the ref on the first option when all of them are enabled", () => {
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness inputRef={inputRef} />);

    expect(inputRef.current).toBe(screen.getByRole("radio", { name: "Monitor(a)" }));
  });

  it("applies the name to the radios", () => {
    render(<Harness name="role" />);

    for (const radio of screen.getAllByRole("radio")) expect(radio).toHaveAttribute("name", "role");
  });

  it("keeps a 44px target and the 16px font on each option", () => {
    render(<Harness />);

    const label = screen.getByRole("radio", { name: "Monitor(a)" }).closest("label");
    expect(label).toHaveClass("min-h-11");
    expect(screen.getByText("Monitor(a)")).toHaveClass("text-base");
    expect(screen.getByText("Apoia os alunos individualmente")).toHaveClass("text-sm");
  });

  it("stacks the options in a row when the orientation is horizontal", () => {
    render(<Harness orientation="horizontal" />);

    const options = screen.getAllByRole("radio")[0].closest("[data-slot='radio']")?.parentElement;
    expect(options).toHaveClass("flex-wrap");
    expect(screen.getByRole("radiogroup")).toHaveClass("flex-col");
  });
});
