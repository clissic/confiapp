import { PRIVACY_LAST_UPDATED, PRIVACY_SECTIONS } from '../content/privacy';
import '../styles/legal.css';

/** Política de Privacidad — contenido alineado a Ley 18.331 (Uruguay). */
export function PrivacyPage() {
  return (
    <div className="ca-legal">
      <header className="ca-legal__header">
        <div className="ca-legal__header-main">
          <p className="ca-page__kicker">Legal</p>
          <h1 className="ca-page__title">Política de Privacidad</h1>
          <p className="ca-page__lead">
            Cómo recopilamos, usamos y protegemos tus datos personales en ConfiApp, conforme a la
            normativa uruguaya (Ley N° 18.331).
          </p>
        </div>
        <div className="ca-legal__meta">
          <span className="ca-legal__chip">Documento legal</span>
          <span className="ca-legal__chip ca-legal__chip--muted">
            Actualizado {PRIVACY_LAST_UPDATED}
          </span>
        </div>
      </header>

      <details className="ca-legal__toc">
        <summary className="ca-legal__toc-summary">
          <span>Índice de secciones</span>
          <span className="ca-legal__toc-count">{PRIVACY_SECTIONS.length}</span>
        </summary>
        <ol className="ca-legal__toc-list">
          {PRIVACY_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#privacidad-${section.id}`}>
                <span className="ca-legal__toc-num">{section.id}</span>
                <span>{section.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </details>

      <div className="ca-legal__body">
        {PRIVACY_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={`privacidad-${section.id}`}
            className="ca-legal__section"
          >
            <h2 className="ca-legal__section-title">
              <span className="ca-legal__section-num" aria-hidden>
                {section.id}
              </span>
              <span>{section.title}</span>
            </h2>

            {section.paragraphs.map((p, i) => (
              <p key={`${section.id}-p-${i}`} className="ca-legal__p">
                {p}
              </p>
            ))}

            {section.items && section.items.length > 0 ? (
              <ol className="ca-legal__letters">
                {section.items.map((item, i) => (
                  <li key={`${section.id}-item-${i}`}>{item}</li>
                ))}
              </ol>
            ) : null}

            {section.bullets && section.bullets.length > 0 ? (
              <ul className="ca-legal__bullets">
                {section.bullets.map((b, i) => (
                  <li key={`${section.id}-b-${i}`}>{b}</li>
                ))}
              </ul>
            ) : null}

            {section.afterItems?.map((p, i) => (
              <p key={`${section.id}-after-${i}`} className="ca-legal__p">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
