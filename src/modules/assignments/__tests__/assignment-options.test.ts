import { describe, expect, it } from "vitest";

import { LessonStatus, MemberRegistrationStatus, MemberStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import {
  isAssignableMember,
  toClassOptions,
  toLessonOptions,
  toMemberOptions,
} from "../lib/assignment-options";
import {
  buildLessonListItem,
  buildMemberListItem,
  CLASS_ID,
  CLASS_NAME,
  LESSON_ID,
  LESSON_OPTION,
  MEMBER_ID,
  MEMBER_NAME,
  OTHER_CLASS_ID,
  OTHER_CLASS_NAME,
  OTHER_LESSON_ID,
  OTHER_MEMBER_ID,
  THIRD_LESSON_ID,
  THIRD_MEMBER_ID,
} from "./handlers";

const classOf = (id: string, name: string) => ({ id, code: name, name, colorIndex: 0 });

describe("toClassOptions", () => {
  it("offers one option per class, whatever the number of lessons it has", () => {
    const lessons = [
      buildLessonListItem({ id: LESSON_ID }),
      buildLessonListItem({ id: OTHER_LESSON_ID }),
      buildLessonListItem({
        id: THIRD_LESSON_ID,
        class: classOf(OTHER_CLASS_ID, OTHER_CLASS_NAME),
      }),
    ];

    expect(toClassOptions(lessons)).toEqual([
      { id: CLASS_ID, label: CLASS_NAME },
      { id: OTHER_CLASS_ID, label: OTHER_CLASS_NAME },
    ]);
  });

  it("labels each class with its name, in the alphabetical order of Portuguese", () => {
    const lessons = [
      buildLessonListItem({ class: classOf(OTHER_CLASS_ID, OTHER_CLASS_NAME) }),
      buildLessonListItem({ class: classOf(CLASS_ID, CLASS_NAME) }),
      buildLessonListItem({
        class: classOf("01952ef7-0000-7000-8000-0000000000d3", "Álgebra Básica — B"),
      }),
    ];

    // "Á" is sorted with the "A" and not after the "Z", as the order of the code points would do.
    expect(toClassOptions(lessons).map((option) => option.label)).toEqual([
      "Álgebra Básica — B",
      CLASS_NAME,
      OTHER_CLASS_NAME,
    ]);
  });

  it("has no option without lessons", () => {
    expect(toClassOptions([])).toEqual([]);
  });
});

describe("toLessonOptions", () => {
  it("labels the lesson with the day, the month and the title, as the Figma does", () => {
    expect(toLessonOptions([buildLessonListItem()], "pt-BR")).toEqual([
      { id: LESSON_ID, label: LESSON_OPTION },
    ]);
    expect(toLessonOptions([buildLessonListItem()], "en-US")).toEqual([
      { id: LESSON_ID, label: "03/10 · Senhas e privacidade" },
    ]);
  });

  it("leaves out the cancelled lessons: the API refuses them with LESSON_CANCELLED", () => {
    const lessons = [
      buildLessonListItem({ id: LESSON_ID }),
      buildLessonListItem({ id: OTHER_LESSON_ID, status: LessonStatus.cancelled }),
      buildLessonListItem({ id: THIRD_LESSON_ID, status: LessonStatus.confirmed }),
    ];

    expect(toLessonOptions(lessons, "pt-BR").map((option) => option.id)).toEqual([
      LESSON_ID,
      THIRD_LESSON_ID,
    ]);
  });

  it("offers a lesson that is done: allocating after the fact is the record the hours need", () => {
    const done = buildLessonListItem({ status: LessonStatus.done, date: "2026-02-03" });

    expect(toLessonOptions([done], "pt-BR")).toHaveLength(1);
  });

  it("keeps the order of the API, which is the one of the dates", () => {
    const lessons = [
      buildLessonListItem({ id: THIRD_LESSON_ID, date: "2026-03-24", title: "Redes" }),
      buildLessonListItem({ id: LESSON_ID, date: "2026-03-10" }),
      buildLessonListItem({ id: OTHER_LESSON_ID, date: "2026-03-17", title: "Teclado" }),
    ];

    expect(toLessonOptions(lessons, "pt-BR").map((option) => option.id)).toEqual([
      THIRD_LESSON_ID,
      LESSON_ID,
      OTHER_LESSON_ID,
    ]);
  });

  it("has no option without lessons", () => {
    expect(toLessonOptions([], "pt-BR")).toEqual([]);
  });
});

describe("isAssignableMember", () => {
  it("accepts an active member with access and an approved registration", () => {
    expect(isAssignableMember(buildMemberListItem())).toBe(true);
  });

  it("accepts a coordinator who has no member profile, so no registration status", () => {
    const coordinator = buildMemberListItem({ role: Role.coordinator, registrationStatus: null });

    expect(isAssignableMember(coordinator)).toBe(true);
  });

  it.each([
    ["a member whose participation is inactive", { status: MemberStatus.inactive }],
    ["a member whose access is off", { accessEnabled: false }],
    ["a person with no access role", { role: null }],
    [
      "a member whose registration waits for validation",
      { registrationStatus: MemberRegistrationStatus.pending },
    ],
    [
      "a member whose registration was refused",
      { registrationStatus: MemberRegistrationStatus.rejected },
    ],
  ])("refuses %s", (_label, overrides) => {
    expect(isAssignableMember(buildMemberListItem(overrides))).toBe(false);
  });
});

describe("toMemberOptions", () => {
  it("labels each member with the name", () => {
    expect(toMemberOptions([buildMemberListItem()])).toEqual([
      { id: MEMBER_ID, label: MEMBER_NAME },
    ]);
  });

  it("orders the names alphabetically, an accented initial with its letter", () => {
    const members = [
      buildMemberListItem({ id: THIRD_MEMBER_ID, name: "Zilda Prado" }),
      buildMemberListItem({ id: MEMBER_ID }),
      buildMemberListItem({ id: OTHER_MEMBER_ID, name: "Álvaro Lima" }),
    ];

    expect(toMemberOptions(members).map((option) => option.label)).toEqual([
      "Álvaro Lima",
      MEMBER_NAME,
      "Zilda Prado",
    ]);
  });

  it("has no option without members", () => {
    expect(toMemberOptions([])).toEqual([]);
  });
});
