import '../styles/wallet.css';

const KNOWN_STATUSES = new Set(['ACTIVE', 'FROZEN', 'CLOSED']);

function statusClass(status: string): string {
  const code = status.toUpperCase();
  if (KNOWN_STATUSES.has(code)) return `ca-wallet-status--${code.toLowerCase()}`;
  return 'ca-wallet-status--unknown';
}

/** Badge de estado operativo de la wallet (ACTIVE / FROZEN / CLOSED). */
export function WalletStatusBadge({
  status,
  className = '',
}: {
  status: string | undefined | null;
  className?: string;
}) {
  const label = (status ?? '—').toUpperCase();
  const isActive = label === 'ACTIVE';

  return (
    <span
      className={['ca-wallet-status', statusClass(label), className].filter(Boolean).join(' ')}
      title={`Estado de wallet: ${label}`}
      aria-label={`Estado de wallet: ${label}`}
    >
      <span
        className={`ca-wallet-status__dot${isActive ? ' ca-wallet-status__dot--pulse' : ''}`}
        aria-hidden
      />
      <span className="ca-wallet-status__label">{label}</span>
    </span>
  );
}
