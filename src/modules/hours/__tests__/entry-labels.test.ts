import { describe, expect, it } from "vitest";

import { HourEntryCategory, HourEntryStatus } from "@api/generated/model";
import i18n from "@shared/i18n";

// Registers the "hours" namespace.
import "../index";
import {
  ENTRY_CATEGORY_LABEL_KEYS,
  ENTRY_STATUS_LABEL_KEYS,
  LOGGABLE_CATEGORIES,
  toLoggableCategory,
} from "../lib/entry-labels";

const LANGUAGES = ["pt-BR", "en-US"] as const;

describe("entry labels", () => {
  it("offers every category of the contract to log but lesson, in the F7.7 order", () => {
    expect(LOGGABLE_CATEGORIES).toEqual([
      "planning",
      "event",
      "management",
      "meeting",
      "support",
      "other",
    ]);
    // A new category in the contract breaks this until it is placed in the order above.
    expect([...LOGGABLE_CATEGORIES].sort()).toEqual(
      Object.values(HourEntryCategory)
        .filter((category) => category !== HourEntryCategory.lesson)
        .sort(),
    );
  });

  it("has a label in both languages for every category and every status of the contract", () => {
    const keys = [
      ...Object.values(HourEntryCategory).map((category) => ENTRY_CATEGORY_LABEL_KEYS[category]),
      ...Object.values(HourEntryStatus).map((status) => ENTRY_STATUS_LABEL_KEYS[status]),
    ];

    for (const language of LANGUAGES) {
      const t = i18n.getFixedT(language, "hours");
      for (const key of keys) {
        expect(i18n.exists(key, { ns: "hours", lng: language }), `${language} ${key}`).toBe(true);
        expect(t(key).trim(), `${language} ${key}`).not.toBe("");
      }
    }
  });

  it("names meeting Reunião and support Atendimento", () => {
    const t = i18n.getFixedT("pt-BR", "hours");

    expect(t(ENTRY_CATEGORY_LABEL_KEYS.meeting)).toBe("Reunião");
    expect(t(ENTRY_CATEGORY_LABEL_KEYS.support)).toBe("Atendimento");
    expect(t(ENTRY_CATEGORY_LABEL_KEYS.lesson)).toBe("Aula");
  });

  it("turns a value of the select into a loggable category and anything else into null", () => {
    expect(toLoggableCategory("event")).toBe("event");
    expect(toLoggableCategory("lesson")).toBeNull();
    expect(toLoggableCategory("x")).toBeNull();
    expect(toLoggableCategory("")).toBeNull();
  });
});
