import { Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';

import { formatDateTime, formatMoney } from '@/shared/lib/money';

import type { UserProfile } from '../../model/types';

export function WalletSection({ profile }: { profile: UserProfile }) {
  const { wallet } = profile;

  return (
    <section>
      <h3 className="ca-section-title">Wallet</h3>
      <p className="ca-section-lead">
        Resumen de saldos. Gestioná retiros, comisiones y exportá el historial en Wallet.
      </p>

      <div className="ca-wallet-card">
        <div className="ca-wallet-card__head">
          <Wallet size={22} strokeWidth={1.75} />
          <div>
            <p className="mb-0">Saldo disponible</p>
            <strong>{formatMoney(wallet.availableCents, wallet.currency)}</strong>
          </div>
          <Badge className="ca-badge-positive ms-auto">{wallet.status}</Badge>
        </div>

        <div className="ca-stat-row">
          <div className="ca-stat">
            <span className="ca-stat__label">Pendiente</span>
            <strong>{formatMoney(wallet.pendingCents, wallet.currency)}</strong>
          </div>
          <div className="ca-stat">
            <span className="ca-stat__label">Retenido (escrow)</span>
            <strong>{formatMoney(wallet.heldCents, wallet.currency)}</strong>
          </div>
          <div className="ca-stat">
            <span className="ca-stat__label">Ganado (histórico)</span>
            <strong>{formatMoney(wallet.lifetimeEarnedCents, wallet.currency)}</strong>
          </div>
          <div className="ca-stat">
            <span className="ca-stat__label">Gastado (histórico)</span>
            <strong>{formatMoney(wallet.lifetimeSpentCents, wallet.currency)}</strong>
          </div>
        </div>

        {wallet.lastMovementAt ? (
          <p className="ca-wallet-card__foot mb-2">
            Último movimiento: {formatDateTime(wallet.lastMovementAt)}
          </p>
        ) : null}

        <Link to="/wallet" className="btn ca-btn-cta">
          Abrir Wallet
        </Link>
      </div>
    </section>
  );
}
