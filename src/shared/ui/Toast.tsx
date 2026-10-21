import { Toast as HeroToast, toast as heroToast } from "@heroui/react";
import type { ReactElement, ReactNode } from "react";

const TOAST_TIMEOUT_MS = 8000;

export interface ToastProviderProps {
  regionLabel: string;
  closeLabel: string;
}

export interface ToastOptions {
  description?: ReactNode;
}

export function ToastProvider({ regionLabel, closeLabel }: ToastProviderProps): ReactElement {
  return (
    <HeroToast.Provider aria-label={regionLabel} maxVisibleToasts={1}>
      {({ toast: queued }) => {
        const { title, description, variant } = queued.content;

        return (
          <HeroToast toast={queued} variant={variant}>
            <HeroToast.Indicator variant={variant} />
            <HeroToast.Content>
              <HeroToast.Title className="text-base">{title}</HeroToast.Title>
              {description ? (
                <HeroToast.Description className="text-base">{description}</HeroToast.Description>
              ) : null}
            </HeroToast.Content>
            <HeroToast.CloseButton
              aria-label={closeLabel}
              className="pointer-events-auto static size-11 shrink-0 self-center opacity-100 [&_svg]:size-5"
            />
          </HeroToast>
        );
      }}
    </HeroToast.Provider>
  );
}

export const toast = {
  success(message: ReactNode, options: ToastOptions = {}): string {
    return heroToast.success(message, { ...options, timeout: TOAST_TIMEOUT_MS });
  },
  error(message: ReactNode, options: ToastOptions = {}): string {
    return heroToast.danger(message, { ...options, timeout: TOAST_TIMEOUT_MS });
  },
  clear(): void {
    heroToast.clear();
  },
};
