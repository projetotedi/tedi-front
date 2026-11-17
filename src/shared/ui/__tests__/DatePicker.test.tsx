import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import i18n from "@shared/i18n";

import { DatePicker, type DatePickerProps } from "../DatePicker";

function Harness({
  initial = "",
  onChange,
  ...props
}: Partial<Omit<DatePickerProps, "value">> & { initial?: string }) {
  const [value, setValue] = useState(initial);

  return (
    <DatePicker
      label="Data de início"
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const group = () => screen.getByRole("group", { name: /Data de início/ });
const segments = () => within(group()).getAllByRole("spinbutton");

describe("DatePicker", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("shows the day in the order of the language: day, month and year", () => {
    render(<Harness initial="2026-03-07" />);

    expect(segments().map((segment) => segment.getAttribute("aria-valuenow"))).toEqual([
      "7",
      "3",
      "2026",
    ]);
  });

  it("gives the typed day as YYYY-MM-DD", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(segments()[0]);
    await user.keyboard("03032026");

    expect(onChange).toHaveBeenLastCalledWith("2026-03-03");
  });

  it("opens the calendar from the button and gives the picked day", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2026-03-07" onChange={onChange} />);

    await user.click(within(group()).getByRole("button"));
    const calendar = await screen.findByRole("grid");
    await user.click(within(calendar).getByRole("button", { name: /10 de março de 2026/ }));

    expect(onChange).toHaveBeenLastCalledWith("2026-03-10");
  });

  it("shows the error and marks the field invalid", () => {
    render(<Harness errorMessage="Campo obrigatório." />);

    expect(screen.getByText("Campo obrigatório.")).toBeInTheDocument();
  });

  it("reads an empty or broken value as no day", () => {
    render(<Harness initial="não é data" />);

    expect(segments().every((segment) => !segment.hasAttribute("aria-valuenow"))).toBe(true);
  });
});
