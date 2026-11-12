import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useRef } from 'react';

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

type Props = {
  onToken: (token: string | null) => void;
  className?: string;
};

/** Widget Cloudflare Turnstile. Si no hay site key, no renderiza (dev local). */
export function TurnstileField({ onToken, className }: Props) {
  const ref = useRef<TurnstileInstance | null>(null);
  if (!siteKey?.trim()) return null;

  return (
    <div className={className}>
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{ theme: 'auto', size: 'flexible' }}
        onSuccess={(token) => onToken(token)}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
      />
    </div>
  );
}

export function isTurnstileEnabled(): boolean {
  return Boolean(siteKey?.trim());
}
