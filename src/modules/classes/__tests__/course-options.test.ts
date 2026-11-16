import { describe, expect, it } from "vitest";

import {
  ClassStatus,
  CourseCategory,
  CourseStatus,
  type ClassCourseResponseDto,
} from "@api/generated/model";

import {
  canChangeCourse,
  findCourse,
  otherClassesCount,
  selectableCourses,
} from "../lib/course-options";

function buildCourse(overrides: Partial<ClassCourseResponseDto> = {}): ClassCourseResponseDto {
  return {
    id: "course-a",
    name: "Informática Básica",
    category: CourseCategory.basic,
    status: CourseStatus.active,
    ...overrides,
  };
}

const COMPUTER = buildCourse({ id: "computer", name: "Informática Básica" });
const INTERNET = buildCourse({
  id: "internet",
  name: "Internet",
  category: CourseCategory.intermediate,
});
const PHOTO = buildCourse({
  id: "photo",
  name: "Fotografia digital",
  category: CourseCategory.advanced,
  status: CourseStatus.archived,
});
const OLD_ARCHIVED = buildCourse({
  id: "old",
  name: "Curso antigo",
  status: CourseStatus.archived,
});

const ids = (courses: ClassCourseResponseDto[]) => courses.map((course) => course.id);

describe("selectableCourses", () => {
  it("offers only the active courses", () => {
    expect(ids(selectableCourses([COMPUTER, PHOTO, INTERNET]))).toEqual(["computer", "internet"]);
  });

  it("keeps the current course of the class even when it is archived, and no other archived one", () => {
    expect(ids(selectableCourses([COMPUTER, PHOTO, OLD_ARCHIVED, INTERNET], "photo"))).toEqual([
      "photo",
      "computer",
      "internet",
    ]);
  });

  it("does not repeat the current course when it is active", () => {
    expect(ids(selectableCourses([COMPUTER, INTERNET], "computer"))).toEqual([
      "computer",
      "internet",
    ]);
  });

  it("offers nothing when every course is archived and none is the current one", () => {
    expect(selectableCourses([PHOTO, OLD_ARCHIVED])).toEqual([]);
  });

  it("orders by name the way a Portuguese reader does: accents sort with their letter", () => {
    const zoology = buildCourse({ id: "zoology", name: "Zoologia" });
    const algebra = buildCourse({ id: "algebra", name: "Álgebra" });
    const botany = buildCourse({ id: "botany", name: "Botânica" });

    expect(ids(selectableCourses([zoology, algebra, botany]))).toEqual([
      "algebra",
      "botany",
      "zoology",
    ]);
  });

  it("does not change the array it receives", () => {
    const courses = [INTERNET, PHOTO, COMPUTER];

    selectableCourses(courses);

    expect(ids(courses)).toEqual(["internet", "photo", "computer"]);
  });
});

describe("canChangeCourse", () => {
  it("allows it while the class is planned and has no enrollment", () => {
    expect(canChangeCourse({ status: ClassStatus.planned, enrolledCount: 0 })).toBe(true);
  });

  it("does not allow it when a planned class already has an enrollment", () => {
    expect(canChangeCourse({ status: ClassStatus.planned, enrolledCount: 1 })).toBe(false);
  });

  it.each([ClassStatus.in_progress, ClassStatus.completed, ClassStatus.cancelled])(
    "does not allow it when the class is %s, even with no enrollment",
    (status) => {
      expect(canChangeCourse({ status, enrolledCount: 0 })).toBe(false);
    },
  );
});

describe("findCourse", () => {
  it("finds the course by its id", () => {
    expect(findCourse([COMPUTER, INTERNET], "internet")).toBe(INTERNET);
  });

  it("is undefined for an id that is not on the list", () => {
    expect(findCourse([COMPUTER, INTERNET], "missing")).toBeUndefined();
  });
});

describe("otherClassesCount", () => {
  it("leaves this class out of the total when it is active, since the total counts it", () => {
    expect(otherClassesCount(4, false)).toBe(3);
  });

  it("counts all of them when this class is archived, since the total does not have it", () => {
    expect(otherClassesCount(4, true)).toBe(4);
  });

  it("is zero when this class is the only one of the course", () => {
    expect(otherClassesCount(1, false)).toBe(0);
  });

  it("is never negative", () => {
    expect(otherClassesCount(0, false)).toBe(0);
    expect(otherClassesCount(0, true)).toBe(0);
  });
});
