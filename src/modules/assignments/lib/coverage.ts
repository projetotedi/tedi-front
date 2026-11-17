import type { TFunction } from "i18next";

import type { LessonCoverageDto } from "@api/generated/model";

import { META_SEPARATOR } from "./format";

export interface CoveragePart {
  key: "teacher" | "monitors";
  confirmed: number;
  expected: number;
}

/**
 * The parts of the coverage the screens write out ("Professor(a) 0 de 1 · Monitores 2 de 3"). Only
 * what confirmed assignments fill counts, and the API already says so.
 *
 * - the teacher is there only while the lesson has none (confirmed below expected): a lesson that
 *   has one does not say "Professor(a) 1 de 1", it just leaves it out, as the Figma does;
 * - the monitors are there whenever some are expected. An `expected` that is `null` ("not
 *   informed") or 0 expects nobody, so there is nothing to count.
 */
export function coverageParts(coverage: LessonCoverageDto): CoveragePart[] {
  const parts: CoveragePart[] = [];
  const { teacher, monitors } = coverage;

  if (teacher.confirmed < teacher.expected) {
    parts.push({ key: "teacher", confirmed: teacher.confirmed, expected: teacher.expected });
  }
  if (monitors.expected !== null && monitors.expected > 0) {
    parts.push({ key: "monitors", confirmed: monitors.confirmed, expected: monitors.expected });
  }

  return parts;
}

/**
 * The coverage of a lesson as one line: the parts joined by " · ", or "Equipe completa" when there
 * is nothing left to say (the teacher is there and no monitor is expected).
 */
export function formatCoverage(coverage: LessonCoverageDto, t: TFunction<"assignments">): string {
  const parts = coverageParts(coverage);
  if (parts.length === 0) return t("vacancies.complete");

  return parts
    .map(({ key, confirmed, expected }) => t(`vacancies.${key}`, { confirmed, expected }))
    .join(META_SEPARATOR);
}
