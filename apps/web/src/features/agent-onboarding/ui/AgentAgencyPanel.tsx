import { Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Handshake,
  PauseCircle,
  Pencil,
  PlayCircle,
  XCircle,
} from 'lucide-react';

import { formatDistance } from '@/shared/lib/distance';
import { useUserPreferences } from '@/shared/preferences';
import { STATUS_LABELS } from '@/features/transactions/model/types';

import { DAY_LABELS } from '../model/schemas';
import type { AgentOnboarding } from '../model/types';

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

  const slotsLabel = onboarding.unspecifiedSchedule
    ? 'Disponible 24 h'
    : onboarding.weeklySlots
        .map(
          (slot) =>
            `${DAY_LABELS[slot.dayOfWeek] ?? slot.dayOfWeek} ${slot.startTime}–${slot.endTime}`,
        )
        .join(' · ');

  return (
    <section>
      <h3 className="ca-section-title">Resumen de tu agencia</h3>
      <p className="ca-section-lead">
        {isInactive
          ? 'Tu agencia está en pausa: no recibís trabajos nuevos. Seguís a cargo de las operaciones en curso.'
          : 'Configuración actual de tu rol como Agente. Podés editar horarios y área.'}
      </p>

      <div className="ca-agent-form-shell ca-onboarding-media">
        <div className="ca-agency-visual">
          <div className="ca-onboarding-media__visual" aria-hidden="true">
            <img
              src="/landing/Folder.png"
              alt=""
              width={512}
              height={512}
              decoding="async"
            />
          </div>
          {isInactive ? (
            <Alert variant="warning" className="ca-agency-alert">
              Agencia en pausa — no aceptás asignaciones nuevas.
            </Alert>
          ) : null}
        </div>
        <div className="ca-onboarding-media__body ca-agency-body">
          <div className="ca-preview-card ca-agency-card">
            <div className="ca-agency-card__head">
              <p className="ca-preview-card__name">{onboarding.preview.fullName}</p>
              <p className="ca-preview-card__email">{onboarding.preview.email}</p>
              <p className="ca-preview-card__summary">{onboarding.preview.summary}</p>
            </div>
            <dl className="ca-preview-list ca-agency-list">
              <div className="ca-agency-list__item">
                <dt>Términos</dt>
                <dd>
                  {onboarding.termsAccepted
                    ? `Aceptados (v${onboarding.termsVersion})`
                    : 'Pendientes'}
                </dd>
              </div>
              <div className="ca-agency-list__item">
                <div className="ca-agency-item__title">
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
                <dd className="ca-agency-row__meta">{onboarding.timezone}</dd>
              </div>
              <div className="ca-agency-list__item">
                <div className="ca-agency-item__title">
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
                  {onboarding.workAreaLabel} · {onboarding.workAreaCity},{' '}
                  {onboarding.workAreaCountry}
                </dd>
                <dd className="ca-agency-row__meta">
                  Radio:{' '}
                  {onboarding.coverageRadiusKm != null
                    ? formatDistance(onboarding.coverageRadiusKm, distanceUnit, 0)
                    : '—'}
                </dd>
              </div>
              <div className="ca-agency-list__item">
                <dt>Tarifa</dt>
                <dd>
                  {onboarding.ratesAccepted
                    ? 'Esquema de plataforma aceptado (80% agente / 20% ConfiApp)'
                    : 'Pendiente'}
                </dd>
              </div>
            </dl>
          </div>

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

          <div className="ca-agency-jobs">
            <Link to="/agente/trabajos" className="ca-agency-jobs__link">
              <BriefcaseBusiness size={18} strokeWidth={1.75} aria-hidden />
              <span>
                <strong>Trabajos abiertos</strong>
                <span className="ca-agency-jobs__hint">Operaciones disponibles para mediar</span>
              </span>
            </Link>
          </div>

          <div className="ca-agency-footer">
            {isInactive ? (
              <Button
                type="button"
                className="ca-btn-primary"
                disabled={busy}
                onClick={onResume}
              >
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
        </div>
      </div>
    </section>
  );
}
