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
}

/** Diálogo acessível sobre o HeroUI Modal. Toque fora não fecha (isDismissable={false}); Esc fecha. */
export function Dialog({
  isOpen,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
}: DialogProps): ReactElement {
  const descriptionId = useId();

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false}>
      <Modal.Container placement="center" className="max-w-160">
        <Modal.Dialog aria-describedby={description ? descriptionId : undefined}>
          <Modal.CloseTrigger aria-label={closeLabel} className="min-h-11 min-w-11" />
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
