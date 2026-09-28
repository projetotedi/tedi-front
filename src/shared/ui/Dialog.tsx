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
}

export function Dialog({
  isOpen,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
  isDismissable = true,
}: DialogProps): ReactElement {
  const descriptionId = useId();

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={false}
      isKeyboardDismissDisabled={!isDismissable}
    >
      {/* O HeroUI ajusta o container ao conteúdo (`sm:w-fit`) e limita o diálogo a 448px: `sm:w-full` e `max-w-160` dão os 640px. */}
      <Modal.Container placement="center" className="sm:w-full">
        <Modal.Dialog
          className="max-w-160"
          aria-describedby={description ? descriptionId : undefined}
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
