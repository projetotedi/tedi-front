import { Button as HeroButton, Spinner, type ButtonProps as HeroButtonProps } from "@heroui/react";

export type ButtonProps = Omit<HeroButtonProps, "className" | "isPending"> & {
  className?: string;
  isLoading?: boolean;
};

export function Button({
  className = "",
  isLoading = false,
  isIconOnly,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    "min-h-11 text-base",
    isIconOnly ? "min-w-11" : "",
    // O estado pendente do HeroUI usa `aria-disabled`, que aplica o esmaecimento de desabilitado.
    // Enquanto carrega o botão precisa continuar legível (texto branco sobre azul, 4,5:1).
    isLoading ? "opacity-100" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <HeroButton {...props} isIconOnly={isIconOnly} isPending={isLoading} className={classes}>
      {(renderProps) => (
        <>
          {isLoading && <Spinner aria-hidden="true" size="sm" color="current" />}
          {typeof children === "function" ? children(renderProps) : children}
        </>
      )}
    </HeroButton>
  );
}
