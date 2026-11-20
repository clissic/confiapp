import { useEffect, useState, type ImgHTMLAttributes } from 'react';

import { apiClient } from '@/shared/api/client';

function storageKeyFromRef(url: string): string | undefined {
  if (!url.startsWith('storage://')) return undefined;
  const key = url.slice('storage://'.length).trim();
  return key.length >= 3 ? key : undefined;
}

function isBrowserDisplayableUrl(url: string): boolean {
  return (
    /^https?:\/\//i.test(url) ||
    url.startsWith('data:image/') ||
    url.startsWith('blob:')
  );
}

async function fetchSignedMediaUrl(storageKey: string): Promise<string | null> {
  try {
    const { data } = await apiClient.post<{ url: string }>('/media/signed-url', {
      storageKey,
    });
    return data.url || null;
  } catch {
    return null;
  }
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
  /** Si ya conocés el storageKey (además o en lugar de un src storage://). */
  storageKey?: string;
};

/**
 * Resuelve `storage://key` a URL firmada https para mostrar en <img>.
 * http(s) / data / blob se usan tal cual.
 */
export function ResolvedMediaImage({ src, storageKey, alt, ...rest }: Props) {
  const key = storageKey?.trim() || storageKeyFromRef(src);
  const [resolved, setResolved] = useState<string | null>(() =>
    isBrowserDisplayableUrl(src) ? src : null,
  );

  useEffect(() => {
    let cancelled = false;

    if (isBrowserDisplayableUrl(src) && !key) {
      setResolved(src);
      return;
    }

    if (isBrowserDisplayableUrl(src) && key) {
      // API ya puede mandar URL firmada; usarla y refrescar si falla el load.
      setResolved(src);
      return;
    }

    if (!key) {
      setResolved(null);
      return;
    }

    setResolved(null);
    void fetchSignedMediaUrl(key).then((url) => {
      if (!cancelled) setResolved(url);
    });

    return () => {
      cancelled = true;
    };
  }, [src, key]);

  if (!resolved) {
    return (
      <span
        className="ca-media-img-pending"
        aria-hidden={alt ? undefined : true}
        role="img"
        aria-label={alt}
      >
        …
      </span>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt ?? ''}
      {...rest}
      onError={(event) => {
        rest.onError?.(event);
        if (!key || event.currentTarget.dataset.retried === '1') return;
        event.currentTarget.dataset.retried = '1';
        void fetchSignedMediaUrl(key).then((url) => {
          if (url) setResolved(url);
        });
      }}
    />
  );
}
