import { GetLessonPlanParams } from "@api/generated/zod/catalog/catalog";

/**
 * The id of the detail route comes from the URL, which can be typed by hand or come from an old
 * link. The contract says a lesson plan id is a UUID (`GetLessonPlanParams`, generated), so
 * anything else cannot exist and there is nothing to ask the API.
 */
export function isLessonPlanId(value: string): boolean {
  return GetLessonPlanParams.safeParse({ id: value }).success;
}
