import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

export type AppToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface ShowToastOptions {
  variant?: AppToastVariant;
  /** Autohide delay in ms (default 5000). */
  delay?: number;
  title?: string;
}

interface ToastItem {
  id: string;
  message: string;
  variant: AppToastVariant;
  delay: number;
  title: string;
}

interface ToastContextValue {
  showToast: (message: string, options?: ShowToastOptions) => void;
  success: (message: string, options?: Omit<ShowToastOptions, 'variant'>) => void;
  error: (message: string, options?: Omit<ShowToastOptions, 'variant'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_TITLE: Record<AppToastVariant, string> = {
  success: 'Listo',
  danger: 'Error',
  warning: 'Atención',
  info: 'Aviso',
};

let toastSeq = 0;

/** Toasts globales Bootstrap (esquina inferior derecha, stack). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: ShowToastOptions) => {
    const variant = options?.variant ?? 'success';
    const id = `toast-${++toastSeq}-${Date.now()}`;
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        variant,
        delay: options?.delay ?? 5000,
        title: options?.title ?? VARIANT_TITLE[variant],
      },
    ]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message, options) => showToast(message, { ...options, variant: 'success' }),
      error: (message, options) => showToast(message, { ...options, variant: 'danger' }),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer
        className="ca-toast-container p-3"
        position="bottom-end"
        containerPosition="fixed"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            className={`ca-toast ca-toast--${toast.variant}`}
            onClose={() => removeToast(toast.id)}
            show
            autohide
            delay={toast.delay}
            role={toast.variant === 'danger' ? 'alert' : 'status'}
            aria-live={toast.variant === 'danger' ? 'assertive' : 'polite'}
          >
            <Toast.Header closeButton className="ca-toast__header">
              <strong className="me-auto ca-toast__title">{toast.title}</strong>
            </Toast.Header>
            <Toast.Body className="ca-toast__body">{toast.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useAppToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useAppToast debe usarse dentro de ToastProvider');
  }
  return ctx;
}
