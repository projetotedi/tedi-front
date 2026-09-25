import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "../Badge";

describe("Badge", () => {
  it("renders its text", () => {
    render(<Badge tone="success">Ativo</Badge>);

    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it.each([
    ["neutral", "bg-tedi-neutral"],
    ["info", "bg-tedi-badge"],
    ["highlight", "bg-tedi-highlight"],
    ["success", "bg-tedi-badge-success"],
    ["warning", "bg-tedi-warning"],
    ["danger", "bg-tedi-danger"],
  ] as const)("applies the %s tone classes", (tone, expectedClass) => {
    render(<Badge tone={tone}>Rótulo</Badge>);

    expect(screen.getByText("Rótulo")).toHaveClass(expectedClass);
  });
});
