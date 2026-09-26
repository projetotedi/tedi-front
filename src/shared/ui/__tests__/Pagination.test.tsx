import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "../Pagination";

interface HarnessProps {
  initialPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

function Harness({ initialPage = 1, totalPages = 3, onPageChange }: HarnessProps) {
  const [page, setPage] = useState(initialPage);

  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      onPageChange={(next) => {
        setPage(next);
        onPageChange?.(next);
      }}
      label="Paginação da lista"
      previousLabel="Página anterior"
      nextLabel="Próxima página"
      pageLabel={(number) => `Página ${number}`}
    />
  );
}

describe("Pagination", () => {
  it("renders a named navigation and marks the current page", () => {
    render(<Harness initialPage={2} />);

    expect(screen.getByRole("navigation", { name: "Paginação da lista" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Página 1" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Página 3" })).not.toHaveAttribute("aria-current");
  });

  it("reports the pressed page and moves the current mark to it", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Harness onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "Página 3" }));

    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByRole("button", { name: "Página 3" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("previous and next move one page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Harness initialPage={2} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);

    await user.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });

  it("disables previous on the first page and next on the last", () => {
    const { unmount } = render(<Harness initialPage={1} />);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();
    unmount();

    render(<Harness initialPage={3} />);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  });

  it("shows ellipses when there are many pages", () => {
    render(<Harness initialPage={5} totalPages={10} />);

    expect(screen.getAllByText("…")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Página 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página 5" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Página 10" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Página 2" })).not.toBeInTheDocument();
  });

  it("keeps the 44px touch target and the 16px font on every button", () => {
    render(<Harness />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("min-h-11", "min-w-11", "text-base");
    }
  });

  it("marks the arrows as decorative", () => {
    render(<Harness initialPage={2} />);

    const arrows = screen.getByRole("navigation").querySelectorAll("button > img");
    expect(arrows).toHaveLength(2);
    for (const arrow of arrows) {
      expect(arrow).toHaveAttribute("alt", "");
      expect(arrow).toHaveAttribute("aria-hidden", "true");
    }
  });
});
