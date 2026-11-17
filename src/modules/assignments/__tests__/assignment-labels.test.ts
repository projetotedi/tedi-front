import { beforeAll, describe, expect, it } from "vitest";

import { AssignmentRole, AssignmentSource, AssignmentStatus } from "@api/generated/model";
import i18n from "@shared/i18n";

import {
  APPLY_ROLE_ORDER,
  ASSIGNABLE_STATUSES,
  ASSIGNMENT_ROLE_LABEL_KEYS,
  assignmentRoleTone,
  assignmentStatusLabelKey,
  assignmentStatusTone,
  lessonLabel,
  MY_LESSON_STATUS_LABEL_KEYS,
  ROLE_INLINE_KEYS,
} from "../lib/assignment-labels";
import ptBR from "../locales/pt-BR.json";
import "../index";

/** Reads a key such as `status.applied` from the pt-BR texts: what the screen would show for it. */
function text(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], ptBR);
}

describe("ASSIGNMENT_ROLE_LABEL_KEYS", () => {
  it("has the neutral label of each role", () => {
    expect(ASSIGNMENT_ROLE_LABEL_KEYS).toEqual({
      teacher: "role.teacher",
      monitor: "role.monitor",
    });
    expect(text(ASSIGNMENT_ROLE_LABEL_KEYS.teacher)).toBe("Professor(a)");
    expect(text(ASSIGNMENT_ROLE_LABEL_KEYS.monitor)).toBe("Monitor(a)");
  });
});

describe("assignmentStatusLabelKey", () => {
  it("says Inscrita for a pending assignment that came from an application", () => {
    const key = assignmentStatusLabelKey(AssignmentStatus.pending, AssignmentSource.application);

    expect(key).toBe("status.applied");
    expect(text(key)).toBe("Inscrita");
  });

  it("says Pendente for a pending assignment that a coordinator made", () => {
    const key = assignmentStatusLabelKey(AssignmentStatus.pending, AssignmentSource.direct);

    expect(key).toBe("status.pending");
    expect(text(key)).toBe("Pendente");
  });

  it.each([
    [AssignmentStatus.confirmed, "status.confirmed", "Confirmada"],
    [AssignmentStatus.declined, "status.declined", "Recusada"],
    [AssignmentStatus.cancelled, "status.cancelled", "Cancelada"],
  ])("gives %s the same label whatever its source", (status, expectedKey, expectedText) => {
    for (const source of Object.values(AssignmentSource)) {
      const key = assignmentStatusLabelKey(status, source);

      expect(key).toBe(expectedKey);
      expect(text(key)).toBe(expectedText);
    }
  });

  it("has a text in the translations for every status and source", () => {
    for (const status of Object.values(AssignmentStatus)) {
      for (const source of Object.values(AssignmentSource)) {
        expect(typeof text(assignmentStatusLabelKey(status, source))).toBe("string");
      }
    }
  });
});

describe("assignmentStatusTone", () => {
  it.each([
    [AssignmentStatus.confirmed, "success"],
    [AssignmentStatus.pending, "warning"],
    [AssignmentStatus.declined, "danger"],
    [AssignmentStatus.cancelled, "neutral"],
  ])("gives %s the tone %s", (status, tone) => {
    expect(assignmentStatusTone(status)).toBe(tone);
  });
});

describe("assignmentRoleTone", () => {
  it("makes the teacher blue and the monitor purple", () => {
    expect(assignmentRoleTone(AssignmentRole.teacher)).toBe("info");
    expect(assignmentRoleTone(AssignmentRole.monitor)).toBe("highlight");
  });
});

describe("ASSIGNABLE_STATUSES", () => {
  it("offers confirmed first and pending second, and nothing else (A8)", () => {
    expect([...ASSIGNABLE_STATUSES]).toEqual([
      AssignmentStatus.confirmed,
      AssignmentStatus.pending,
    ]);
  });
});

describe("ROLE_INLINE_KEYS", () => {
  it("has the role inside a sentence, in lower case, for every role of the contract", () => {
    expect(Object.keys(ROLE_INLINE_KEYS).sort()).toEqual(Object.values(AssignmentRole).sort());
    expect(text(ROLE_INLINE_KEYS.teacher)).toBe("professor(a)");
    expect(text(ROLE_INLINE_KEYS.monitor)).toBe("monitor(a)");
  });
});

describe("APPLY_ROLE_ORDER", () => {
  it("offers Monitor(a) before Professor(a), as the Figma does, and each role once", () => {
    expect(APPLY_ROLE_ORDER).toEqual(["monitor", "teacher"]);
    expect([...APPLY_ROLE_ORDER].sort()).toEqual(Object.values(AssignmentRole).sort());
  });
});

describe("MY_LESSON_STATUS_LABEL_KEYS", () => {
  it("has a label for every status of the contract, under myLessons.status", () => {
    expect(Object.keys(MY_LESSON_STATUS_LABEL_KEYS).sort()).toEqual(
      Object.values(AssignmentStatus).sort(),
    );
  });

  it("says Aguardando confirmação for what waits, as Minhas aulas does in the Figma", () => {
    expect(text(MY_LESSON_STATUS_LABEL_KEYS.pending)).toBe("Aguardando confirmação");
    expect(text(MY_LESSON_STATUS_LABEL_KEYS.confirmed)).toBe("Confirmada");
    expect(text(MY_LESSON_STATUS_LABEL_KEYS.declined)).toBe("Recusada");
    expect(text(MY_LESSON_STATUS_LABEL_KEYS.cancelled)).toBe("Cancelada");
  });
});

describe("lessonLabel", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("joins the place in the sequence and the title", () => {
    const t = i18n.getFixedT("pt-BR", "assignments");

    expect(lessonLabel({ sequenceOrder: 3, title: "Arquivos e pastas" }, t)).toBe(
      "Aula 3 · Arquivos e pastas",
    );
  });

  it("shows only the title for a lesson on its own, with no place in a sequence", () => {
    const t = i18n.getFixedT("pt-BR", "assignments");

    expect(lessonLabel({ sequenceOrder: null, title: "Aula avulsa de revisão" }, t)).toBe(
      "Aula avulsa de revisão",
    );
  });

  it("speaks the language it is given", () => {
    const t = i18n.getFixedT("en-US", "assignments");

    expect(lessonLabel({ sequenceOrder: 5, title: "Email from scratch" }, t)).toBe(
      "Lesson 5 · Email from scratch",
    );
  });
});
