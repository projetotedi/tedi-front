import type { ReactNode } from "react";

interface PageTitleProps {
  children: ReactNode;
}

export function PageTitle({ children }: PageTitleProps) {
  return <h2 className="text-2xl font-semibold mb-4">{children}</h2>;
}
