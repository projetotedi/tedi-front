import { Button as HeroButton, Spinner, type ButtonProps as HeroButtonProps } from "@heroui/react";

export type ButtonProps = Omit<HeroButtonProps, "className" | "isPending"> & {
  className?: string;
  /**
   * Requisição em andamento: mostra um spinner antes do texto e bloqueia novos toques sem
   * tirar o foco do botão (estado "pendente" do React Aria: `aria-disabled`, sem `onPress`
   * e sem envio de formulário). Quem usa troca o texto (ex.: "Entrando…") em `children`.
   */
  isLoading?: boolean;
};

/**
 * Botão do TEDI sobre o HeroUI. Alvo de toque de 44px (público idoso): `min-h-11` sempre e
 * `min-w-11` quando só há ícone. Largura total com `fullWidth` (vem do HeroUI).
 */
export function Button({
  className = "",
  isLoading = false,
  isIconOnly,
  children,
  ...props
}: ButtonProps) {
  const sizing = isIconOnly ? "min-h-11 min-w-11" : "min-h-11";
  // O estado pendente do HeroUI usa `aria-disabled`, que aplica o esmaecimento de desabilitado.
  // Enquanto carrega o botão precisa continuar legível (texto branco sobre azul, 4,5:1).
  const loading = isLoading ? "opacity-100" : "";

  return (
    <HeroButton
      {...props}
      isIconOnly={isIconOnly}
      isPending={isLoading}
      className={`${sizing} ${loading} ${className}`.trim()}
    >
      {(renderProps) => (
        <>
          {isLoading && <Spinner aria-hidden="true" size="sm" color="current" />}
          {typeof children === "function" ? children(renderProps) : children}
        </>
      )}
    </HeroButton>
  );
}
