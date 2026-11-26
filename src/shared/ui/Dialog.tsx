import { Modal } from "@heroui/react";
import { useId, type ReactElement, type ReactNode } from "react";

export interface DialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description?: ReactNode;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  isDismissable?: boolean;
  /** `default` 640px, `wide` 800px (listas), `extraWide` 1040px (edição em duas colunas), `table` 1128px (a table of many columns, with no sideways scroll), `fullscreen` the whole screen (a form on a phone: the body scrolls and the footer stays at the bottom). */
  size?: "default" | "wide" | "extraWide" | "table" | "fullscreen";
  /**
   * The id (or ids, separated by spaces) of what in the body also describes the dialog, read when it
   * opens, after the `description`. For a notice that has to sit in the body, under the title.
   */
  "aria-describedby"?: string;
}

const SIZE_CLASSES = {
  default: "max-w-160",
  wide: "max-w-200",
  extraWide: "max-w-260",
  table: "max-w-282",
  fullscreen: "max-w-none",
} as const satisfies Record<NonNullable<DialogProps["size"]>, string>;

export function Dialog({
  isOpen,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
  isDismissable = true,
  size = "default",
  "aria-describedby": ariaDescribedBy,
}: DialogProps): ReactElement {
  const descriptionId = useId();
  const describedBy = [description ? descriptionId : undefined, ariaDescribedBy].filter(
    (id): id is string => id !== undefined && id !== "",
  );

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={false}
      isKeyboardDismissDisabled={!isDismissable}
    >
      {/* O HeroUI ajusta o container ao conteúdo (`sm:w-fit`) e limita o diálogo a 448px: `sm:w-full` e `max-w-160` dão os 640px. */}
      <Modal.Container
        placement="center"
        className="sm:w-full"
        size={size === "fullscreen" ? "full" : undefined}
      >
        <Modal.Dialog
          className={SIZE_CLASSES[size]}
          aria-describedby={describedBy.length === 0 ? undefined : describedBy.join(" ")}
        >
          <Modal.CloseTrigger
            aria-label={closeLabel}
            className="min-h-11 min-w-11"
            isDisabled={!isDismissable}
          />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          {description ? (
            <p id={descriptionId} className="text-base text-muted">
              {description}
            </p>
          ) : null}
          <Modal.Body>{children}</Modal.Body>
          {footer ? <Modal.Footer>{footer}</Modal.Footer> : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
