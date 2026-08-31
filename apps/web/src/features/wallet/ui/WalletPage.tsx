import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Accordion, Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Landmark,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { convertCents } from '@/shared/lib/fx';
import { CURRENCY_OPTIONS, formatDateTime, formatMoney } from '@/shared/lib/money';
import { usePreferencesSnapshot } from '@/shared/preferences';
import { useAppToast } from '@/shared/ui';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { formatPayoutMethodType } from '@/features/profile/model/payout-methods';
import type { ProfilePayoutMethod } from '@/features/profile/model/types';

import {
  useCompleteWithdrawal,
  useExportWallet,
  useRequestWithdrawal,
  useWalletCommissions,
  useWalletMovements,
  useWalletSummary,
  useWalletWithdrawals,
} from '../hooks/useWallet';
import {
  WALLET_COMMISSION_TYPE_LABELS,
  WALLET_MOVEMENT_TYPE_LABELS,
  type WalletCommissionsQuery,
  type WalletMovementsQuery,
} from '../model/types';
import { WalletStatusBadge } from './WalletStatusBadge';
import '../styles/wallet.css';

const MOVEMENT_PAGE_SIZE = 10;
const COMMISSION_PAGE_SIZE = 10;
const MIN_WITHDRAWAL_CENTS = 1000;
const PAYOUT_SETTINGS_HREF = '/perfil?tab=settings#metodo-cobro';

