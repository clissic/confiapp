import { useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap';
import { Download, Wallet } from 'lucide-react';

import { convertCents } from '@/shared/lib/fx';
import { CURRENCY_OPTIONS, formatDateTime, formatMoney } from '@/shared/lib/money';
import { usePreferencesSnapshot } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';

import {
  useCompleteWithdrawal,
  useExportWallet,
  useRequestWithdrawal,
  useWalletCommissions,
  useWalletMovements,
  useWalletSummary,
  useWalletWithdrawals,
} from '../hooks/useWallet';
import { WalletStatusBadge } from './WalletStatusBadge';
import '../styles/wallet.css';

export function WalletPage() {
  const prefs = usePreferencesSnapshot();
  const toast = useAppToast();
  const displayCurrency = prefs.currency;
  const displayCurrencyLabel =
    CURRENCY_OPTIONS.find((item) => item.code === displayCurrency)?.label ?? displayCurrency;

  const { data: summaryRes, isFetching } = useWalletSummary();
  const { data: movementsRes } = useWalletMovements();
  const { data: commissionsRes } = useWalletCommissions();
  const { data: withdrawalsRes } = useWalletWithdrawals();
  const requestWd = useRequestWithdrawal();
  const completeWd = useCompleteWithdrawal();
  const exportWd = useExportWallet();

  const summary = summaryRes?.data;
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onWithdraw = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Ingresá un monto válido');
      return;
    }

    const walletCurrency = (summary?.currency ?? 'USD').toUpperCase();
    const displayCents = Math.round(value * 100);
    let amountInWalletUnits = value;

    if (displayCurrency !== walletCurrency) {
      if (!prefs.rates) {
        setError('Todavía no hay cotización para convertir el monto. Reintentá en unos segundos.');
        return;
      }
      const walletCents = convertCents(
        displayCents,
        displayCurrency,
        walletCurrency,
        prefs.rates,
      );
      amountInWalletUnits = walletCents / 100;
    }

    try {
      await requestWd.mutateAsync({
        amount: amountInWalletUnits,
        destinationHint: destination.trim() || undefined,
      });
      toast.success('Retiro solicitado. El monto pasó a Pendiente.');
      setAmount('');
    } catch {
      setError('No se pudo solicitar el retiro. Revisá el saldo disponible.');
    }
  };

  const onExport = async () => {
    setError(null);
    try {
      await exportWd.mutateAsync();
      toast.success('Historial exportado (CSV).');
    } catch {
      setError('No se pudo exportar el historial.');
    }
  };

  return (
    <div className="ca-wallet">
      <header className="ca-wallet__header">
        <div>
          <p className="ca-wallet__kicker">Billetera</p>
          <h2 className="ca-wallet__title">Wallet</h2>
          <p className="ca-wallet__lead">
            Saldo, pendiente, movimientos, comisiones y retiros en {displayCurrencyLabel}.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <WalletStatusBadge status={summary?.status} />
          <Button
            variant="outline-secondary"
            disabled={exportWd.isPending}
            onClick={() => void onExport()}
          >
            <Download size={16} className="me-1" />
            Exportar historial
          </Button>
        </div>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <section className="ca-wallet-balances">
        <div className="ca-wallet-balance ca-wallet-balance--main">
          <Wallet size={22} />
          <div className="ca-wallet-balance__copy">
            <span>Saldo disponible</span>
            <strong>
              {summary ? formatMoney(summary.saldoCents, summary.currency) : '—'}
            </strong>
          </div>
          {isFetching ? <Spinner size="sm" animation="border" /> : null}
        </div>
        <div className="ca-wallet-balance">
          <span>Pendiente</span>
          <strong>
            {summary ? formatMoney(summary.pendienteCents, summary.currency) : '—'}
          </strong>
        </div>
        <div className="ca-wallet-balance">
          <span>Retenido (escrow)</span>
          <strong>
            {summary ? formatMoney(summary.retenidoCents, summary.currency) : '—'}
          </strong>
        </div>
        <div className="ca-wallet-balance">
          <span>Comisiones (acum.)</span>
          <strong>
            {summary ? formatMoney(summary.commissionsTotalCents, summary.currency) : '—'}
          </strong>
        </div>
      </section>

      <div className="ca-wallet__grid">
        <section className="ca-wallet-panel">
          <h3>Retiros</h3>
          <Form className="ca-wallet-withdraw" onSubmit={(e) => void onWithdraw(e)}>
            <Form.Group>
              <Form.Label>Monto ({displayCurrencyLabel})</Form.Label>
              <Form.Control
                type="number"
                min={displayCurrency === 'UYU' ? 1 : 0.01}
                step={displayCurrency === 'UYU' ? '1' : '0.01'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={displayCurrency === 'UYU' ? '500' : '50.00'}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Destino (alias / hint)</Form.Label>
              <Form.Control
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Alias Mercado Pago"
              />
            </Form.Group>
            <Button type="submit" className="ca-btn-cta" disabled={requestWd.isPending}>
              {requestWd.isPending ? 'Solicitando…' : 'Solicitar retiro'}
            </Button>
          </Form>

          {(withdrawalsRes?.items.length ?? 0) === 0 ? (
            <p className="ca-wallet__hint">Sin retiros todavía.</p>
          ) : (
            <ul className="ca-wallet-list">
              {withdrawalsRes?.items.map((w) => (
                <li key={w.id}>
                  <div>
                    <strong>{formatMoney(w.amountCents, w.currency)}</strong>
                    <Badge bg="secondary" className="ms-2">
                      {w.status}
                    </Badge>
                    <div className="ca-wallet__hint">
                      {w.destinationHint || 'Sin destino'} · {formatDateTime(w.requestedAt)}
                    </div>
                  </div>
                  {w.status === 'PENDING' || w.status === 'PROCESSING' ? (
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={completeWd.isPending}
                      onClick={() => void completeWd.mutateAsync(w.id)}
                    >
                      Completar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ca-wallet-panel">
          <h3>Comisiones</h3>
          {(commissionsRes?.items.length ?? 0) === 0 ? (
            <p className="ca-wallet__hint">Sin comisiones registradas.</p>
          ) : (
            <Table responsive size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Monto</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {commissionsRes?.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.label}</td>
                    <td>{formatMoney(c.amountCents, c.currency)}</td>
                    <td>{formatDateTime(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>

      <section className="ca-wallet-panel">
        <div className="ca-wallet__row">
          <h3 className="mb-0">Movimientos / Historial</h3>
          <span className="ca-wallet__hint">
            {movementsRes?.items.length ?? 0} registros
            {summary?.lastMovementAt
              ? ` · último ${formatDateTime(summary.lastMovementAt)}`
              : ''}
          </span>
        </div>
        {(movementsRes?.items.length ?? 0) === 0 ? (
          <p className="ca-wallet__hint">Todavía no hay movimientos.</p>
        ) : (
          <Table responsive size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {movementsRes?.items.map((m) => (
                <tr key={m.id}>
                  <td>{formatDateTime(m.createdAt)}</td>
                  <td>
                    <Badge bg={m.direction === 'CREDIT' ? 'success' : 'secondary'}>
                      {m.type}
                    </Badge>
                  </td>
                  <td>{m.description}</td>
                  <td>
                    {m.direction === 'DEBIT' ? '−' : '+'}
                    {formatMoney(m.amountCents, m.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
