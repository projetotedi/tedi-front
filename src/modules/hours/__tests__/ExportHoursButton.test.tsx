import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMeUser } from "@modules/auth/__tests__/handlers";
import { Role } from "@shared/lib/role";

import { ExportHoursButton } from "../components/ExportHoursButton";
import { apiError, createBankSpies, requestsTo } from "./bank-handlers";
import { createDeferred, renderBankUi, setupBankTestServer } from "./bank-test-utils";

setupBankTestServer();

describe("ExportHoursButton", () => {
  const downloads: string[] = [];

  beforeEach(() => {
    // jsdom has no object URLs and does not follow a download link.
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:hours"),
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    downloads.length = 0;
  });

  it("downloads the CSV of the period with the name the API gave it", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    await renderBankUi(<ExportHoursButton period="2026-03" scope="view" />, { spies });

    await user.click(screen.getByRole("button", { name: "Exportar relatório" }));

    await waitFor(() => expect(downloads).toEqual(["hours_2026-03-01_2026-03-31.csv"]));
    const [request] = requestsTo(spies, "GET", "/hours/export");
    expect(Object.fromEntries(request.url.searchParams)).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
      format: "csv",
    });
  });

  it("keeps the button busy while the file is on its way", async () => {
    const user = userEvent.setup();
    const gate = createDeferred();
    await renderBankUi(<ExportHoursButton period="2026-03" scope="view" />, {
      extraHandlers: [
        http.get("*/hours/export", async () => {
          await gate.promise;
        }),
      ],
    });
    const button = screen.getByRole("button", { name: "Exportar relatório" });

    await user.click(button);

    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
    expect(downloads).toEqual([]);

    gate.resolve();

    await waitFor(() => expect(downloads).toHaveLength(1));
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled"));
  });

  it("falls back to banco-de-horas-2026-03.csv when the API sends no name", async () => {
    const user = userEvent.setup();
    await renderBankUi(<ExportHoursButton period="2026-03" scope="view" />, {
      extraHandlers: [
        http.get(
          "*/hours/export",
          () =>
            new HttpResponse("data;membro\r\n", {
              headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment" },
            }),
        ),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Exportar relatório" }));

    await waitFor(() => expect(downloads).toEqual(["banco-de-horas-2026-03.csv"]));
  });

  it("tells the person when the export fails", async () => {
    const user = userEvent.setup();
    await renderBankUi(<ExportHoursButton period="2026-03" scope="view" />, {
      extraHandlers: [http.get("*/hours/export", () => apiError(400, "INVALID_PERIOD"))],
    });

    await user.click(screen.getByRole("button", { name: "Exportar relatório" }));

    expect(await screen.findByText("Não foi possível exportar o relatório.")).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it("is not shown without hours.export", async () => {
    await renderBankUi(<ExportHoursButton period="2026-03" scope="view" />, {
      user: buildMeUser({ role: Role.member }),
    });

    expect(screen.queryByRole("button", { name: /Exportar/ })).not.toBeInTheDocument();
  });
});
