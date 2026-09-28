import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

interface HeaderTitleContextValue {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const HeaderTitleContext = createContext<HeaderTitleContextValue | null>(null);

export function HeaderTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return <HeaderTitleContext value={{ title, setTitle }}>{children}</HeaderTitleContext>;
}

export function useHeaderTitleOverride(): string | null {
  return useContext(HeaderTitleContext)?.title ?? null;
}

/** `useLayoutEffect`: o título da rota não pode aparecer por um quadro antes do pedido da tela. */
export function useSetHeaderTitle(title: string): void {
  const context = useContext(HeaderTitleContext);
  const setTitle = context?.setTitle;

  useLayoutEffect(() => {
    setTitle?.(title);
    return () => setTitle?.(null);
  }, [setTitle, title]);
}
