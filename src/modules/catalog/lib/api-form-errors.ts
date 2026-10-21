import type { FieldPath } from "react-hook-form";

import type { ApiFieldErrorDto } from "@api/generated/model";

import type { LessonPlanFormValues } from "../schemas/lesson-plan.schema";

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);
const VALIDATION_FAILED = "VALIDATION_FAILED";
const LESSON_PLAN_ARCHIVED = "LESSON_PLAN_ARCHIVED";
const LESSON_PLAN_NOT_FOUND = "LESSON_PLAN_NOT_FOUND";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
  details?: unknown;
}

export interface FieldErrorEntry<Name extends string> {
  name: Name;
  message: string;
}

export type SubmitErrorKind = "archived" | "notFound" | "network" | "unknown";

export type SubmitError<Name extends string> =
  | { kind: "fields"; fields: FieldErrorEntry<Name>[] }
  | { kind: SubmitErrorKind };

export type LessonPlanFieldName = FieldPath<LessonPlanFormValues>;

const LESSON_PLAN_FIELDS: ReadonlyMap<string, FieldErrorEntry<LessonPlanFieldName>> = new Map<
  string,
  FieldErrorEntry<LessonPlanFieldName>
>([
  ["title", { name: "title", message: "serverInvalid" }],
  ["objective", { name: "objective", message: "serverInvalid" }],
  ["expectedDurationMinutes", { name: "hours", message: "durationInvalid" }],
  ["materialUrl", { name: "materialUrl", message: "materialUrlInvalid" }],
  ["contents", { name: "contents.0.value", message: "contentsServerInvalid" }],
]);

export function resolveLessonPlanField(field: string): FieldErrorEntry<LessonPlanFieldName> | null {
  const direct = LESSON_PLAN_FIELDS.get(field);
  if (direct) return direct;

  const content = /^contents\.(\d+)$/.exec(field);
  if (content) {
    return { name: `contents.${Number(content[1])}.value`, message: "contentsServerInvalid" };
  }
  return null;
}

export function resolveArchiveField(field: string): FieldErrorEntry<"reason"> | null {
  return field === "reason" ? { name: "reason", message: "reasonTooLong" } : null;
}

function readApiErrorShape(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? (error as ApiErrorShape) : {};
}

function isFieldDetail(detail: unknown): detail is ApiFieldErrorDto {
  if (typeof detail !== "object" || detail === null) return false;
  const { field, message } = detail as Partial<ApiFieldErrorDto>;
  return typeof field === "string" && typeof message === "string";
}

function readFieldDetails(shape: ApiErrorShape): ApiFieldErrorDto[] {
  return Array.isArray(shape.details) ? shape.details.filter(isFieldDetail) : [];
}

function visualRank(name: string): [number, number] {
  const content = /^contents\.(\d+)\./.exec(name);
  if (content) return [3, Number(content[1])];

  const ranks: Record<string, number> = {
    title: 0,
    hours: 1,
    minutes: 2,
    objective: 4,
    materialUrl: 5,
  };
  return [ranks[name] ?? 6, 0];
}

function byVisualOrder(first: { name: string }, second: { name: string }): number {
  const [firstRank, firstIndex] = visualRank(first.name);
  const [secondRank, secondIndex] = visualRank(second.name);
  return firstRank - secondRank || firstIndex - secondIndex;
}

function toFieldEntries<Name extends string>(
  shape: ApiErrorShape,
  resolveField: (field: string) => FieldErrorEntry<Name> | null,
): FieldErrorEntry<Name>[] {
  const entries = new Map<Name, FieldErrorEntry<Name>>();

  for (const detail of readFieldDetails(shape)) {
    const entry = resolveField(detail.field);
    if (entry && !entries.has(entry.name)) entries.set(entry.name, entry);
  }

  return [...entries.values()].sort(byVisualOrder);
}

export function toSubmitError<Name extends string>(
  error: unknown,
  resolveField: (field: string) => FieldErrorEntry<Name> | null,
): SubmitError<Name> {
  const shape = readApiErrorShape(error);

  if (shape.statusCode === 400 && shape.error === VALIDATION_FAILED) {
    const fields = toFieldEntries(shape, resolveField);
    return fields.length > 0 ? { kind: "fields", fields } : { kind: "unknown" };
  }
  if (shape.statusCode === 409 && shape.error === LESSON_PLAN_ARCHIVED) {
    return { kind: "archived" };
  }
  if (shape.statusCode === 404 && shape.error === LESSON_PLAN_NOT_FOUND) {
    return { kind: "notFound" };
  }
  if (error instanceof TypeError) return { kind: "network" };
  if (typeof shape.statusCode === "number" && GATEWAY_STATUS_CODES.has(shape.statusCode)) {
    return { kind: "network" };
  }
  return { kind: "unknown" };
}

export function toRequestErrorKind(error: unknown): SubmitErrorKind {
  const result = toSubmitError(error, () => null);
  return result.kind === "fields" ? "unknown" : result.kind;
}
