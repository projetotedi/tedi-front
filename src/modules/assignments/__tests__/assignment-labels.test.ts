import { beforeAll, describe, expect, it } from "vitest";

import { AssignmentRole, AssignmentStatus } from "@api/generated/model";
import i18n from "@shared/i18n";

import {
  APPLY_ROLE_ORDER,
  ASSIGNMENT_STATUS_LABEL_KEYS,
  assignmentStatusTone,
  lessonLabel,
  ROLE_INLINE_KEYS,
  ROLE_LABEL_KEYS,
} from "../lib/assignment-labels";
import "../index";

describe("ROLE_LABEL_KEYS and ROLE_INLINE_KEYS", () => {
  it("have a key for every role of the contract", () => {
    expect(Object.keys(ROLE_LABEL_KEYS).sort()).toEqual(Object.values(AssignmentRole).sort());
    expect(Object.keys(ROLE_INLINE_KEYS).sort()).toEqual(Object.values(AssignmentRole).sort());
  });

  it("point each role to its key in the locale", () => {
    expect(ROLE_LABEL_KEYS).toEqual({ teacher: "roles.teacher", monitor: "roles.monitor" });
    expect(ROLE_INLINE_KEYS).toEqual({
      teacher: "rolesInline.teacher",
      monitor: "rolesInline.monitor",
    });
  });
});

describe("APPLY_ROLE_ORDER", () => {
  it("offers Monitor(a) before Professor(a), as the Figma does, and each role once", () => {
    expect(APPLY_ROLE_ORDER).toEqual(["monitor", "teacher"]);
    expect([...APPLY_ROLE_ORDER].sort()).toEqual(Object.values(AssignmentRole).sort());
  });
});

describe("ASSIGNMENT_STATUS_LABEL_KEYS", () => {
  it("has a label key for every status of the contract", () => {
    expect(Object.keys(ASSIGNMENT_STATUS_LABEL_KEYS).sort()).toEqual(
      Object.values(AssignmentStatus).sort(),
    );
  });

  it("points each status to its key under assignmentStatus in the locale", () => {
    expect(ASSIGNMENT_STATUS_LABEL_KEYS).toEqual({
      pending: "assignmentStatus.pending",
      confirmed: "assignmentStatus.confirmed",
      declined: "assignmentStatus.declined",
      cancelled: "assignmentStatus.cancelled",
    });
  });
});

describe("assignmentStatusTone", () => {
  it.each([
    [AssignmentStatus.confirmed, "success"],
    [AssignmentStatus.pending, "warning"],
    [AssignmentStatus.declined, "danger"],
    [AssignmentStatus.cancelled, "neutral"],
  ] as const)("%s is a %s tag", (status, tone) => {
    expect(assignmentStatusTone(status)).toBe(tone);
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
