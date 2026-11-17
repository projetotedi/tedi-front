import { describe, expect, it } from "vitest";

import { AssignmentRole, AssignmentSource, AssignmentStatus } from "@api/generated/model";

import {
  ASSIGNABLE_STATUSES,
  ASSIGNMENT_ROLE_LABEL_KEYS,
  assignmentRoleTone,
  assignmentStatusLabelKey,
  assignmentStatusTone,
} from "../lib/assignment-labels";
import ptBR from "../locales/pt-BR.json";

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
