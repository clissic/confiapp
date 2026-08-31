import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, OverlayTrigger, Popover, Spinner } from 'react-bootstrap';
import { Download, Info, X } from 'lucide-react';

import { AuditPager } from '@/features/audit/ui/AuditPager';
import { formatDateTime, formatOperationMoney } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';
import { STATUS_LABELS, type TransactionStatus } from '@/features/transactions/model/types';
import {
  useManualPrexTransfer,
  useManualPrexTransfers,
  useSetManualPrexAdminConfirmation,
} from '@/features/payments/hooks/usePayments';

import '../styles/admin-payments.css';

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  REQUIRES_ACTION: 'Pendiente confirmación',
  AUTHORIZED: 'Autorizado',
  CAPTURED: 'En resguardo',
  RELEASED: 'Liberado',
  REFUNDED: 'Reembolsado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
};

function statusLabel(key: string): string {
  return PAYMENT_STATUS_LABELS[key] ?? key;
}

function HelpInfo({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const popover = (
    <Popover id={id} className="ca-admin-pay-help">
      <Popover.Header as="h3">{title}</Popover.Header>
      <Popover.Body>{children}</Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger trigger={['hover', 'focus', 'click']} placement="bottom" overlay={popover}>
      <button type="button" className="ca-admin-pay__info" aria-label={title}>
        <Info size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </OverlayTrigger>
  );
}

/** Admin: transferencias Prex entrantes (comprobantes). */
export function AdminPaymentsPage() {
  const toast = useAppToast();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const transfersQuery = useManualPrexTransfers(page);
  const detailQuery = useManualPrexTransfer(selectedId);
  const confirmMutation = useSetManualPrexAdminConfirmation();

  const transfers = transfersQuery.data?.items ?? [];
  const total = transfersQuery.data?.total ?? 0;
  const totalPages = transfersQuery.data?.totalPages ?? 0;
  const currentPage = transfersQuery.data?.page ?? page;
  const prexAccount = transfersQuery.data?.prexAccount;
  const checkoutMode = transfersQuery.data?.checkoutMode ?? 'manual_prex';
  const detail = detailQuery.data?.data;

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    setSelectedId(null);
  };

  const receiptPreview = detail?.payment.receiptDataUrl;
  const isImageReceipt = receiptPreview?.startsWith('data:image/');
  const isPdfReceipt = receiptPreview?.startsWith('data:application/pdf');
  const adminConfirmed = detail?.payment.adminConfirmed ?? false;

  const handleConfirmationToggle = (confirmed: boolean) => {
    if (!selectedId) return;
    confirmMutation.mutate(
      { paymentId: selectedId, confirmed },
      {
        onSuccess: () => {
          toast.success(
            confirmed
              ? 'Transferencia confirmada. La operación quedó en pago protegido y ya está visible para agentes.'
              : 'Transferencia marcada como no confirmada. Los agentes no la verán hasta que la vuelvas a confirmar.',
          );
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : 'No se pudo actualizar la confirmación.',
          );
        },
      },
    );
  };

  return (
    <div className="ca-admin-pay">
      <header className="ca-admin-pay__header">
        <div className="ca-admin-pay__title-row">
          <div>
            <p className="ca-admin-pay__kicker">Administración</p>
            <h1 className="ca-admin-pay__title">Pagos entrantes</h1>
          </div>
          <HelpInfo id="admin-pay-help" title="Sobre esta pantalla">
            <p className="mb-2">
              Acá ves las transferencias Prex que los compradores declararon con comprobante. Revisá
              el archivo, el monto y el estado del resguardo.
            </p>
            <p className="mb-2">
              Mientras el cobro sea manual, Mercado Pago queda en standby. Cada comprobante nuevo
              también dispara un email a la casilla de la plataforma.
            </p>
            <p className="mb-0">
              El historial de eventos de pago está en{' '}
              <Link to="/auditoria/pagos">Auditoría → Pagos y wallet</Link>.
            </p>
          </HelpInfo>
        </div>

        <p className="ca-admin-pay__meta">
          <span>
            {checkoutMode === 'manual_prex' ? 'Modo Prex manual' : 'Modo Mercado Pago'}
          </span>
          {prexAccount ? (
            <>
              <span className="ca-admin-pay__dot" aria-hidden>
                ·
              </span>
              <span>
                {prexAccount.accountName} · {prexAccount.accountNumber}
              </span>
            </>
          ) : null}
        </p>
      </header>

      {transfersQuery.isError ? (
        <Alert variant="danger" className="mb-0">
          No se pudieron cargar las transferencias.
        </Alert>
      ) : null}

      <div className={`ca-admin-pay__body${selectedId ? ' has-detail' : ''}`}>
        <section className="ca-admin-pay__list-wrap" aria-label="Transferencias Prex">
          <div className="ca-admin-pay__list-head">
            <h2 className="ca-admin-pay__section-title">
              Transferencias
              {total > 0 ? <span className="ca-admin-pay__count">{total}</span> : null}
            </h2>
            {transfersQuery.isFetching ? <Spinner size="sm" animation="border" /> : null}
          </div>

          {transfersQuery.isLoading ? (
            <div className="ca-admin-pay__quiet">
              <Spinner size="sm" animation="border" />
              <span>Cargando…</span>
            </div>
          ) : transfers.length === 0 ? (
            <p className="ca-admin-pay__quiet">
              Todavía no hay transferencias. Cuando un comprador suba un comprobante, aparece acá.
            </p>
          ) : (
            <ul className="ca-admin-pay__list">
              {transfers.map((item) => {
                const active = selectedId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`ca-admin-pay__row${active ? ' is-active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="ca-admin-pay__row-top">
                        <strong>{item.transactionCode ?? '—'}</strong>
                        <span className="ca-admin-pay__amount">
                          {formatOperationMoney(item.amountCents, item.currency)}
                        </span>
                      </div>
                      <p className="ca-admin-pay__row-title">
                        {item.transactionTitle ?? 'Operación'}
                      </p>
                      <div className="ca-admin-pay__row-foot">
                        <span className="ca-admin-pay__status">{statusLabel(item.status)}</span>
                        {!item.adminConfirmed && item.hasReceipt ? (
                          <span className="ca-admin-pay__pending">Pendiente admin</span>
                        ) : null}
                        <span>{formatDateTime(item.capturedAt ?? item.createdAt)}</span>
                        <span className="ca-admin-pay__buyer">
                          {item.buyer.fullName ?? 'Comprador'}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <AuditPager
            total={total}
            totalPages={totalPages}
            currentPage={currentPage}
            isFetching={transfersQuery.isFetching}
            onPageChange={handlePageChange}
            itemLabel={{ one: 'transferencia', other: 'transferencias' }}
          />

          <p className="ca-admin-pay__audit-link">
            <Link to="/auditoria/pagos">Ver eventos en Auditoría</Link>
          </p>
        </section>

        {selectedId ? (
          <aside className="ca-admin-pay__detail" aria-label="Detalle de transferencia">
            {detailQuery.isLoading ? (
              <div className="ca-admin-pay__quiet">
                <Spinner animation="border" size="sm" />
                <span>Cargando detalle…</span>
              </div>
            ) : detail ? (
              <>
                <div className="ca-admin-pay__detail-head">
                  <div>
                    <h2 className="ca-admin-pay__detail-code">
                      {detail.transaction?.code ?? 'Transferencia'}
                    </h2>
                    <p className="ca-admin-pay__detail-title">{detail.transaction?.title}</p>
                  </div>
                  <button
                    type="button"
                    className="ca-admin-pay__close"
                    aria-label="Cerrar detalle"
                    onClick={() => setSelectedId(null)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <dl className="ca-admin-pay__facts">
                  <div>
                    <dt>Monto</dt>
                    <dd>
                      {formatOperationMoney(
                        detail.payment.amountCents,
                        detail.payment.currency,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Pago</dt>
                    <dd>{statusLabel(detail.payment.status)}</dd>
                  </div>
                  <div>
                    <dt>Operación</dt>
                    <dd>
                      {detail.transaction?.status
                        ? STATUS_LABELS[detail.transaction.status as TransactionStatus] ??
                          detail.transaction.status
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Comprador</dt>
                    <dd>
                      {detail.buyer.fullName ?? '—'}
                      {detail.buyer.email ? (
                        <span className="ca-admin-pay__sub">{detail.buyer.email}</span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Cuenta Prex</dt>
                    <dd>
                      {detail.payment.prexAccount?.accountName ?? prexAccount?.accountName} ·{' '}
                      {detail.payment.prexAccount?.accountNumber ?? prexAccount?.accountNumber}
                    </dd>
                  </div>
                  <div>
                    <dt>Referencia</dt>
                    <dd className="ca-admin-pay__mono">{detail.payment.externalId ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Comprobante</dt>
                    <dd>
                      {detail.payment.receiptFileName ?? 'Archivo adjunto'}
                      {detail.payment.receiptUploadedAt ? (
                        <span className="ca-admin-pay__sub">
                          {formatDateTime(detail.payment.receiptUploadedAt)}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                {receiptPreview ? (
                  <div className="ca-admin-pay__receipt">
                    {isImageReceipt ? (
                      <img src={receiptPreview} alt="Comprobante de transferencia" />
                    ) : isPdfReceipt ? (
                      <object
                        data={receiptPreview}
                        type="application/pdf"
                        aria-label="Comprobante PDF"
                      >
                        <p className="ca-admin-pay__quiet mb-0">
                          No se pudo previsualizar el PDF en el navegador.
                        </p>
                      </object>
                    ) : (
                      <p className="ca-admin-pay__quiet mb-0">
                        Formato de comprobante no soportado.
                      </p>
                    )}
                  </div>
                ) : (
                  <Alert variant="warning" className="mb-0">
                    No hay comprobante guardado para este pago.
                  </Alert>
                )}

                {receiptPreview ? (
                  <div className="ca-admin-pay__confirm">
                    <div className="ca-admin-pay__confirm-row">
                      <span
                        className={`ca-admin-pay__confirm-label ca-admin-pay__confirm-label--off${
                          !adminConfirmed ? ' is-active' : ''
                        }`}
                      >
                        No confirmada
                      </span>
                      <OverlayTrigger
                        trigger={['hover', 'focus']}
                        placement="top"
                        delay={{ show: 180, hide: 80 }}
                        overlay={
                          <Popover id="admin-prex-confirm-help" className="ca-admin-pay-help">
                            <Popover.Header as="h3">Confirmación admin</Popover.Header>
                            <Popover.Body>
                              Revisá el comprobante y activá la confirmación para liberar el
                              trabajo a los agentes. Mientras esté en{' '}
                              <strong>No confirmada</strong>, no aparece en el tablero de trabajos
                              abiertos.
                            </Popover.Body>
                          </Popover>
                        }
                      >
                        <button
                          type="button"
                          role="switch"
                          aria-checked={adminConfirmed}
                          aria-label={
                            adminConfirmed
                              ? 'Transferencia confirmada'
                              : 'Transferencia no confirmada'
                          }
                          className={`ca-admin-pay__confirm-toggle${
                            adminConfirmed ? ' is-on' : ' is-off'
                          }`}
                          disabled={confirmMutation.isPending}
                          onClick={() => handleConfirmationToggle(!adminConfirmed)}
                        >
                          <span className="ca-admin-pay__confirm-knob" aria-hidden />
                        </button>
                      </OverlayTrigger>
                      <span
                        className={`ca-admin-pay__confirm-label ca-admin-pay__confirm-label--on${
                          adminConfirmed ? ' is-active' : ''
                        }`}
                      >
                        Confirmada
                      </span>
                      {confirmMutation.isPending ? (
                        <Spinner size="sm" animation="border" className="ms-1" aria-hidden />
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {receiptPreview && isImageReceipt ? (
                  <div className="ca-admin-pay__actions">
                    <a
                      className="btn btn-sm btn-outline-secondary"
                      href={receiptPreview}
                      download={detail.payment.receiptFileName ?? 'comprobante.jpg'}
                    >
                      <Download size={14} className="me-1" aria-hidden />
                      Descargar
                    </a>
                  </div>
                ) : null}
              </>
            ) : (
              <Alert variant="danger" className="mb-0">
                No se encontró el detalle de la transferencia.
              </Alert>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
