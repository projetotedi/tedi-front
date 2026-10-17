import type { LessonPlanMock, LessonPlanUsage } from "../mocks/lesson-plans.mock";

export interface LessonPlanFilterParams {
  search?: string;
  content?: string;
  usage?: string;
  minDuration?: string;
  maxDuration?: string;
}

export interface DurationFilter {
  id: string;
  minDuration?: number;
  maxDuration?: number;
}

export const DURATION_FILTERS: DurationFilter[] = [
  { id: "" },
  { id: "up-to-90", maxDuration: 90 },
  { id: "91-to-120", minDuration: 91, maxDuration: 120 },
  { id: "over-120", minDuration: 121 },
];

/** Case- and accent-insensitive text normalization for local mock filtering. */
export function normalizeLessonPlanSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

export function getDurationFilter(params: URLSearchParams): string {
  const minDuration = params.get("minDuration") ?? "";
  const maxDuration = params.get("maxDuration") ?? "";
  const selected = DURATION_FILTERS.find(
    (filter) =>
      String(filter.minDuration ?? "") === minDuration &&
      String(filter.maxDuration ?? "") === maxDuration,
  );
  return selected?.id ?? "";
}

export function getDurationRange(id: string): DurationFilter {
  return DURATION_FILTERS.find((filter) => filter.id === id) ?? DURATION_FILTERS[0];
}

export function filterLessonPlans(
  records: LessonPlanMock[],
  params: LessonPlanFilterParams,
): LessonPlanMock[] {
  const query = normalizeLessonPlanSearch(params.search ?? "");
  const usage = params.usage ?? "";
  const minDuration = params.minDuration ? Number(params.minDuration) : undefined;
  const maxDuration = params.maxDuration ? Number(params.maxDuration) : undefined;

  return records
    .filter((plan) => {
      if (query && !normalizeLessonPlanSearch(plan.title).includes(query)) return false;
      if (params.content && !plan.contents.includes(params.content)) return false;
      if (usage === "archived" && plan.usage !== "archived") return false;
      if (usage !== "" && usage !== "archived" && plan.usage !== (usage as LessonPlanUsage)) {
        return false;
      }
      if (usage === "" && plan.usage === "archived") return false;
      if (minDuration !== undefined && plan.expectedDurationMinutes < minDuration) return false;
      if (maxDuration !== undefined && plan.expectedDurationMinutes > maxDuration) return false;
      return true;
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function normalizePage(value: string | null): number {
  const parsed = Number(value ?? 1);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
