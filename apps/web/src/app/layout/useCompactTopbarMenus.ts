import { useEffect, useState } from 'react';

const COMPACT_MQ = '(max-width: 991.98px)';

/** True debajo de `lg` (mismo corte que bottom nav / paneles topbar mobile). */
export function useCompactTopbarMenus(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(COMPACT_MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_MQ);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return compact;
}
