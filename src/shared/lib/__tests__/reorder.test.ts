import { describe, expect, it } from "vitest";

import { dropIndex, moveItem } from "../reorder";

describe("moveItem", () => {
  it("moves an item forward to the index it ends up at", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("swaps two neighbours, which is what the arrow buttons do", () => {
    expect(moveItem(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"]);
  });

  it("moves to the first and to the last place", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("keeps the order when the item stays where it is", () => {
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });

  it("returns a new array and never changes the one it receives", () => {
    const items = ["a", "b", "c"];

    const moved = moveItem(items, 0, 2);
    const same = moveItem(items, 1, 1);

    expect(items).toEqual(["a", "b", "c"]);
    expect(moved).not.toBe(items);
    expect(same).not.toBe(items);
  });

  it.each([
    ["before the start", -1, 1],
    ["after the end", 3, 1],
    ["to before the start", 1, -1],
    ["to after the end", 1, 3],
    ["not an integer", 0.5, 1],
    ["not a number", Number.NaN, 1],
  ])("leaves the order alone when `from` or `to` is %s", (_label, from, to) => {
    expect(moveItem(["a", "b", "c"], from, to)).toEqual(["a", "b", "c"]);
  });

  it("leaves an empty list empty and a list of one as it is", () => {
    expect(moveItem([], 0, 0)).toEqual([]);
    expect(moveItem(["a"], 0, 0)).toEqual(["a"]);
    expect(moveItem(["a"], 0, 1)).toEqual(["a"]);
  });

  it("works with objects", () => {
    const first = { id: 1 };
    const second = { id: 2 };

    expect(moveItem([first, second], 0, 1)).toEqual([second, first]);
  });
});

describe("dropIndex", () => {
  const keys = ["a", "b", "c", "d"];

  it("counts the target as it is once the dragged item left, going down (after)", () => {
    // Dragging "a" below "c": without "a" the list is [b, c, d] and "c" is at 1, so "a" lands at 2.
    expect(dropIndex(keys, "a", "c", "after")).toBe(2);
  });

  it("counts the target as it is once the dragged item left, going down (before)", () => {
    // Above "c" it stays right before it: [b, a, c, d].
    expect(dropIndex(keys, "a", "c", "before")).toBe(1);
  });

  it("does not discount anything going up (before)", () => {
    // "d" above "b": the list without "d" is [a, b, c], and "b" is at 1.
    expect(dropIndex(keys, "d", "b", "before")).toBe(1);
  });

  it("does not discount anything going up (after)", () => {
    expect(dropIndex(keys, "d", "a", "after")).toBe(1);
  });

  it("drops at the very start and at the very end", () => {
    expect(dropIndex(keys, "c", "a", "before")).toBe(0);
    expect(dropIndex(keys, "a", "d", "after")).toBe(3);
  });

  it("gives the own index when it is dropped next to where it already is", () => {
    expect(dropIndex(keys, "b", "c", "before")).toBe(1);
    expect(dropIndex(keys, "b", "a", "after")).toBe(1);
  });

  it("gives the own index when it is dropped on itself", () => {
    expect(dropIndex(keys, "c", "c", "before")).toBe(2);
    expect(dropIndex(keys, "c", "c", "after")).toBe(2);
  });

  it("gives the own index when the target is not in the list", () => {
    expect(dropIndex(keys, "b", "z", "after")).toBe(1);
  });

  it("gives -1 when the dragged item is not in the list, which moveItem ignores", () => {
    const index = dropIndex(keys, "z", "a", "before");

    expect(index).toBe(-1);
    expect(moveItem(keys, keys.indexOf("z"), index)).toEqual(keys);
  });

  const pairs = keys.flatMap((dragged) =>
    keys.filter((target) => target !== dragged).map((target) => [dragged, target] as const),
  );

  it.each(pairs)(
    "puts %s right before and right after %s when combined with moveItem",
    (dragged, target) => {
      const from = keys.indexOf(dragged);
      const before = moveItem(keys, from, dropIndex(keys, dragged, target, "before"));
      const after = moveItem(keys, from, dropIndex(keys, dragged, target, "after"));

      expect(before.indexOf(dragged)).toBe(before.indexOf(target) - 1);
      expect(after.indexOf(dragged)).toBe(after.indexOf(target) + 1);
    },
  );
});
