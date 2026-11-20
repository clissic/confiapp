import { Badge } from 'react-bootstrap';
import { Phone, Star, UserRound } from 'lucide-react';

import { ResolvedMediaImage } from '@/shared/media/ResolvedMediaImage';
import type { OperationAgent } from '../model/types';

function formatRating(average: number, count: number): string {
  if (!count) return 'Sin reseñas todavía';
  const avg = Number.isFinite(average) ? average : 0;
  return `${avg.toFixed(1)} · ${count} ${count === 1 ? 'reseña' : 'reseñas'}`;
}

/** Datos del Agente asignado — visible a comprador y vendedor. */
export function OperationAgentSection({ agent }: { agent: OperationAgent }) {
  const phone = agent.phone?.trim();
  const hasPhoto = Boolean(agent.avatarUrl?.trim());

  return (
    <section className="ca-tx-operation-agent" aria-labelledby="ca-tx-operation-agent-title">
      <p className="ca-tx-operation-agent__kicker">Intermediación</p>
      <h2 id="ca-tx-operation-agent-title" className="ca-tx-operation-agent__title">
        Agente de la operación
      </h2>

      <div className="ca-tx-operation-agent__card">
        <div className="ca-tx-operation-agent__avatar" aria-hidden={!hasPhoto}>
          {hasPhoto && agent.avatarUrl ? (
            <ResolvedMediaImage
              src={agent.avatarUrl}
              alt=""
              className="ca-tx-operation-agent__avatar-img"
            />
          ) : (
            <span className="ca-tx-operation-agent__avatar-fallback">
              <UserRound size={28} strokeWidth={1.5} />
            </span>
          )}
        </div>

        <div className="ca-tx-operation-agent__body">
          <div className="ca-tx-operation-agent__names">
            <div>
              <span className="ca-tx-operation-agent__label">Nombre</span>
              <strong>{agent.firstName || '—'}</strong>
            </div>
            <div>
              <span className="ca-tx-operation-agent__label">Apellido</span>
              <strong>{agent.lastName || '—'}</strong>
            </div>
          </div>

          <div className="ca-tx-operation-agent__meta">
            <Badge bg="light" text="dark" className="ca-tx-operation-agent__chip">
              <Star size={13} strokeWidth={1.75} aria-hidden />
              {formatRating(agent.ratingAverage, agent.ratingCount)}
            </Badge>
            {phone ? (
              <a href={`tel:${phone.replace(/\s+/g, '')}`} className="ca-tx-operation-agent__phone">
                <Phone size={14} strokeWidth={1.75} aria-hidden />
                {phone}
              </a>
            ) : (
              <span className="ca-tx-operation-agent__phone ca-tx-operation-agent__phone--empty">
                <Phone size={14} strokeWidth={1.75} aria-hidden />
                Teléfono no cargado
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
