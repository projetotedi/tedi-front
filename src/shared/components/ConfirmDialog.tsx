import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Corpo da confirmação: resumo da pessoa, avisos, notas. */
  children: ReactNode;
  confirmLabel: string;
  /** Texto do botão enquanto `isConfirming`; sem ele, o botão mantém `confirmLabel`. */
  confirmingLabel?: string;
  cancelLabel: string;
  closeLabel: string;
  onConfirm: () => void;
  /** Voltar, X e Esc chamam isto. O diálogo não se fecha sozinho: quem o abriu o desmonta. */
  onCancel: () => void;
  /** Enquanto true, o botão carrega e Esc, X e Voltar ficam bloqueados (a mutação não se cancela). */
  isConfirming?: boolean;
  /** `danger` pinta a confirmação de vermelho sólido (desativar, revogar). */
  tone?: "danger" | "primary";
  /** Falha da última tentativa. Aparece como alerta e recebe o foco. */
  errorMessage?: string;
}

/**
 * Confirmação de ação destrutiva ou irreversível, sobre o `Dialog` (640px). Só recebe textos já
 * traduzidos: não conhece o domínio. Quem usa decide quando monta, o que a confirmação faz
 * (`onConfirm`) e o que mostrar de erro.
 */
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  confirmingLabel,
  cancelLabel,
  closeLabel,
  onConfirm,
  onCancel,
  isConfirming = false,
  tone = "primary",
  errorMessage,
}: ConfirmDialogProps): ReactElement {
  const errorRef = useRef<HTMLDivElement>(null);

  // O alerta de erro (`role="alert"`) já anuncia; o foco leva quem usa teclado até ele.
  useEffect(() => {
    if (errorMessage) errorRef.current?.focus();
  }, [errorMessage]);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
      closeLabel={closeLabel}
      isDismissable={!isConfirming}
      footer={
        <>
          <Button variant="secondary" isDisabled={isConfirming} onPress={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            isLoading={isConfirming}
            onPress={onConfirm}
          >
            {isConfirming && confirmingLabel ? confirmingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        {errorMessage ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{errorMessage}</Alert>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
