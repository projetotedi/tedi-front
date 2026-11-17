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

/** A button of the toast that does one thing ("Ver histórico"); pressing it also closes the toast. */
export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface SuccessToastOptions extends ToastOptions {
  /**
   * With an action the toast stays until it is pressed or closed: an action that leaves by itself
   * after eight seconds is not reachable in time by everyone (WCAG 2.2.1, public of older people).
   */
  action?: ToastAction;
}

// The "success" button of the Figma (#17c964) with the foreground text: 8,1:1.
const ACTION_CLASS =
  "min-h-11 shrink-0 self-center bg-tedi-action-success px-4 text-base text-foreground";

export function ToastProvider({ regionLabel, closeLabel }: ToastProviderProps): ReactElement {
  return (
    <HeroToast.Provider aria-label={regionLabel} maxVisibleToasts={1}>
      {({ toast: queued }) => {
        const { title, description, variant, actionProps } = queued.content;

        return (
          <HeroToast toast={queued} variant={variant}>
            <HeroToast.Indicator variant={variant} className="self-center" />
            <HeroToast.Content>
              <HeroToast.Title className="text-base">{title}</HeroToast.Title>
              {description ? (
                <HeroToast.Description className="text-base">{description}</HeroToast.Description>
              ) : null}
            </HeroToast.Content>
            {actionProps?.children ? (
              <HeroToast.ActionButton
                {...actionProps}
                className={ACTION_CLASS}
                onPress={(event) => {
                  heroToast.close(queued.key);
                  actionProps.onPress?.(event);
                }}
              />
            ) : null}
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
  success(message: ReactNode, { action, ...options }: SuccessToastOptions = {}): string {
    return heroToast.success(message, {
      ...options,
      actionProps:
        action === undefined ? undefined : { children: action.label, onPress: action.onPress },
      timeout: action === undefined ? TOAST_TIMEOUT_MS : 0,
    });
  },
  /** Neither success nor failure: a fact the person should know ("Lançamento rejeitado"). */
  neutral(message: ReactNode, options: ToastOptions = {}): string {
    return heroToast(message, { ...options, variant: "default", timeout: TOAST_TIMEOUT_MS });
  },
  error(message: ReactNode, options: ToastOptions = {}): string {
    return heroToast.danger(message, { ...options, timeout: TOAST_TIMEOUT_MS });
  },
  /** Closes one toast, by the key `success`, `neutral` or `error` returned. */
  close(key: string): void {
    heroToast.close(key);
  },
  clear(): void {
    heroToast.clear();
  },
};
