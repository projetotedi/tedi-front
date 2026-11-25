import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { CourseCategory } from "@api/generated/model";
import { Badge } from "@shared/ui";

export interface InheritedLevelBadgeProps {
  /** The category of the course of the class, as the API says it now. */
  category: CourseCategory;
}

/**
 * "Nível básico — herdado do curso": the level of a class is never its own, it is the category of
 * its course (RN-14, RF-029), so the tag says where it comes from. It is read from the course on
 * every render and kept nowhere, which is what makes it follow the course when the category changes.
 */
export function InheritedLevelBadge({ category }: InheritedLevelBadgeProps): ReactElement {
  const { t } = useTranslation("classes");

  return <Badge tone="info">{t(`inheritedLevel.${category}`)}</Badge>;
}
