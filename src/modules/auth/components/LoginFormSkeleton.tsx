import { useTranslation } from "react-i18next";

import { Skeleton } from "@shared/ui";

export function LoginFormSkeleton() {
  const { t } = useTranslation("auth");

  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">{t("session.loading")}</span>
      <div aria-hidden className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="ml-auto h-6 w-32" />
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}
