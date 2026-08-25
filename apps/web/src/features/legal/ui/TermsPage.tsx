import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from '../content/terms';
import '../styles/legal.css';

/** Términos y Condiciones — contenido dentro del shell autenticado. */
export function TermsPage() {
  return (
    <div className="ca-legal">
      <header className="ca-legal__header">
        <div className="ca-legal__header-main">
          <p className="ca-page__kicker">Legal</p>
          <h1 className="ca-page__title">Términos y Condiciones de uso</h1>
          <p className="ca-page__lead">
            Condiciones que regulan el acceso y uso de la plataforma ConfiApp en Uruguay.
          </p>
        </div>
        <div className="ca-legal__meta">
          <span className="ca-legal__chip">Documento legal</span>
          <span className="ca-legal__chip ca-legal__chip--muted">
            Actualizado {TERMS_LAST_UPDATED}
          </span>
        </div>
      </header>

      <details className="ca-legal__toc">
        <summary className="ca-legal__toc-summary">
          <span>Índice de secciones</span>
          <span className="ca-legal__toc-count">{TERMS_SECTIONS.length}</span>
        </summary>
        <ol className="ca-legal__toc-list">
          {TERMS_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#termino-${section.id}`}>
                <span className="ca-legal__toc-num">{section.id}</span>
                <span>{section.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </details>

      <div className="ca-legal__body">
        {TERMS_SECTIONS.map((section) => (
          <section key={section.id} id={`termino-${section.id}`} className="ca-legal__section">
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
