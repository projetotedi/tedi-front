import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SortableList } from "../SortableList";

interface Item {
  id: string;
  name: string;
}

const ITEMS: Item[] = [
  { id: "a", name: "Alfa" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gama" },
];

interface HarnessProps {
  items?: Item[];
  onMove?: (key: string, toIndex: number) => void;
  withEmptyState?: boolean;
  isDisabled?: boolean;
}

function Harness({
  items = ITEMS,
  onMove = () => {},
  withEmptyState = false,
  isDisabled,
}: HarnessProps) {
  return (
    <SortableList
      aria-label="Fila"
      items={items}
      getKey={(item) => item.id}
      getTextValue={(item) => item.name}
      dragLabel={(item) => `Arrastar ${item.name}`}
      onMove={onMove}
      isDisabled={isDisabled}
      renderItem={(item, index) => (
        <>
          <span>{`${index + 1}. ${item.name}`}</span>
          <button type="button">{`Remover ${item.name}`}</button>
        </>
      )}
      renderEmptyState={withEmptyState ? () => <p>Nada por aqui</p> : undefined}
    />
  );
}

function rowTexts(): (string | null | undefined)[] {
  const rows = within(screen.getByRole("grid", { name: "Fila" })).getAllByRole("row");
  return rows.map((row) => within(row).getByText(/^\d\. /).textContent);
}

/** What has the focus: the name of the button or of the row (the rows are named by their text value). */
function focusedName(): string | null {
  return (
    document.activeElement?.getAttribute("aria-label") ??
    document.activeElement?.textContent ??
    null
  );
}

describe("SortableList", () => {
  it("renders a grid with one row per item in order", () => {
    render(<Harness />);

    expect(rowTexts()).toEqual(["1. Alfa", "2. Beta", "3. Gama"]);
  });

  it("follows the order of the items it receives", () => {
    const { rerender } = render(<Harness />);

    rerender(<Harness items={[ITEMS[2], ITEMS[0], ITEMS[1]]} />);

    expect(rowTexts()).toEqual(["1. Gama", "2. Alfa", "3. Beta"]);
  });

  it("each row has a labelled drag handle", () => {
    render(<Harness />);

    for (const { name } of ITEMS) {
      expect(screen.getByRole("button", { name: `Arrastar ${name}` })).toBeInTheDocument();
    }
  });

  it("makes the drag handle a 44px target", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Arrastar Alfa" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
  });

  it("shows the empty state when there are no items", () => {
    render(<Harness items={[]} withEmptyState />);

    expect(screen.getByText("Nada por aqui")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  describe("isDisabled", () => {
    const rows = () => within(screen.getByRole("grid", { name: "Fila" })).getAllByRole("row");

    it("lets the rows be dragged and the handles be used by default", () => {
      render(<Harness />);

      for (const row of rows()) expect(row).toHaveAttribute("draggable", "true");
      for (const { name } of ITEMS) {
        expect(screen.getByRole("button", { name: `Arrastar ${name}` })).toBeEnabled();
      }
    });

    it("turns the drag off: the rows are not draggable and the handles are disabled", () => {
      render(<Harness isDisabled />);

      for (const row of rows()) expect(row).not.toHaveAttribute("draggable");
      for (const { name } of ITEMS) {
        expect(screen.getByRole("button", { name: `Arrastar ${name}` })).toBeDisabled();
      }
    });

    it("turns the drag back on when it is enabled again", () => {
      const { rerender } = render(<Harness isDisabled />);

      rerender(<Harness isDisabled={false} />);

      for (const row of rows()) expect(row).toHaveAttribute("draggable", "true");
      expect(screen.getByRole("button", { name: "Arrastar Alfa" })).toBeEnabled();
    });

    it("does not disable what the rows draw: those buttons belong to who uses the list", () => {
      render(<Harness isDisabled />);

      expect(screen.getByRole("button", { name: "Remover Alfa" })).toBeEnabled();
    });

    it("Tab goes past the disabled handle, from the row to the button inside it", async () => {
      const user = userEvent.setup();
      render(<Harness isDisabled />);

      await user.tab();
      expect(focusedName()).toBe("Alfa");
      await user.tab();
      expect(focusedName()).toBe("Remover Alfa");
    });

    it("keeps the rows reachable with the arrow keys", async () => {
      const user = userEvent.setup();
      render(<Harness isDisabled />);

      await user.tab();
      await user.keyboard("{ArrowDown}");

      expect(focusedName()).toBe("Beta");
    });

    it("starts no drag from the keyboard: no drop target ever shows up", async () => {
      const user = userEvent.setup();
      const onMove = vi.fn();
      render(<Harness isDisabled onMove={onMove} />);

      // Row, then the button inside it (the handle is skipped). Enter presses that button.
      await user.tab();
      await user.tab();
      await user.keyboard("{Enter}");
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");

      expect(screen.queryByRole("button", { name: /^Insert/ })).not.toBeInTheDocument();
      expect(onMove).not.toHaveBeenCalled();
    });

    it("does not warn that the drag hooks changed between renders", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { rerender } = render(<Harness />);

      rerender(<Harness isDisabled />);
      rerender(<Harness isDisabled={false} />);

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe("keyboard navigation", () => {
    it("Tab reaches the buttons inside the row that has the focus, and the next Tab leaves the list", async () => {
      const user = userEvent.setup();
      render(
        <>
          <Harness />
          <button type="button">Depois da lista</button>
        </>,
      );

      await user.tab();
      expect(focusedName()).toBe("Alfa");
      await user.tab();
      expect(focusedName()).toBe("Arrastar Alfa");
      await user.tab();
      expect(focusedName()).toBe("Remover Alfa");
      await user.tab();
      expect(screen.getByRole("button", { name: "Depois da lista" })).toHaveFocus();
    });

    it("ArrowDown and ArrowUp choose the row, and Tab then reaches the buttons of that row", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.tab();
      await user.keyboard("{ArrowDown}");
      expect(focusedName()).toBe("Beta");
      await user.keyboard("{ArrowDown}");
      expect(focusedName()).toBe("Gama");
      await user.keyboard("{ArrowUp}");
      expect(focusedName()).toBe("Beta");

      await user.tab();
      expect(focusedName()).toBe("Arrastar Beta");
      await user.tab();
      expect(focusedName()).toBe("Remover Beta");
    });

    it("Enter on a button inside a row presses it and does not start anything else", async () => {
      const user = userEvent.setup();
      const onMove = vi.fn();
      const onRemove = vi.fn();
      render(
        <SortableList
          aria-label="Fila"
          items={ITEMS}
          getKey={(item) => item.id}
          getTextValue={(item) => item.name}
          dragLabel={(item) => `Arrastar ${item.name}`}
          onMove={onMove}
          renderItem={(item) => (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
            >{`Remover ${item.name}`}</button>
          )}
        />,
      );

      await user.tab();
      await user.tab();
      await user.tab();
      await user.keyboard("{Enter}");

      expect(onRemove).toHaveBeenCalledExactlyOnceWith("a");
      expect(onMove).not.toHaveBeenCalled();
    });
  });

  describe("Escape", () => {
    function renderInsideDialogLike(onKeyDown: (key: string) => void) {
      return render(
        <div onKeyDown={(event) => onKeyDown(event.key)}>
          <Harness />
        </div>,
      );
    }

    it("reaches what is around the list when it is pressed on a button of a row", async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      renderInsideDialogLike(onKeyDown);

      await user.tab();
      await user.tab();
      await user.tab();
      expect(focusedName()).toBe("Remover Alfa");
      onKeyDown.mockClear();
      await user.keyboard("{Escape}");

      expect(onKeyDown).toHaveBeenCalledExactlyOnceWith("Escape");
    });

    it("reaches what is around the list when it is pressed on the drag handle", async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      renderInsideDialogLike(onKeyDown);

      await user.tab();
      await user.tab();
      expect(focusedName()).toBe("Arrastar Alfa");
      onKeyDown.mockClear();
      await user.keyboard("{Escape}");

      expect(onKeyDown).toHaveBeenCalledExactlyOnceWith("Escape");
    });

    it("reaches what is around the list when it is pressed on the row itself", async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      renderInsideDialogLike(onKeyDown);

      await user.tab();
      expect(focusedName()).toBe("Alfa");
      onKeyDown.mockClear();
      await user.keyboard("{Escape}");

      expect(onKeyDown).toHaveBeenCalledExactlyOnceWith("Escape");
    });

    it("does not forward the other keys: the list keeps them", async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      renderInsideDialogLike(onKeyDown);

      await user.tab();
      await user.tab();
      await user.tab();
      onKeyDown.mockClear();
      await user.keyboard("{ArrowDown}");
      await user.keyboard("a");

      expect(onKeyDown).not.toHaveBeenCalled();
    });

    it("only cancels the drag, and does not reach what is around the list, when it is pressed during a keyboard drag", async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn();
      const onMove = vi.fn();
      render(
        <div onKeyDown={(event) => onKeyDown(event.key)}>
          <Harness onMove={onMove} />
        </div>,
      );

      await user.tab();
      await user.tab();
      await user.keyboard("{Enter}");
      await user.keyboard("{ArrowDown}");
      onKeyDown.mockClear();
      await user.keyboard("{Escape}");

      expect(onKeyDown).not.toHaveBeenCalledWith("Escape");
      expect(onMove).not.toHaveBeenCalled();
    });
  });

  describe("keyboard drag", () => {
    type User = ReturnType<typeof userEvent.setup>;

    /**
     * Picks up the item of the row `rowsDown` rows below the first one with its handle (Enter) and
     * walks the drop targets with ArrowDown until it reaches the one named `target`. The React Aria
     * names the targets ("Insert between Beta and Gama"), so the test does not depend on the order
     * in which it offers them.
     */
    async function dragTo(user: User, rowsDown: number, target: string) {
      await user.tab();
      for (let step = 0; step < rowsDown; step += 1) await user.keyboard("{ArrowDown}");
      await user.tab();
      await user.keyboard("{Enter}");

      for (let attempts = 0; attempts < 10; attempts += 1) {
        await user.keyboard("{ArrowDown}");
        if (document.activeElement?.getAttribute("aria-label") === target) break;
      }
      expect(document.activeElement).toHaveAccessibleName(target);
    }

    it("moves an item with the keyboard drag (Enter on the handle, ArrowDown to the target, Enter)", async () => {
      const user = userEvent.setup();
      const onMove = vi.fn();
      render(<Harness onMove={onMove} />);

      await dragTo(user, 0, "Insert between Beta and Gama");
      await user.keyboard("{Enter}");

      expect(onMove).toHaveBeenCalledExactlyOnceWith("a", 1);
    });

    it("moves an item to the end of the list", async () => {
      const user = userEvent.setup();
      const onMove = vi.fn();
      render(<Harness onMove={onMove} />);

      await dragTo(user, 0, "Insert after Gama");
      await user.keyboard("{Enter}");

      expect(onMove).toHaveBeenCalledExactlyOnceWith("a", 2);
    });

    it("moves an item to the start of the list", async () => {
      const user = userEvent.setup();
      const onMove = vi.fn();
      render(<Harness onMove={onMove} />);

      await dragTo(user, 2, "Insert before Alfa");
      await user.keyboard("{Enter}");

      expect(onMove).toHaveBeenCalledExactlyOnceWith("c", 0);
    });

    it("does not call onMove when the item is dropped where it already is", async () => {
      const user = userEvent.setup();
      const onMove = vi.fn();
      render(<Harness onMove={onMove} />);

      await dragTo(user, 1, "Insert between Beta and Gama");
      await user.keyboard("{Enter}");

      expect(onMove).not.toHaveBeenCalled();
    });

    it("cancels the drag with Escape", async () => {
      const user = userEvent.setup();
      const onMove = vi.fn();
      render(<Harness onMove={onMove} />);

      await dragTo(user, 0, "Insert after Gama");
      await user.keyboard("{Escape}");

      expect(onMove).not.toHaveBeenCalled();
    });
  });
});
