import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { HELP_SECTIONS } from '../content/help';
import '../styles/legal.css';

/** Centro de Ayuda con guías de producto. */
export function HelpPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, '');
    const el = document.getElementById(`ayuda-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="ca-legal">
      <header className="ca-legal__header">
        <div className="ca-legal__header-main">
          <p className="ca-page__kicker">Soporte</p>
          <h1 className="ca-page__title">Centro de Ayuda</h1>
          <p className="ca-page__lead">
            Guías breves sobre operaciones, pagos, reputación y reclamos.
          </p>
        </div>
      </header>

      <details className="ca-legal__toc" open>
        <summary className="ca-legal__toc-summary">
          <span>Temas</span>
          <span className="ca-legal__toc-count">{HELP_SECTIONS.length}</span>
        </summary>
        <ol className="ca-legal__toc-list">
          {HELP_SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a href={`#ayuda-${section.id}`}>
                <span className="ca-legal__toc-num">{index + 1}</span>
                <span>{section.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </details>

      <div className="ca-legal__body">
        {HELP_SECTIONS.map((section, index) => (
          <section
            key={section.id}
            id={`ayuda-${section.id}`}
            className="ca-legal__section"
          >
            <h2 className="ca-legal__section-title">
              <span className="ca-legal__section-num" aria-hidden>
                {index + 1}
              </span>
              <span>{section.title}</span>
            </h2>

            {section.lead ? <p className="ca-legal__p ca-legal__p--lead">{section.lead}</p> : null}

            {section.paragraphs?.map((p, i) => (
              <p key={`${section.id}-p-${i}`} className="ca-legal__p">
                {p}
              </p>
            ))}

            {section.bullets && section.bullets.length > 0 ? (
              <ul className="ca-legal__bullets">
                {section.bullets.map((b, i) => (
                  <li key={`${section.id}-b-${i}`}>{b}</li>
                ))}
              </ul>
            ) : null}

            {section.subsections?.map((sub) => (
              <div key={sub.title} className="ca-legal__subsection">
                <h3 className="ca-legal__subsection-title">{sub.title}</h3>
                {sub.paragraphs?.map((p, i) => (
                  <p key={`${sub.title}-p-${i}`} className="ca-legal__p">
                    {p}
                  </p>
                ))}
                {sub.bullets && sub.bullets.length > 0 ? (
                  <ul className="ca-legal__bullets">
                    {sub.bullets.map((b, i) => (
                      <li key={`${sub.title}-b-${i}`}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
