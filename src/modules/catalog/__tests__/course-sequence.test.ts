import { describe, expect, it } from "vitest";

import {
  availableLessonPlans,
  sequenceWorkloadMinutes,
  toLessonPlanIds,
  toSequenceItems,
  type SequenceItem,
} from "../lib/course-sequence";
import { buildCourseSequence, buildMockSequenceItem, buildSequenceItem } from "./handlers";

function item(lessonPlanId: string, overrides: Partial<SequenceItem> = {}): SequenceItem {
  return {
    lessonPlanId,
    title: `Plan ${lessonPlanId}`,
    contents: ["Content"],
    expectedDurationMinutes: 60,
    materialUrl: null,
    courseCount: 1,
    archivedAt: null,
    ...overrides,
  };
}

const ids = (items: readonly SequenceItem[]) => items.map((candidate) => candidate.lessonPlanId);

describe("toSequenceItems", () => {
  it("keeps the order of the API and drops the position, which is the index from now on", () => {
    const response = buildCourseSequence([
      buildSequenceItem({ lessonPlanId: "first", title: "First" }),
      buildSequenceItem({ lessonPlanId: "second", title: "Second" }),
    ]);

    const items = toSequenceItems(response);

    expect(ids(items)).toEqual(["first", "second"]);
    expect(items[0]).toEqual({
      lessonPlanId: "first",
      title: "First",
      contents: ["WhatsApp: mensagens e áudios"],
      expectedDurationMinutes: 90,
      materialUrl: "https://example.com/material/whatsapp",
      courseCount: 1,
      archivedAt: null,
    });
    expect(items[0]).not.toHaveProperty("position");
  });

  it("returns an empty draft for an empty sequence", () => {
    expect(toSequenceItems(buildCourseSequence([]))).toEqual([]);
  });

  it("does not change the response", () => {
    const response = buildCourseSequence();
    const before = structuredClone(response);

    toSequenceItems(response);

    expect(response).toEqual(before);
  });
});

describe("sequenceWorkloadMinutes", () => {
  it("is the sum of the durations of the plans", () => {
    const items = [
      item("a", { expectedDurationMinutes: 90 }),
      item("b", { expectedDurationMinutes: 90 }),
      item("c", { expectedDurationMinutes: 150 }),
      item("d", { expectedDurationMinutes: 90 }),
    ];

    expect(sequenceWorkloadMinutes(items)).toBe(420);
  });

  it("is 0 for an empty sequence", () => {
    expect(sequenceWorkloadMinutes([])).toBe(0);
  });

  it("does not depend on the order", () => {
    const items = [
      item("a", { expectedDurationMinutes: 30 }),
      item("b", { expectedDurationMinutes: 45 }),
    ];

    expect(sequenceWorkloadMinutes([...items].reverse())).toBe(sequenceWorkloadMinutes(items));
  });

  it("is what the API answers for the same plans", () => {
    const response = buildCourseSequence();

    expect(sequenceWorkloadMinutes(toSequenceItems(response))).toBe(
      response.plannedWorkloadMinutes,
    );
  });
});

describe("toLessonPlanIds", () => {
  it("lists every id in the order of the draft", () => {
    expect(toLessonPlanIds([item("c"), item("a"), item("b")])).toEqual(["c", "a", "b"]);
  });

  it("is empty for an empty draft, which clears the sequence", () => {
    expect(toLessonPlanIds([])).toEqual([]);
  });
});

describe("availableLessonPlans", () => {
  const catalog = [
    item("a", { title: "Alfa" }),
    item("b", { title: "Beta" }),
    item("c", { title: "Gama" }),
  ];

  it("offers the whole catalog when the draft is empty", () => {
    expect(ids(availableLessonPlans(catalog, [], []))).toEqual(["a", "b", "c"]);
  });

  it("leaves out the plans of the draft", () => {
    expect(ids(availableLessonPlans(catalog, [], [catalog[1]]))).toEqual(["a", "c"]);
  });

  it("leaves out every plan of the draft, even all of them", () => {
    expect(availableLessonPlans(catalog, [], catalog)).toEqual([]);
  });

  it("offers again a saved plan that was taken out of the draft", () => {
    const saved = [item("s", { title: "Salvo" })];

    expect(ids(availableLessonPlans(catalog, saved, []))).toEqual(["a", "b", "c", "s"]);
    expect(ids(availableLessonPlans(catalog, saved, saved))).toEqual(["a", "b", "c"]);
  });

  it("does not repeat a plan that is in the catalog and in the saved sequence", () => {
    expect(ids(availableLessonPlans(catalog, [catalog[0]], []))).toEqual(["a", "b", "c"]);
  });

  it("uses the saved copy of a plan that is in both", () => {
    const saved = [item("a", { title: "Alfa atualizado", expectedDurationMinutes: 120 })];

    const [first] = availableLessonPlans(catalog, saved, []);

    expect(first).toMatchObject({
      lessonPlanId: "a",
      title: "Alfa atualizado",
      expectedDurationMinutes: 120,
    });
  });

  it("leaves out archived plans, whether they come from the catalog or from the saved sequence", () => {
    const archived = "2026-10-10T13:00:00.000Z";
    const archivedInCatalog = item("old", { title: "Antigo", archivedAt: archived });
    const archivedInSaved = item("gone", { title: "Aposentado", archivedAt: archived });

    expect(
      ids(availableLessonPlans([...catalog, archivedInCatalog], [archivedInSaved], [])),
    ).toEqual(["a", "b", "c"]);
  });

  it("sorts by title the way Portuguese does, with accents next to their letters", () => {
    const unsorted = [
      item("z", { title: "Zebra" }),
      item("e", { title: "Édredom" }),
      item("a", { title: "Abacaxi" }),
      item("f", { title: "Fotos" }),
    ];

    expect(availableLessonPlans(unsorted, [], []).map((candidate) => candidate.title)).toEqual([
      "Abacaxi",
      "Édredom",
      "Fotos",
      "Zebra",
    ]);
  });

  it("does not change what it receives", () => {
    const draft = [catalog[0]];
    const before = structuredClone({ catalog, draft });

    availableLessonPlans(catalog, [], draft);

    expect({ catalog, draft }).toEqual(before);
  });

  it("does not offer the plans of the default sequence of the fixtures that are in the mock catalog", () => {
    const sequence = toSequenceItems(buildCourseSequence());
    const mock = [
      toSequenceItems(buildCourseSequence([buildMockSequenceItem("lesson-plan-04")]))[0],
      toSequenceItems(buildCourseSequence([buildMockSequenceItem("lesson-plan-07")]))[0],
    ];

    expect(ids(availableLessonPlans(mock, sequence, sequence))).toEqual(["lesson-plan-07"]);
  });
});
