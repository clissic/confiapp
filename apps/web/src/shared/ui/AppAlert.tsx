import { forwardRef, useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { Alert as BootstrapAlert } from 'react-bootstrap';

export type AppAlertProps = ComponentPropsWithoutRef<typeof BootstrapAlert>;

/**
 * Alert Bootstrap con scroll automático en danger/warning.
 * Preferible para código nuevo; el observer global cubre también Alert crudo.
 */
export const AppAlert = forwardRef<HTMLDivElement, AppAlertProps>(function AppAlert(
  { variant = 'primary', children, ...props },
  ref,
) {
  const localRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (variant !== 'danger' && variant !== 'warning') return;
    const el = localRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    });
  }, [variant, children]);

  return (
    <BootstrapAlert
      {...props}
      variant={variant}
      ref={(node) => {
        localRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
    >
      {children}
    </BootstrapAlert>
  );
});
