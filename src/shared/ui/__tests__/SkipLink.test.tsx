import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SkipLink } from "../SkipLink";

function renderPage({ withTarget = true } = {}) {
  return render(
    <>
      <SkipLink targetId="main-content" label="Pular para o conteúdo" />
      <nav>
        <a href="/courses">Cursos</a>
      </nav>
      {withTarget && (
        <main id="main-content" tabIndex={-1}>
          <p>Conteúdo da página</p>
        </main>
      )}
    </>,
  );
}

describe("SkipLink", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("points to the target with the href", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveAttribute(
      "href",
      "#main-content",
    );
  });

  it("is hidden until it receives the focus", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveClass(
      "sr-only",
      "focus:not-sr-only",
    );
  });

  it("moves the focus to the target when activated", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.tab();
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("moves the focus to the target when clicked", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("link", { name: "Pular para o conteúdo" }));

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("does not change the URL", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.tab();
    await user.keyboard("{Enter}");

    expect(window.location.hash).toBe("");
  });

  it("does nothing when the target does not exist", async () => {
    const user = userEvent.setup();
    renderPage({ withTarget: false });

    const link = screen.getByRole("link", { name: "Pular para o conteúdo" });
    await user.tab();
    await user.keyboard("{Enter}");

    expect(link).toHaveFocus();
    expect(window.location.hash).toBe("");
  });
});
