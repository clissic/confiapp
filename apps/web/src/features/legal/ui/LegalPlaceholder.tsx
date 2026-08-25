import { Construction } from 'lucide-react';
import { Link } from 'react-router-dom';

import '../styles/legal.css';

export type LegalPlaceholderProps = {
  kicker: string;
  title: string;
  lead: string;
  /** Temas que incluirá la página cuando esté lista. */
  upcomingTopics?: string[];
};

/** Placeholder para páginas legales o de ayuda aún en desarrollo. */
export function LegalPlaceholder({
  kicker,
  title,
  lead,
  upcomingTopics,
}: LegalPlaceholderProps) {
  return (
    <div className="ca-legal">
      <header className="ca-legal__header">
        <div className="ca-legal__header-main">
          <p className="ca-page__kicker">{kicker}</p>
          <h1 className="ca-page__title">{title}</h1>
          <p className="ca-page__lead">{lead}</p>
        </div>
        <div className="ca-legal__meta">
          <span className="ca-legal__chip ca-legal__chip--wip">En desarrollo</span>
        </div>
      </header>

      <div className="ca-legal__placeholder" role="status">
        <div className="ca-legal__placeholder-icon" aria-hidden>
          <Construction size={28} strokeWidth={1.75} />
        </div>
        <h2 className="ca-legal__placeholder-title">Estamos preparando esta sección</h2>
        <p className="ca-legal__placeholder-text">
          El contenido de <strong>{title}</strong> todavía no está publicado. Lo
          estamos armando para que quede claro, completo y alineado con la normativa
          uruguaya aplicable.
        </p>
        {upcomingTopics && upcomingTopics.length > 0 ? (
          <div className="ca-legal__placeholder-topics">
            <p className="ca-legal__placeholder-topics-label">Próximamente incluirá</p>
            <ul className="ca-legal__placeholder-list">
              {upcomingTopics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="ca-legal__placeholder-hint">
          Mientras tanto, podés consultar los{' '}
          <Link to="/terminos" className="ca-legal__placeholder-link">
            Términos y Condiciones
          </Link>{' '}
          o escribirnos desde tu operación si necesitás ayuda urgente.
        </p>
      </div>
    </div>
  );
}
