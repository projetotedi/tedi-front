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
  /**
   * Se `false`, bloqueia fechar por Esc ou pelo botão X — o clique fora já é sempre bloqueado
   * (`isDismissable={false}` fixo no Modal.Backdrop, ver abaixo). Usar enquanto uma mutação em
   * andamento não pode ser interrompida sem perder o que ela retorna (ex.: um link exibido uma
   * única vez).
   * @default true
   */
  isDismissable?: boolean;
}

/**
 * Diálogo acessível sobre o HeroUI Modal. Toque fora nunca fecha (isDismissable={false} fixo no
 * Modal.Backdrop); Esc e o X fecham, a menos que a prop `isDismissable` deste componente seja
 * `false`.
 */
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
      {/*
        Diálogo de 640px (frame 50:1108). O HeroUI ajusta o container ao conteúdo (`sm:w-fit`) e
        limita o diálogo a 448px (tamanho `md`): `sm:w-full` solta o container e `max-w-160` troca
        o limite. O diálogo tem 640px em telas largas e encolhe com a tela.
      */}
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
