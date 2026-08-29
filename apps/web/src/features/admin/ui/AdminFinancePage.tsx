import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Button, Form, OverlayTrigger, Popover, Spinner } from 'react-bootstrap';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, X } from 'lucide-react';
import { isWithinAgentPayoutWindow } from '@confiapp/shared';

import { apiClient, getApiErrorMessage } from '@/shared/api/client';
import { formatDateTime, formatOperationMoney } from '@/shared/lib/money';
import { useAppToast } from '@/shared/ui';
import '../styles/admin-finance.css';

type Liquidacion = {
  id: string;
  totalAmountCents: number;
  currency: string;
  numberOfPayouts: number;
  status: string;
  notes?: string;
  createdAt: string;
};

type PagoAgente = {
  id: string;
  batchId: string;
  agentId: string;
  amountCents: number;
  currency: string;
  status: string;
  transferReference?: string;
  createdAt: string;
};

const ESTADO_LIQUIDACION: Record<
  string,
  { label: string; tone: 'pending' | 'progress' | 'ok' | 'muted' | 'danger' }
> = {
  DRAFT: { label: 'Borrador', tone: 'muted' },
  PENDING_TRANSFER: { label: 'Pendiente de transferir', tone: 'pending' },
  PARTIALLY_PAID: { label: 'Parcialmente pagada', tone: 'progress' },
  PAID: { label: 'Completada', tone: 'ok' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

const ESTADO_PAGO: Record<
  string,
  { label: string; tone: 'pending' | 'progress' | 'ok' | 'muted' | 'danger' }
> = {
  PENDING: { label: 'Pendiente de pago', tone: 'pending' },
  PROCESSING: { label: 'En proceso', tone: 'progress' },
  PAID: { label: 'Pagada', tone: 'ok' },
  FAILED: { label: 'Fallida', tone: 'danger' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

function EstadoChip({ status, map }: { status: string; map: typeof ESTADO_LIQUIDACION }) {
  const info = map[status] ?? { label: status, tone: 'muted' as const };
  return (
    <span className={`ca-admin-fin-status ca-admin-fin-status--${info.tone}`}>
      {info.label}
    </span>
  );
}

/** Traduce mensajes técnicos del API a copy amigable para admins. */
function mensajeErrorFinanzas(error: unknown): string {
  const raw = getApiErrorMessage(error, 'No se pudo completar la operación.');
  if (/no hay comisiones available para liquidar/i.test(raw)) {
    return 'Todavía no hay comisiones listas para liquidar. Las comisiones quedan disponibles 21 días después de completar cada operación.';
  }
  return raw.replace(/\bAVAILABLE\b/gi, 'disponibles');
}

function HelpInfo({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const popover = (
    <Popover id={id} className="ca-admin-fin-help">
      <Popover.Header as="h3">{title}</Popover.Header>
      <Popover.Body>{children}</Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger trigger={['hover', 'focus', 'click']} placement="bottom" overlay={popover}>
      <button type="button" className="ca-admin-fin__info" aria-label={title}>
        <Info size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </OverlayTrigger>
  );
}

function PanelTitle({
  title,
  helpId,
  helpTitle,
  help,
}: {
  title: string;
  helpId: string;
  helpTitle: string;
  help: ReactNode;
}) {
  return (
    <div className="ca-admin-fin-panel__title-row">
      <h2 className="ca-admin-fin-panel__title">{title}</h2>
      <HelpInfo id={helpId} title={helpTitle}>
        {help}
      </HelpInfo>
    </div>
  );
}

/** Admin: liquidación manual de comisiones de agentes. */
export function AdminFinancePage() {
  const toast = useAppToast();
  const qc = useQueryClient();
  const enVentana = isWithinAgentPayoutWindow();

  const [notasLiquidacion, setNotasLiquidacion] = useState('');
  const [permitirFueraDeVentana, setPermitirFueraDeVentana] = useState(false);
  const [liquidacionSeleccionadaId, setLiquidacionSeleccionadaId] = useState<string | null>(null);
  const [referenciaTransferencia, setReferenciaTransferencia] = useState('');
  const [error, setError] = useState<string | null>(null);

  const liquidacionesQuery = useQuery({
    queryKey: ['finance', 'batches'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: Liquidacion[] }>('/finance/payout-batches');
      return data.items;
    },
  });

  const detalleQuery = useQuery({
    queryKey: ['finance', 'batch', liquidacionSeleccionadaId],
    enabled: Boolean(liquidacionSeleccionadaId),
    queryFn: async () => {
      const { data } = await apiClient.get<{
        batch: Liquidacion;
        payouts: PagoAgente[];
      }>(`/finance/payout-batches/${liquidacionSeleccionadaId}`);
      return data;
    },
  });

  const crearLiquidacion = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/finance/payout-batches', {
        notes: notasLiquidacion.trim() || undefined,
        allowOutsideWindow: permitirFueraDeVentana,
      });
      return data;
    },
    onSuccess: (data: { batch?: Liquidacion }) => {
      toast.success('Liquidación preparada. Revisá los pagos pendientes a cada agente.');
      void qc.invalidateQueries({ queryKey: ['finance', 'batches'] });
      setNotasLiquidacion('');
      setError(null);
      if (data.batch?.id) {
        setLiquidacionSeleccionadaId(data.batch.id);
        setReferenciaTransferencia('');
      }
    },
    onError: (err) => {
      setError(mensajeErrorFinanzas(err));
    },
  });

  const confirmarPago = useMutation({
    mutationFn: async (pagoId: string) => {
      const { data } = await apiClient.post(`/finance/payouts/${pagoId}/confirm`, {
        transferReference: referenciaTransferencia.trim(),
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Pago al agente registrado.');
      void qc.invalidateQueries({ queryKey: ['finance'] });
    },
    onError: (err) => {
      setError(mensajeErrorFinanzas(err));
    },
  });

  const liquidaciones = liquidacionesQuery.data ?? [];
  const detalle = detalleQuery.data;
  const pagosPendientes = useMemo(
    () =>
      (detalle?.payouts ?? []).filter(
        (p) => p.status !== 'PAID' && p.status !== 'CANCELLED',
      ).length,
    [detalle?.payouts],
  );

  return (
    <div className="ca-admin-fin">
      <header className="ca-admin-fin__header">
        <div className="ca-admin-fin__intro">
          <p className="ca-admin-fin__kicker">Administración</p>
          <div className="ca-admin-fin__title-row">
            <h1 className="ca-admin-fin__title">Pagos a agentes</h1>
            <HelpInfo id="admin-fin-page" title="Pagos a agentes">
              <p className="mb-0">
                Acá preparás la liquidación mensual de comisiones ya disponibles, transferís el
                dinero por fuera de ConfiApp y registrás cada comprobante para cerrar el pago.
              </p>
            </HelpInfo>
          </div>
        </div>
        <div className="ca-admin-fin__chips">
          {enVentana ? (
            <span className="ca-admin-fin__chip ca-admin-fin__chip--ok">
              Ventana activa · días 1 al 10
            </span>
          ) : (
            <span className="ca-admin-fin__chip ca-admin-fin__chip--warn">
              Fuera de ventana · días 1 al 10
            </span>
          )}
        </div>
      </header>

      <section className="ca-admin-fin__steps" aria-label="Cómo funciona">
        <article className="ca-admin-fin__step">
          <span className="ca-admin-fin__step-num">Paso 1</span>
          <h2 className="ca-admin-fin__step-title">Preparar liquidación</h2>
          <p className="ca-admin-fin__step-text">
            Se agrupan todas las comisiones disponibles (21 días cumplidos) en un cierre de pagos.
          </p>
        </article>
        <article className="ca-admin-fin__step">
          <span className="ca-admin-fin__step-num">Paso 2</span>
          <h2 className="ca-admin-fin__step-title">Transferir manualmente</h2>
          <p className="ca-admin-fin__step-text">
            Enviás el dinero a cada agente por banco o medio acordado, fuera de la plataforma.
          </p>
        </article>
        <article className="ca-admin-fin__step">
          <span className="ca-admin-fin__step-num">Paso 3</span>
          <h2 className="ca-admin-fin__step-title">Registrar comprobante</h2>
          <p className="ca-admin-fin__step-text">
            Cargás la referencia o ID de la transferencia para marcar el pago como realizado.
          </p>
        </article>
      </section>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <section className="ca-admin-fin-panel">
        <div className="ca-admin-fin-panel__head">
          <PanelTitle
            title="Nueva liquidación"
            helpId="admin-fin-new-batch"
            helpTitle="Nueva liquidación"
          >
            <p className="mb-0">
              Genera un cierre con todas las comisiones disponibles para pagar. Lo habitual es
              hacerlo entre el 1 y el 10 de cada mes.
            </p>
          </PanelTitle>
        </div>
        <Form
          className="ca-admin-fin-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            crearLiquidacion.mutate();
          }}
        >
          <Form.Group>
            <div className="ca-admin-fin-form__label-row">
              <Form.Label className="mb-0">Notas internas (opcional)</Form.Label>
              <HelpInfo id="admin-fin-notes" title="Notas internas">
                <p className="mb-0">
                  Solo visible para el equipo admin. Sirve para dejar contexto del cierre.
                </p>
              </HelpInfo>
            </div>
            <Form.Control
              as="textarea"
              rows={2}
              value={notasLiquidacion}
              onChange={(e) => setNotasLiquidacion(e.target.value)}
              placeholder={
                enVentana
                  ? 'Ej.: Liquidación agosto · transferencias Brou'
                  : 'Obligatorias si liquidás fuera del 1 al 10'
              }
            />
          </Form.Group>
          {!enVentana ? (
            <Form.Group>
              <Form.Check
                type="checkbox"
                id="permitir-fuera-ventana"
                label="Liquidar fuera del período 1–10 (requiere nota explicativa)"
                checked={permitirFueraDeVentana}
                onChange={(e) => setPermitirFueraDeVentana(e.target.checked)}
              />
            </Form.Group>
          ) : null}
          <div>
            <Button type="submit" className="ca-btn-cta" disabled={crearLiquidacion.isPending}>
              {crearLiquidacion.isPending ? 'Preparando…' : 'Preparar liquidación del mes'}
            </Button>
          </div>
        </Form>
      </section>

      <section className="ca-admin-fin-panel">
        <div className="ca-admin-fin-panel__head">
          <PanelTitle
            title="Historial de liquidaciones"
            helpId="admin-fin-history"
            helpTitle="Historial de liquidaciones"
          >
            <p className="mb-0">
              Cierres ya generados. Abrí uno para ver cuánto corresponde a cada agente.
            </p>
          </PanelTitle>
        </div>
        {liquidacionesQuery.isLoading ? (
          <div className="d-flex align-items-center gap-2 py-3">
            <Spinner animation="border" size="sm" />
            <span className="text-muted">Cargando liquidaciones…</span>
          </div>
        ) : liquidaciones.length === 0 ? (
          <p className="ca-admin-fin-empty">
            Todavía no hay liquidaciones. Cuando haya comisiones disponibles, podés preparar la
            primera desde el formulario de arriba.
          </p>
        ) : (
          <div className="ca-admin-fin-table-wrap">
            <table className="table table-hover ca-admin-fin-table mb-0">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Agentes</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>
                      <EstadoChip status={item.status} map={ESTADO_LIQUIDACION} />
                    </td>
                    <td>{item.numberOfPayouts}</td>
                    <td>{formatOperationMoney(item.totalAmountCents, item.currency)}</td>
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant={
                          liquidacionSeleccionadaId === item.id
                            ? 'primary'
                            : 'outline-secondary'
                        }
                        onClick={() => {
                          setLiquidacionSeleccionadaId(item.id);
                          setReferenciaTransferencia('');
                          setError(null);
                        }}
                      >
                        {liquidacionSeleccionadaId === item.id ? 'Abierta' : 'Ver detalle'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {liquidacionSeleccionadaId ? (
        <section className="ca-admin-fin-panel ca-admin-fin-detail">
          <div className="ca-admin-fin-panel__head">
            <PanelTitle
              title="Detalle de la liquidación"
              helpId="admin-fin-detail"
              helpTitle="Detalle de la liquidación"
            >
              <p className="mb-0">
                Confirmá cada pago cuando la transferencia al agente ya esté hecha.
              </p>
            </PanelTitle>
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              onClick={() => {
                setLiquidacionSeleccionadaId(null);
                setReferenciaTransferencia('');
              }}
              aria-label="Cerrar detalle"
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
              <span className="ms-1">Cerrar</span>
            </Button>
          </div>

          {detalleQuery.isLoading ? (
            <div className="d-flex align-items-center gap-2 py-3">
              <Spinner animation="border" size="sm" />
              <span className="text-muted">Cargando pagos…</span>
            </div>
          ) : detalle ? (
            <>
              <div className="ca-admin-fin-detail__summary">
                <div className="ca-admin-fin-detail__stat">
                  <span className="ca-admin-fin-detail__stat-label">Estado</span>
                  <span className="ca-admin-fin-detail__stat-value">
                    <EstadoChip status={detalle.batch.status} map={ESTADO_LIQUIDACION} />
                  </span>
                </div>
                <div className="ca-admin-fin-detail__stat">
                  <span className="ca-admin-fin-detail__stat-label">Total</span>
                  <span className="ca-admin-fin-detail__stat-value">
                    {formatOperationMoney(
                      detalle.batch.totalAmountCents,
                      detalle.batch.currency,
                    )}
                  </span>
                </div>
                <div className="ca-admin-fin-detail__stat">
                  <span className="ca-admin-fin-detail__stat-label">Agentes</span>
                  <span className="ca-admin-fin-detail__stat-value">
                    {detalle.batch.numberOfPayouts}
                  </span>
                </div>
                <div className="ca-admin-fin-detail__stat">
                  <span className="ca-admin-fin-detail__stat-label">Pendientes</span>
                  <span className="ca-admin-fin-detail__stat-value">{pagosPendientes}</span>
                </div>
              </div>

              {detalle.batch.notes ? (
                <p className="small text-muted mb-3">
                  <strong>Notas:</strong> {detalle.batch.notes}
                </p>
              ) : null}

              <Form.Group className="mb-3" style={{ maxWidth: 420 }}>
                <Form.Label>Referencia de la transferencia</Form.Label>
                <Form.Control
                  value={referenciaTransferencia}
                  onChange={(e) => setReferenciaTransferencia(e.target.value)}
                  placeholder="Nº de operación, comprobante o ID bancario"
                />
                <Form.Text className="text-muted">
                  La misma referencia se usará al confirmar cada pago pendiente de abajo.
                </Form.Text>
              </Form.Group>

              <div className="ca-admin-fin-payments">
                {detalle.payouts.map((pago) => {
                  const puedeConfirmar =
                    pago.status !== 'PAID' && pago.status !== 'CANCELLED';
                  return (
                    <article key={pago.id} className="ca-admin-fin-payment">
                      <div>
                        <p className="ca-admin-fin-payment__agent">Agente</p>
                        <span className="ca-admin-fin-payment__agent-id">
                          ID …{pago.agentId.slice(-8)}
                        </span>
                      </div>
                      <div>
                        <p className="ca-admin-fin-payment__amount mb-1">
                          {formatOperationMoney(pago.amountCents, pago.currency)}
                        </p>
                        <EstadoChip status={pago.status} map={ESTADO_PAGO} />
                      </div>
                      <div className="ca-admin-fin-payment__actions">
                        {puedeConfirmar ? (
                          <Button
                            size="sm"
                            className="ca-btn-cta"
                            disabled={
                              !referenciaTransferencia.trim() || confirmarPago.isPending
                            }
                            onClick={() => {
                              setError(null);
                              confirmarPago.mutate(pago.id);
                            }}
                          >
                            Marcar como pagado
                          </Button>
                        ) : (
                          <span className="ca-admin-fin-payment__ref">
                            {pago.transferReference
                              ? `Ref. ${pago.transferReference}`
                              : 'Sin referencia'}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <Alert variant="warning" className="mb-0">
              No se pudo cargar el detalle de esta liquidación.
            </Alert>
          )}
        </section>
      ) : null}
    </div>
  );
}
