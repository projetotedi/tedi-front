import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { HourEntryStatus } from "@api/generated/model";
import i18n from "@shared/i18n";

// Registers the "hours" namespace.
import "../index";
import { EntryStatusTag } from "../components/EntryStatusTag";

const CASES: { language: "pt-BR" | "en-US"; status: HourEntryStatus; label: string }[] = [
  { language: "pt-BR", status: "approved", label: "Aprovado" },
  { language: "pt-BR", status: "adjusted", label: "Ajustado" },
  { language: "pt-BR", status: "pending", label: "Pendente" },
  { language: "pt-BR", status: "rejected", label: "Rejeitado" },
  { language: "en-US", status: "approved", label: "Approved" },
  { language: "en-US", status: "adjusted", label: "Adjusted" },
  { language: "en-US", status: "pending", label: "Pending" },
  { language: "en-US", status: "rejected", label: "Rejected" },
];

describe("EntryStatusTag", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it.each(CASES)("says $label for $status in $language", async ({ language, status, label }) => {
    await i18n.changeLanguage(language);
    render(<EntryStatusTag status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
