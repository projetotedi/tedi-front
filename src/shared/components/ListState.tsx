import type { ReactElement } from "react";

import type { ListStateVariant } from "../lib/list-state";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";

export interface ListStateAction {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
}

export interface ListStateProps {
  variant: ListStateVariant;
  title: string;
  description?: string;
  action?: ListStateAction;
  /** URL de um SVG decorativo, pintado com a cor do selo (o `fill` do arquivo não conta). */
  icon?: string;
}

const SKELETON_ROWS = 6;

// Contraste do ícone sobre o círculo: 5,5:1 (empty), 6,7:1 (noResults) e 7,1:1 (error; o
// `text-danger` sobre `bg-danger-soft` daria 4,4:1).
const BADGE_CLASSES = {
  empty: "bg-tedi-badge text-tedi-badge-foreground",
  noResults: "bg-tedi-neutral text-tedi-neutral-foreground",
  error: "bg-danger-soft text-danger-soft-foreground",
} as const;

function MaskedIcon({ url }: { url: string }): ReactElement {
  // Máscara em vez de <img>: os SVGs do Figma têm `fill` fixo e não herdam `currentColor`.
  const image = `url("${url}")`;

  return (
    <span
      className="size-5 bg-current mask-contain mask-center mask-no-repeat"
      style={{ maskImage: image, WebkitMaskImage: image }}
    />
  );
}

function AlertTriangleIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function LoadingState({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col py-2">
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-6 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-11/12" />
            </div>
          </div>
        ))}
      </div>
      <p className="pt-4 text-sm text-muted">{label}</p>
    </div>
  );
}

export function ListState({
  variant,
  title,
  description,
  action,
  icon,
}: ListStateProps): ReactElement {
  if (variant === "loading") return <LoadingState label={title} />;

  const glyph =
    variant === "error" ? <AlertTriangleIcon /> : icon ? <MaskedIcon url={icon} /> : null;

  const message = (
    <>
      {glyph ? (
        <div
          aria-hidden="true"
          className={`flex size-10 items-center justify-center rounded-full ${BADGE_CLASSES[variant]}`}
        >
          {glyph}
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
    </>
  );

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      {variant === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-3">
          {message}
        </div>
      ) : (
        message
      )}
      {action ? (
        <Button
          variant={variant === "noResults" ? "secondary" : "primary"}
          isLoading={action.isLoading}
          onPress={action.onPress}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
