import { describe, expect, it } from "vitest";

import { AssignmentRole, AssignmentSource, AssignmentStatus } from "@api/generated/model";

import {
  countPendingApplications,
  findConfirmedTeacher,
  isActiveAssignment,
} from "../lib/lesson-staff";
import {
  buildLessonAssignment,
  MEMBER_ID,
  MEMBER_NAME,
  OTHER_ASSIGNMENT_ID,
  OTHER_MEMBER_ID,
} from "./handlers";

describe("findConfirmedTeacher", () => {
  it("is the person of the confirmed teacher", () => {
    expect(findConfirmedTeacher([buildLessonAssignment()])).toEqual({
      id: MEMBER_ID,
      name: MEMBER_NAME,
    });
  });

  it("is null without assignments", () => {
    expect(findConfirmedTeacher([])).toBeNull();
  });

  it("does not count a pending teacher: she is a candidate", () => {
    const pending = buildLessonAssignment({ status: AssignmentStatus.pending });

    expect(findConfirmedTeacher([pending])).toBeNull();
  });

  it.each([AssignmentStatus.declined, AssignmentStatus.cancelled])(
    "does not count a %s teacher",
    (status) => {
      expect(findConfirmedTeacher([buildLessonAssignment({ status })])).toBeNull();
    },
  );

  it("does not take a confirmed monitor for the teacher", () => {
    const monitor = buildLessonAssignment({ role: AssignmentRole.monitor });

    expect(findConfirmedTeacher([monitor])).toBeNull();
  });

  it("finds the teacher among the other assignments of the lesson", () => {
    const assignments = [
      buildLessonAssignment({
        id: OTHER_ASSIGNMENT_ID,
        role: AssignmentRole.monitor,
        person: { id: OTHER_MEMBER_ID, name: "Rafael Souza" },
      }),
      buildLessonAssignment({ status: AssignmentStatus.pending, person: null }),
      buildLessonAssignment(),
    ];

    expect(findConfirmedTeacher(assignments)).toEqual({ id: MEMBER_ID, name: MEMBER_NAME });
  });

  it("is null when the person of the confirmed teacher was removed", () => {
    expect(findConfirmedTeacher([buildLessonAssignment({ person: null })])).toBeNull();
  });
});

describe("countPendingApplications", () => {
  it("counts the pending assignments that came from an application", () => {
    const assignments = [
      buildLessonAssignment({
        status: AssignmentStatus.pending,
        source: AssignmentSource.application,
      }),
      buildLessonAssignment({
        status: AssignmentStatus.pending,
        source: AssignmentSource.application,
      }),
    ];

    expect(countPendingApplications(assignments)).toBe(2);
  });

  it("is zero without assignments", () => {
    expect(countPendingApplications([])).toBe(0);
  });

  it("does not count a pending assignment that a coordinator made", () => {
    const pendingDirect = buildLessonAssignment({
      status: AssignmentStatus.pending,
      source: AssignmentSource.direct,
    });

    expect(countPendingApplications([pendingDirect])).toBe(0);
  });

  it.each([AssignmentStatus.confirmed, AssignmentStatus.declined, AssignmentStatus.cancelled])(
    "does not count an application that is already %s",
    (status) => {
      const decided = buildLessonAssignment({ status, source: AssignmentSource.application });

      expect(countPendingApplications([decided])).toBe(0);
    },
  );
});

describe("isActiveAssignment", () => {
  it.each([
    [AssignmentStatus.pending, true],
    [AssignmentStatus.confirmed, true],
    [AssignmentStatus.declined, false],
    [AssignmentStatus.cancelled, false],
  ])("is %s active? %s", (status, expected) => {
    expect(isActiveAssignment(status)).toBe(expected);
  });
});
