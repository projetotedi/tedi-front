import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, getInitials } from "../Avatar";

describe("getInitials", () => {
  it("takes the first letter of the first and last names", () => {
    expect(getInitials("Ana Paula Torres")).toBe("AT");
  });

  it("uses a single letter for a single name", () => {
    expect(getInitials("maria")).toBe("M");
  });

  it("ignores extra spaces and empty names", () => {
    expect(getInitials("  João   Silva ")).toBe("JS");
    expect(getInitials("   ")).toBe("");
  });
});

describe("Avatar", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Avatar name="Ana Paula Torres" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container).toHaveTextContent("AT");
  });
});
