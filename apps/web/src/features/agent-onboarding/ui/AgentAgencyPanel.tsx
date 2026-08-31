import { Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Handshake,
  PackageCheck,
  PauseCircle,
  Pencil,
  Percent,
  PlayCircle,
  Star,
  XCircle,
} from 'lucide-react';

import { formatDistance } from '@/shared/lib/distance';
import { useUserPreferences } from '@/shared/preferences';
import { STATUS_LABELS } from '@/features/transactions/model/types';

import { DAY_LABELS } from '../model/schemas';
import type { AgentAgencyStats, AgentOnboarding } from '../model/types';

const EMPTY_STATS: AgentAgencyStats = {
  completedDeliveries: 0,
  successRate: 0,
  ratingAverage: 0,
  ratingCount: 0,
  ratingDistribution: { one: 0, two: 0, three: 0, four: 0, five: 0 },
};

function formatRating(average: number, count: number) {
  if (count <= 0) return 'Sin reseñas';
  return `${average.toFixed(1)} · ${count} ${count === 1 ? 'reseña' : 'reseñas'}`;
}

export function AgentAgencyPanel({
  onboarding,
  busy,
  onEditSchedule,
  onEditArea,
  onSuspend,
  onResume,
  onClose,
}: {
  onboarding: AgentOnboarding;
  busy: boolean;
  onEditSchedule: () => void;
  onEditArea: () => void;
  onSuspend: () => void;
  onResume: () => void;
  onClose: () => void;
}) {
  const { distanceUnit } = useUserPreferences();
  const isInactive = onboarding.status === 'INACTIVE';
  const activeJobsCount = onboarding.activeJobsCount ?? 0;
  const activeJobs = onboarding.activeJobs ?? [];
  const canClose = activeJobsCount === 0;
  const stats = onboarding.stats ?? EMPTY_STATS;

  const slotsLabel = onboarding.unspecifiedSchedule
    ? 'Disponible 24 h'
    : onboarding.weeklySlots
        .map(
          (slot) =>
            `${DAY_LABELS[slot.dayOfWeek] ?? slot.dayOfWeek} ${slot.startTime}–${slot.endTime}`,
        )
        .join(' · ');

  const distributionBars = [
    { label: '5', value: stats.ratingDistribution.five },
    { label: '4', value: stats.ratingDistribution.four },
    { label: '3', value: stats.ratingDistribution.three },
    { label: '2', value: stats.ratingDistribution.two },
    { label: '1', value: stats.ratingDistribution.one },
  ];
  const maxBar = Math.max(1, ...distributionBars.map((bar) => bar.value));

  return (
    <section className="ca-agency-summary">
      <header className="ca-agency-summary__intro">
        <h3 className="ca-agency-summary__title">Resumen de tu agencia</h3>
        <p className="ca-agency-summary__lead">
          {isInactive
            ? 'Tu agencia está en pausa: no recibís trabajos nuevos. Seguís a cargo de las operaciones en curso.'
            : 'Rendimiento, calificaciones y configuración de tu rol como Agente.'}
        </p>
      </header>

      {isInactive ? (
        <Alert variant="warning" className="ca-agency-alert mb-0">
          Agencia en pausa — no aceptás asignaciones nuevas.
        </Alert>
      ) : null}

      <div className="ca-agency-summary__identity">
        <p className="ca-agency-summary__name">{onboarding.preview.fullName}</p>
        <p className="ca-agency-summary__email">{onboarding.preview.email}</p>
      </div>

      <div className="ca-agency-stats" aria-label="Estadísticas de intermediario">
        <div className="ca-agency-stat">
          <span className="ca-agency-stat__icon" aria-hidden>
            <PackageCheck size={18} strokeWidth={1.75} />
          </span>
          <span className="ca-agency-stat__label">Entregas</span>
          <strong className="ca-agency-stat__value">{stats.completedDeliveries}</strong>
          <span className="ca-agency-stat__hint">Completadas como agente</span>
        </div>
        <div className="ca-agency-stat">
          <span className="ca-agency-stat__icon" aria-hidden>
            <Star size={18} strokeWidth={1.75} />
          </span>
          <span className="ca-agency-stat__label">Calificación</span>
          <strong className="ca-agency-stat__value">
            {stats.ratingCount > 0 ? stats.ratingAverage.toFixed(1) : '—'}
          </strong>
          <span className="ca-agency-stat__hint">
            {formatRating(stats.ratingAverage, stats.ratingCount)}
          </span>
        </div>
        <div className="ca-agency-stat">
          <span className="ca-agency-stat__icon" aria-hidden>
            <Handshake size={18} strokeWidth={1.75} />
          </span>
          <span className="ca-agency-stat__label">En curso</span>
          <strong className="ca-agency-stat__value">{activeJobsCount}</strong>
          <span className="ca-agency-stat__hint">Operaciones a tu cargo</span>
        </div>
        <div className="ca-agency-stat">
          <span className="ca-agency-stat__icon" aria-hidden>
            <Percent size={18} strokeWidth={1.75} />
          </span>
          <span className="ca-agency-stat__label">Éxito</span>
          <strong className="ca-agency-stat__value">{Math.round(stats.successRate)}%</strong>
          <span className="ca-agency-stat__hint">Tasa de operaciones exitosas</span>
        </div>
      </div>

      <div className="ca-agency-ratings">
        <div className="ca-agency-ratings__head">
          <p className="ca-agency-ratings__title mb-0">Calificaciones como intermediario</p>
          <Link to="/perfil?tab=ratings" className="ca-agency-ratings__link">
            Ver detalle
          </Link>
        </div>
        {stats.ratingCount === 0 ? (
          <p className="ca-agency-ratings__empty mb-0">
            Todavía no tenés reseñas como agente. Se acumulan al completar entregas.
          </p>
        ) : (
          <div className="ca-agency-ratings__bars">
            {distributionBars.map((bar) => (
              <div key={bar.label} className="ca-agency-ratings__row">
                <span>{bar.label}★</span>
                <div className="ca-agency-ratings__track">
                  <div
                    className="ca-agency-ratings__fill"
                    style={{ width: `${(bar.value / maxBar) * 100}%` }}
                  />
                </div>
                <span>{bar.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <dl className="ca-agency-config">
        <div className="ca-agency-config__item">
          <dt>Términos</dt>
          <dd>
            {onboarding.termsAccepted
              ? `Aceptados (v${onboarding.termsVersion})`
              : 'Pendientes'}
          </dd>
        </div>
        <div className="ca-agency-config__item">
          <div className="ca-agency-config__title">
            <dt>Horarios</dt>
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              className="ca-agency-edit-btn"
              aria-label="Modificar horarios"
              disabled={busy}
              onClick={onEditSchedule}
            >
              <Pencil size={15} strokeWidth={1.75} aria-hidden />
              <span className="ca-agency-edit-btn__label">Editar</span>
            </Button>
          </div>
          <dd>{slotsLabel || 'Sin franjas'}</dd>
          <dd className="ca-agency-config__meta">{onboarding.timezone}</dd>
        </div>
        <div className="ca-agency-config__item">
          <div className="ca-agency-config__title">
            <dt>Área</dt>
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              className="ca-agency-edit-btn"
              aria-label="Modificar área"
              disabled={busy}
              onClick={onEditArea}
            >
              <Pencil size={15} strokeWidth={1.75} aria-hidden />
              <span className="ca-agency-edit-btn__label">Editar</span>
            </Button>
          </div>
          <dd>
            {[onboarding.workAreaLabel, onboarding.workAreaCity, onboarding.workAreaCountry]
              .filter(Boolean)
              .join(' · ') || '—'}
          </dd>
          <dd className="ca-agency-config__meta">
            Radio:{' '}
            {onboarding.coverageRadiusKm != null
              ? formatDistance(onboarding.coverageRadiusKm, distanceUnit, 0)
              : '—'}
          </dd>
        </div>
        <div className="ca-agency-config__item">
          <dt>Tarifa</dt>
          <dd>
            {onboarding.ratesAccepted
              ? 'Esquema de plataforma aceptado (80% agente / 20% ConfiApp)'
              : 'Pendiente'}
          </dd>
        </div>
      </dl>

      <div className="ca-agency-active-jobs">
        <div className="ca-agency-active-jobs__head">
          <span className="ca-agency-active-jobs__icon" aria-hidden>
            <Handshake size={18} strokeWidth={1.75} />
          </span>
          <div className="ca-agency-active-jobs__intro">
            <p className="ca-agency-active-jobs__title">
              {activeJobsCount === 0
                ? 'Sin operaciones a tu cargo'
                : activeJobsCount === 1
                  ? '1 operación a tu cargo'
                  : `${activeJobsCount} operaciones a tu cargo`}
            </p>
            <p className="ca-agency-active-jobs__hint mb-0">
              {activeJobsCount > 0
                ? 'Para cerrar la agencia, terminá el trabajo o pedí la salida desde cada operación.'
                : 'Cuando no quede ninguna, podés cerrar la agencia.'}
            </p>
          </div>
          {activeJobsCount > 0 ? (
            <span className="ca-agency-active-jobs__chip">{activeJobsCount}</span>
          ) : null}
        </div>

        {activeJobs.length > 0 ? (
          <ul className="ca-agency-active-jobs__list">
            {activeJobs.map((job) => (
              <li key={job.id}>
                <Link to={`/operaciones/${job.code}`} className="ca-agency-job-chip">
                  <span className="ca-agency-job-chip__code">{job.code}</span>
                  <span className="ca-agency-job-chip__title">{job.title}</span>
                  <span className="ca-agency-job-chip__status">
                    {STATUS_LABELS[job.status] ?? job.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Link to="/agente/trabajos" className="ca-agency-jobs__link">
        <BriefcaseBusiness size={18} strokeWidth={1.75} aria-hidden />
        <span>
          <strong>Trabajos abiertos</strong>
          <span className="ca-agency-jobs__hint">Operaciones disponibles para mediar</span>
        </span>
      </Link>

      <div className="ca-agency-footer">
        {isInactive ? (
          <Button type="button" className="ca-btn-primary" disabled={busy} onClick={onResume}>
            <PlayCircle size={18} strokeWidth={1.75} aria-hidden />
            Reactivar actividad
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline-secondary"
            disabled={busy}
            onClick={onSuspend}
            title="No vas a recibir trabajos nuevos; seguís a cargo de las operaciones en curso"
          >
            <PauseCircle size={18} strokeWidth={1.75} aria-hidden />
            Suspender actividad
          </Button>
        )}
        <Button
          type="button"
          variant="outline-danger"
          disabled={busy || !canClose}
          onClick={onClose}
          title={
            canClose
              ? 'Cerrar agencia y quitar el rol de agente'
              : 'Tenés operaciones activas: no podés cerrar todavía'
          }
        >
          <XCircle size={18} strokeWidth={1.75} aria-hidden />
          Cerrar agencia
        </Button>
      </div>
      {!isInactive ? (
        <p className="ca-agency-footer-hint">
          Al suspender no recibís trabajos nuevos; seguís a cargo de las operaciones en curso.
        </p>
      ) : null}
    </section>
  );
}
