import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { BellRing, Check, X } from 'lucide-react';

import { useAcceptOffer, useAgentOffers, useRejectOffer } from '../hooks/useAgentOps';
import { useAgentRealtime } from '../hooks/useAgentRealtime';
import { OFFER_STATUS_LABELS, type OfferActionStatus } from '../model/types';
import '../styles/agent-ops.css';

export function AgentOffersPage() {
  useAgentRealtime();
  const { data, isLoading, isError } = useAgentOffers();
  const accept = useAcceptOffer();
  const reject = useRejectOffer();

  if (isLoading) {
    return (
      <div className="ca-agent-ops d-flex align-items-center gap-2">
        <Spinner animation="border" />
        Cargando ofertas…
      </div>
    );
  }

  if (isError || !data) {
    return <Alert variant="danger">No se pudieron cargar las ofertas.</Alert>;
  }

  const items = data.items;

  return (
    <div className="ca-agent-ops">
      <header className="ca-agent-ops__header">
        <div>
          <p className="ca-agent-ops__kicker">Agente</p>
          <h2 className="ca-agent-ops__title">Ofertas en tiempo real</h2>
          <p className="ca-agent-ops__lead">
            Push + WebSocket. Aceptá, rechazá o esperá la expiración/reasignación automática.
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Badge bg="light" text="dark">
            {data.source === 'demo' ? 'Modo demo' : 'API · live'}
          </Badge>
          <Link to="/agente/buscar" className="btn btn-outline-secondary">
            Buscar agentes
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="ca-agent-ops-panel text-center">
          <BellRing size={32} className="mb-2" />
          <p className="mb-0">No hay ofertas todavía.</p>
        </div>
      ) : (
        <ul className="ca-agent-ops-list">
          {items.map((offer, index) => {
            const status = (offer.actionStatus ?? 'PENDING') as OfferActionStatus;
            const pending = status === 'PENDING' && !offer.isExpired;
            return (
              <motion.li
                key={offer.id}
                className="ca-agent-ops-list__item"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <div className="ca-agent-ops-list__row">
                  <strong>{offer.title}</strong>
                  <Badge bg={pending ? 'warning' : status === 'ACCEPTED' ? 'success' : 'secondary'}>
                    {OFFER_STATUS_LABELS[status]}
                  </Badge>
                </div>
                <p className="mb-1">{offer.body}</p>
                <div className="ca-agent-ops-list__meta">
                  {offer.data?.transactionCode
                    ? `Operación ${String(offer.data.transactionCode)} · `
                    : null}
                  {offer.expiresAt
                    ? `Expira ${new Date(offer.expiresAt).toLocaleString('es-AR')}`
                    : 'Sin expiración'}
                </div>
                {pending ? (
                  <div className="ca-form-actions mt-2">
                    <Button
                      className="ca-btn-cta"
                      disabled={accept.isPending}
                      onClick={() => void accept.mutateAsync(offer.id)}
                    >
                      <Check size={16} className="me-1" />
                      Aceptar
                    </Button>
                    <Button
                      variant="outline-danger"
                      disabled={reject.isPending}
                      onClick={() => void reject.mutateAsync(offer.id)}
                    >
                      <X size={16} className="me-1" />
                      Rechazar
                    </Button>
                  </div>
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
