import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HourEntryOrigin } from "@api/generated/model";
import i18n from "@shared/i18n";

import { loggedByText } from "../components/EntrySummary";
import "../index";
import { buildEntry } from "./bank-fixtures";

describe("loggedByText", () => {
  let originalTimeZone: string | undefined;

  beforeAll(() => {
    originalTimeZone = process.env.TZ;
    process.env.TZ = "America/Sao_Paulo";
  });

  afterAll(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it.each([
    [HourEntryOrigin.manual, "Lançado pelo próprio membro em 14/03"],
    [HourEntryOrigin.on_behalf, "Lançado em nome do membro em 14/03"],
    [HourEntryOrigin.attendance, "Registrado pela presença da aula em 14/03"],
  ])("says who logged an entry of origin %s, and when", (origin, text) => {
    const entry = buildEntry({
      id: "0197a000-0000-7000-8000-000000001403",
      origin,
      createdAt: "2026-03-14T21:42:00.000Z",
    });

    expect(loggedByText(entry, i18n.getFixedT("pt-BR", "hours"), "pt-BR")).toBe(text);
  });
});
