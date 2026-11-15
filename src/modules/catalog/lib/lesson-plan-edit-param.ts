/**
 * `?edit=1` on the detail route of a lesson plan asks the page to open the "Editar plano" form once
 * it has the plan. Duplicating sends the person there, so they can adjust the title of the copy.
 * The page reads it once and takes it off the URL, so reloading or going back never reopens the form.
 */
export const EDIT_PARAM = "edit";
export const EDIT_PARAM_VALUE = "1";

export function buildLessonPlanEditPath(lessonPlanId: string): string {
  return `/lesson-plans/${lessonPlanId}?${EDIT_PARAM}=${EDIT_PARAM_VALUE}`;
}

export function wantsEdit(params: URLSearchParams): boolean {
  return params.get(EDIT_PARAM) === EDIT_PARAM_VALUE;
}

/** A copy of `params` without `edit`; the other parameters stay and `params` is not changed. */
export function withoutEdit(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(EDIT_PARAM);
  return next;
}