const MOVEMENT_TYPE_OPTIONS = Object.entries(WALLET_MOVEMENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const COMMISSION_TYPE_OPTIONS = Object.entries(WALLET_COMMISSION_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function maskAccountNumber(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

function formatPayoutOptionLabel(method: ProfilePayoutMethod): string {
  return `${method.bank} · ${formatPayoutMethodType(method)} · ${maskAccountNumber(method.number)}`;
}

function formatPayoutDestinationHint(method: ProfilePayoutMethod): string {
  return `${method.bank} · ${formatPayoutMethodType(method)} · ${maskAccountNumber(method.number)}`;
}

function toStartIso(date: string): string | undefined {
  if (!date) return undefined;
  return new Date(`${date}T00:00:00`).toISOString();
}

function toEndIso(date: string): string | undefined {
  if (!date) return undefined;
  return new Date(`${date}T23:59:59.999`).toISOString();
}

export function WalletPage() {
  const prefs = usePreferencesSnapshot();
  const toast = useAppToast();
  const displayCurrency = prefs.currency;
  const displayCurrencyLabel =
    CURRENCY_OPTIONS.find((item) => item.code === displayCurrency)?.label ?? displayCurrency;

  const { data: summaryRes, isFetching } = useWalletSummary();
  const { data: profileRes } = useProfile();
  const { data: withdrawalsRes } = useWalletWithdrawals();
  const requestWd = useRequestWithdrawal();
  const completeWd = useCompleteWithdrawal();
  const exportWd = useExportWallet();

  const summary = summaryRes?.data;
  const payoutMethods = profileRes?.profile.payoutMethods ?? [];
  const [amount, setAmount] = useState('');
  const [payoutMethodId, setPayoutMethodId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payoutMethods.length) {
      setPayoutMethodId('');
      return;
    }
    setPayoutMethodId((current) =>
      payoutMethods.some((m) => m.id === current) ? current : payoutMethods[0]!.id,
    );
  }, [payoutMethods]);

  const selectedPayout = useMemo(
    () => payoutMethods.find((m) => m.id === payoutMethodId) ?? null,
    [payoutMethodId, payoutMethods],
  );

  const [movementsPage, setMovementsPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState({
    type: '',
    direction: '',
    transactionCode: '',
    from: '',
    to: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);

  const movementsQuery = useMemo<WalletMovementsQuery>(
    () => ({
      page: movementsPage,
      limit: MOVEMENT_PAGE_SIZE,
      type: appliedFilters.type || undefined,
      direction: appliedFilters.direction || undefined,
      transactionCode: appliedFilters.transactionCode.trim() || undefined,
      from: toStartIso(appliedFilters.from),
      to: toEndIso(appliedFilters.to),
    }),
    [appliedFilters, movementsPage],
  );

  const { data: movementsRes, isFetching: movementsFetching } =
    useWalletMovements(movementsQuery);

  const activeFilterCount = [
    appliedFilters.type,
    appliedFilters.direction,
    appliedFilters.transactionCode.trim(),
    appliedFilters.from,
    appliedFilters.to,
  ].filter(Boolean).length;

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setAppliedFilters(draftFilters);
    setMovementsPage(1);
  };

  const clearFilters = () => {
    const empty = {
      type: '',
      direction: '',
      transactionCode: '',
      from: '',
      to: '',
    };
    setDraftFilters(empty);
    setAppliedFilters(empty);
    setMovementsPage(1);
  };

  const [commissionsPage, setCommissionsPage] = useState(1);
  const [draftCommissionFilters, setDraftCommissionFilters] = useState({
    type: '',
    transactionCode: '',
    from: '',
    to: '',
  });
  const [appliedCommissionFilters, setAppliedCommissionFilters] =
    useState(draftCommissionFilters);

  const commissionsQuery = useMemo<WalletCommissionsQuery>(
    () => ({
      page: commissionsPage,
      limit: COMMISSION_PAGE_SIZE,
      type: appliedCommissionFilters.type || undefined,
      transactionCode: appliedCommissionFilters.transactionCode.trim() || undefined,
      from: toStartIso(appliedCommissionFilters.from),
      to: toEndIso(appliedCommissionFilters.to),
    }),
    [appliedCommissionFilters, commissionsPage],
  );

  const { data: commissionsRes, isFetching: commissionsFetching } =
    useWalletCommissions(commissionsQuery);

  const activeCommissionFilterCount = [
    appliedCommissionFilters.type,
    appliedCommissionFilters.transactionCode.trim(),
    appliedCommissionFilters.from,
    appliedCommissionFilters.to,
  ].filter(Boolean).length;

  const applyCommissionFilters = (event: FormEvent) => {
    event.preventDefault();
    setAppliedCommissionFilters(draftCommissionFilters);
    setCommissionsPage(1);
  };

  const clearCommissionFilters = () => {
    const empty = {
      type: '',
      transactionCode: '',
      from: '',
      to: '',
    };
    setDraftCommissionFilters(empty);
    setAppliedCommissionFilters(empty);
    setCommissionsPage(1);
  };

  const walletCurrency = (summary?.currency ?? 'UYU').toUpperCase();
  const withdrawableCents = useMemo(() => {
    if (!summary) return 0;
    if (typeof summary.salesWithdrawableCents === 'number') {
      return Math.max(0, summary.salesWithdrawableCents);
    }
    return Math.max(0, summary.saldoCents ?? 0);
  }, [summary]);

  const canWithdraw = withdrawableCents >= MIN_WITHDRAWAL_CENTS;

  const maxWithdrawDisplay = useMemo(() => {
    const displayCents = convertCents(
      withdrawableCents,
      walletCurrency,
      displayCurrency,
      prefs.rates,
    );
    return Math.floor((displayCents / 100) * 100) / 100;
  }, [withdrawableCents, walletCurrency, displayCurrency, prefs.rates]);

  const onAmountChange = (raw: string) => {
    if (raw === '') {
      setAmount('');
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return;
    const capped = Math.min(value, maxWithdrawDisplay);
    setAmount(String(capped));
  };

  const onWithdraw = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!canWithdraw) {
      setError('No tenés saldo disponible para retirar.');
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Ingresá un monto válido');
      return;
    }
    if (!selectedPayout) {
      setError('Elegí un método de cobro para recibir el retiro.');
      return;
    }

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

    if (Math.round(amountInWalletUnits * 100) > withdrawableCents) {
      setError('El monto supera el saldo disponible para retirar.');
      return;
    }

    try {
      await requestWd.mutateAsync({
        amount: amountInWalletUnits,
        destinationHint: formatPayoutDestinationHint(selectedPayout),
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
        <div className="ca-wallet__header-top">
          <div>
            <p className="ca-wallet__kicker">Billetera</p>
            <h2 className="ca-wallet__title">Wallet</h2>
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
        </div>
        <p className="ca-wallet__lead">
          Saldos retenidos en UYU (Mercado Pago). Se muestran convertidos a {displayCurrencyLabel}{' '}
          según tu preferencia; el valor en pantalla puede variar con la cotización.
        </p>
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

      {summary?.agentCommissions ? (
        <section className="ca-wallet-panel mb-3">
          <h3 className="h6">Comisiones de agente</h3>
          <p className="ca-wallet__hint mb-2">
            Tras completar una operación, tu 80% queda pendiente 21 días. Las transferencias del
            saldo disponible las realiza un administrador del <strong>1 al 10</strong> de cada mes.
          </p>
          <div className="ca-wallet-balances">
            <div className="ca-wallet-balance">
              <span>Ganado</span>
              <strong>
                {formatMoney(
                  summary.agentCommissions.earnedCents,
                  summary.agentCommissions.currency,
                )}
              </strong>
            </div>
            <div className="ca-wallet-balance">
              <span>Pendiente (21 días)</span>
              <strong>
                {formatMoney(
                  summary.agentCommissions.pendingCents,
                  summary.agentCommissions.currency,
                )}
              </strong>
            </div>
            <div className="ca-wallet-balance">
              <span>Disponible</span>
              <strong>
                {formatMoney(
                  summary.agentCommissions.availableCents,
                  summary.agentCommissions.currency,
                )}
              </strong>
            </div>
            <div className="ca-wallet-balance">
              <span>Liquidado</span>
              <strong>
                {formatMoney(
                  summary.agentCommissions.paidCents,
                  summary.agentCommissions.currency,
                )}
              </strong>
            </div>
          </div>
        </section>
      ) : null}

      <div className="ca-wallet__grid">
        <section className="ca-wallet-panel">
          <h3>Retiros</h3>
          {!canWithdraw ? (
            <p className="ca-wallet-withdrawals__disabled-msg">
              No tenés saldo disponible para retirar
              {withdrawableCents > 0
                ? ` (mínimo ${formatMoney(MIN_WITHDRAWAL_CENTS, walletCurrency)}).`
                : '.'}
            </p>
          ) : null}
          <div
            className={
              canWithdraw
                ? 'ca-wallet-withdrawals__action'
                : 'ca-wallet-withdrawals__action ca-wallet-withdrawals__action--disabled'
            }
          >
            {summary?.agentCommissions ? (
              <div className="ca-wallet-notice" role="note">
                <p>
                  Como agente, tus <strong>comisiones de intermediación</strong> se liquidan por
                  transferencia del 1 al 10 de cada mes. Acá solo podés retirar fondos de{' '}
                  <strong>ventas</strong>
                  {typeof summary.salesWithdrawableCents === 'number' ? (
                    <>
                      {' '}
                      (disponible:{' '}
                      <span className="ca-wallet-notice__amount">
                        {formatMoney(summary.salesWithdrawableCents, summary.currency)}
                      </span>
                      )
                    </>
                  ) : null}
                  .
                </p>
              </div>
            ) : null}

            {payoutMethods.length === 0 ? (
              <div className="ca-wallet-withdraw-empty">
                <div className="ca-wallet-withdraw-empty__icon" aria-hidden>
                  <Landmark size={22} strokeWidth={1.75} />
                </div>
                <div className="ca-wallet-withdraw-empty__copy">
                  <p className="ca-wallet-withdraw-empty__title">Método de cobro requerido</p>
                  <p className="ca-wallet-withdraw-empty__text">
                    Registrá una cuenta o alias en tu perfil para poder solicitar un retiro.
                  </p>
                </div>
                <Link
                  to={PAYOUT_SETTINGS_HREF}
                  className="btn ca-btn-cta ca-wallet-withdraw-empty__cta"
                >
                  Agregar método de cobro
                </Link>
              </div>
            ) : (
              <Form
                className="ca-wallet-withdraw"
                onSubmit={(e) => void onWithdraw(e)}
                aria-disabled={!canWithdraw}
              >
                <fieldset disabled={!canWithdraw} className="ca-wallet-withdraw__fieldset">
                  <Form.Group>
                    <Form.Label>Monto ({displayCurrencyLabel})</Form.Label>
                    <Form.Control
                      type="number"
                      min={displayCurrency === 'UYU' ? 1 : 0.01}
                      max={maxWithdrawDisplay}
                      step={displayCurrency === 'UYU' ? '1' : '0.01'}
                      value={amount}
                      onChange={(e) => onAmountChange(e.target.value)}
                      placeholder={displayCurrency === 'UYU' ? '500' : '50.00'}
                    />
                    <Form.Text className="ca-wallet__hint">
                      Máximo:{' '}
                      {formatMoney(withdrawableCents, walletCurrency)}
                      {summary?.agentCommissions ? ' (fondos de ventas)' : ''}
                    </Form.Text>
                  </Form.Group>
                  <Form.Group controlId="wallet-withdraw-destination">
                    <Form.Label>Método de cobro</Form.Label>
                    <Form.Select
                      value={payoutMethodId}
                      onChange={(e) => setPayoutMethodId(e.target.value)}
                      required
                    >
                      {payoutMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {formatPayoutOptionLabel(method)}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="ca-wallet__hint">
                      ¿Otro destino?{' '}
                      <Link to={PAYOUT_SETTINGS_HREF} className="ca-wallet-link">
                        Administrar métodos de cobro
                      </Link>
                    </Form.Text>
                  </Form.Group>
                  <Button
                    type="submit"
                    className="ca-btn-cta"
                    disabled={requestWd.isPending || !canWithdraw}
                  >
                    {requestWd.isPending ? 'Solicitando…' : 'Solicitar retiro'}
                  </Button>
                </fieldset>
              </Form>
            )}
          </div>

          {(withdrawalsRes?.items.length ?? 0) === 0 ? (
            <p className="ca-wallet-withdrawals__empty-list">Sin retiros todavía.</p>
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
          <div className="ca-wallet__row">
            <h3 className="mb-0">Comisiones</h3>
            <span className="ca-wallet__hint">
              {commissionsRes?.total ?? 0} registros
            </span>
          </div>

          <Accordion className="ca-wallet-filters">
            <Accordion.Item eventKey="0">
              <Accordion.Header>
                <span className="ca-wallet-filters__header">
                  <Filter size={15} strokeWidth={1.75} aria-hidden />
                  Filtros
                  {activeCommissionFilterCount > 0 ? (
                    <Badge bg="secondary" pill className="ca-wallet-filters__count">
                      {activeCommissionFilterCount}
                    </Badge>
                  ) : null}
                </span>
              </Accordion.Header>
              <Accordion.Body>
                <Form
                  onSubmit={applyCommissionFilters}
                  className="ca-wallet-filters__form"
                >
                  <Form.Group controlId="wallet-commission-filter-code">
                    <Form.Label>Código de operación</Form.Label>
                    <Form.Control
                      value={draftCommissionFilters.transactionCode}
                      onChange={(e) =>
                        setDraftCommissionFilters((prev) => ({
                          ...prev,
                          transactionCode: e.target.value,
                        }))
                      }
                      placeholder="Ej. ABC123"
                    />
                  </Form.Group>
                  <Form.Group controlId="wallet-commission-filter-type">
                    <Form.Label>Tipo</Form.Label>
                    <Form.Select
                      value={draftCommissionFilters.type}
                      onChange={(e) =>
                        setDraftCommissionFilters((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                    >
                      <option value="">Todos</option>
                      {COMMISSION_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group controlId="wallet-commission-filter-from">
                    <Form.Label>Desde</Form.Label>
                    <Form.Control
                      type="date"
                      value={draftCommissionFilters.from}
                      onChange={(e) =>
                        setDraftCommissionFilters((prev) => ({
                          ...prev,
                          from: e.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                  <Form.Group controlId="wallet-commission-filter-to">
                    <Form.Label>Hasta</Form.Label>
                    <Form.Control
                      type="date"
                      value={draftCommissionFilters.to}
                      onChange={(e) =>
                        setDraftCommissionFilters((prev) => ({
                          ...prev,
                          to: e.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                  <div className="ca-wallet-filters__actions">
                    <Button type="submit" size="sm" className="ca-btn-cta">
                      Aplicar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline-secondary"
                      onClick={clearCommissionFilters}
                      disabled={activeCommissionFilterCount === 0}
                    >
                      Limpiar
                    </Button>
                  </div>
                </Form>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>

          {(commissionsRes?.items.length ?? 0) === 0 ? (
            <p className="ca-wallet__hint">
              {activeCommissionFilterCount > 0
                ? 'No hay comisiones con esos filtros.'
                : 'Sin comisiones registradas.'}
            </p>
          ) : (
            <>
              <Table responsive size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Operación</th>
                    <th>Monto</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionsRes?.items.map((c) => (
                    <tr key={c.id}>
                      <td>{c.label}</td>
                      <td>
                        {c.transactionCode ? (
                          <Link
                            to={`/operaciones/${c.transactionCode}`}
                            className="ca-wallet-movements__code"
                          >
                            {c.transactionCode}
                          </Link>
                        ) : (
                          <span className="ca-wallet__hint">—</span>
                        )}
                      </td>
                      <td>{formatMoney(c.amountCents, c.currency)}</td>
                      <td>{formatDateTime(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {(commissionsRes?.totalPages ?? 0) > 1 ? (
                <nav
                  className="ca-wallet-movements__pager"
                  aria-label="Paginación de comisiones"
                >
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    disabled={(commissionsRes?.page ?? 1) <= 1 || commissionsFetching}
                    onClick={() => setCommissionsPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} aria-hidden />
                    Anterior
                  </Button>
                  <span className="ca-wallet-movements__pager-status">
                    Página {commissionsRes?.page ?? 1} de{' '}
                    {commissionsRes?.totalPages ?? 1}
                    <span className="ca-wallet__hint">
                      {' '}
                      · {commissionsRes?.total ?? 0} registros
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    disabled={
                      (commissionsRes?.page ?? 1) >=
                        (commissionsRes?.totalPages ?? 1) || commissionsFetching
                    }
                    onClick={() => setCommissionsPage((p) => p + 1)}
                  >
                    Siguiente
                    <ChevronRight size={16} aria-hidden />
                  </Button>
                </nav>
              ) : null}
            </>
          )}
        </section>
      </div>

      <section className="ca-wallet-panel">
        <div className="ca-wallet__row">
          <h3 className="mb-0">Movimientos / Historial</h3>
          <span className="ca-wallet__hint">
            {movementsRes?.total ?? 0} registros
            {summary?.lastMovementAt
              ? ` · último ${formatDateTime(summary.lastMovementAt)}`
              : ''}
          </span>
        </div>

        <Accordion className="ca-wallet-filters mb-3">
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              <span className="ca-wallet-filters__header">
                <Filter size={15} strokeWidth={1.75} aria-hidden />
                Filtros
                {activeFilterCount > 0 ? (
                  <Badge bg="secondary" pill className="ca-wallet-filters__count">
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </span>
            </Accordion.Header>
            <Accordion.Body>
              <Form onSubmit={applyFilters} className="ca-wallet-filters__form">
                <Form.Group controlId="wallet-filter-code">
                  <Form.Label>Código de operación</Form.Label>
                  <Form.Control
                    value={draftFilters.transactionCode}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        transactionCode: e.target.value,
                      }))
                    }
                    placeholder="Ej. ABC123"
                  />
                </Form.Group>
                <Form.Group controlId="wallet-filter-type">
                  <Form.Label>Tipo</Form.Label>
                  <Form.Select
                    value={draftFilters.type}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, type: e.target.value }))
                    }
                  >
                    <option value="">Todos</option>
                    {MOVEMENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group controlId="wallet-filter-direction">
                  <Form.Label>Dirección</Form.Label>
                  <Form.Select
                    value={draftFilters.direction}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, direction: e.target.value }))
                    }
                  >
                    <option value="">Todas</option>
                    <option value="CREDIT">Ingreso</option>
                    <option value="DEBIT">Egreso</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group controlId="wallet-filter-from">
                  <Form.Label>Desde</Form.Label>
                  <Form.Control
                    type="date"
                    value={draftFilters.from}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, from: e.target.value }))
                    }
                  />
                </Form.Group>
                <Form.Group controlId="wallet-filter-to">
                  <Form.Label>Hasta</Form.Label>
                  <Form.Control
                    type="date"
                    value={draftFilters.to}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, to: e.target.value }))
                    }
                  />
                </Form.Group>
                <div className="ca-wallet-filters__actions">
                  <Button type="submit" size="sm" className="ca-btn-cta">
                    Aplicar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    onClick={clearFilters}
                    disabled={activeFilterCount === 0}
                  >
                    Limpiar
                  </Button>
                </div>
              </Form>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        {(movementsRes?.items.length ?? 0) === 0 ? (
          <p className="ca-wallet__hint">
            {activeFilterCount > 0
              ? 'No hay movimientos con esos filtros.'
              : 'Todavía no hay movimientos.'}
          </p>
        ) : (
          <>
            <Table responsive size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Operación</th>
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
                      {m.transactionCode ? (
                        <Link
                          to={`/operaciones/${m.transactionCode}`}
                          className="ca-wallet-movements__code"
                        >
                          {m.transactionCode}
                        </Link>
                      ) : (
                        <span className="ca-wallet__hint">—</span>
                      )}
                    </td>
                    <td>
                      <Badge bg={m.direction === 'CREDIT' ? 'success' : 'secondary'}>
                        {WALLET_MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
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

            {(movementsRes?.totalPages ?? 0) > 1 ? (
              <nav className="ca-wallet-movements__pager" aria-label="Paginación de movimientos">
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  disabled={(movementsRes?.page ?? 1) <= 1 || movementsFetching}
                  onClick={() => setMovementsPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} aria-hidden />
                  Anterior
                </Button>
                <span className="ca-wallet-movements__pager-status">
                  Página {movementsRes?.page ?? 1} de {movementsRes?.totalPages ?? 1}
                  <span className="ca-wallet__hint">
                    {' '}
                    · {movementsRes?.total ?? 0} registros
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  disabled={
                    (movementsRes?.page ?? 1) >= (movementsRes?.totalPages ?? 1) ||
                    movementsFetching
                  }
                  onClick={() => setMovementsPage((p) => p + 1)}
                >
                  Siguiente
                  <ChevronRight size={16} aria-hidden />
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
