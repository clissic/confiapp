import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  DOCS_CATALOG,
  DOCS_CATEGORIES,
  findDocById,
  type DocsCategory,
  type DocsEntry,
} from '../catalog';
import { renderDocsMarkdown } from '../markdown';
import { MermaidBlocks } from './MermaidBlocks';
import '../styles/docs-hub.css';

function groupByCategory(docs: DocsEntry[]): Map<DocsCategory, DocsEntry[]> {
  const map = new Map<DocsCategory, DocsEntry[]>();
  for (const cat of DOCS_CATEGORIES) map.set(cat, []);
  for (const doc of docs) {
    const list = map.get(doc.category) ?? [];
    list.push(doc);
    map.set(doc.category, list);
  }
  return map;
}

/** Hub interno de documentación del monorepo (ruta oculta del menú). */
export function DocsHubPage() {
  const { docId } = useParams<{ docId?: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const articleRef = useRef<HTMLElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOCS_CATALOG;
    return DOCS_CATALOG.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.path.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);
  const active = findDocById(docId) ?? null;

  useEffect(() => {
    if (!docId) return;
    if (!findDocById(docId)) {
      navigate('/documentacion', { replace: true });
    }
  }, [docId, navigate]);

  useEffect(() => {
    if (!active) return;
    articleRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [active?.id]);

  const html = useMemo(
    () => (active ? renderDocsMarkdown(active.content) : ''),
    [active],
  );

  return (
    <div className="ca-docs">
      <header className="ca-docs__header">
        <div className="ca-docs__header-main">
          <p className="ca-page__kicker">Interno</p>
          <h1 className="ca-page__title">Documentación</h1>
          <p className="ca-page__lead">
            Índice del monorepo: producto, arquitectura, finanzas y operación.
          </p>
        </div>
        <div className="ca-docs__meta">
          <span className="ca-docs__chip">{DOCS_CATALOG.length} docs</span>
          <span className="ca-docs__chip ca-docs__chip--muted">Sin menú</span>
        </div>
      </header>

      <div className={`ca-docs__layout${active ? ' ca-docs__layout--reading' : ''}`}>
        <aside className="ca-docs__nav" aria-label="Índice de documentación">
          <label className="ca-docs__search">
            <span className="visually-hidden">Buscar documentación</span>
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Buscar por título o ruta…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>

          {filtered.length === 0 ? (
            <p className="ca-docs__empty">Sin resultados para “{query.trim()}”.</p>
          ) : (
            DOCS_CATEGORIES.map((category) => {
              const items = grouped.get(category) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={category} className="ca-docs__group">
                  <h2 className="ca-docs__group-title">{category}</h2>
                  <ul className="ca-docs__list">
                    {items.map((doc) => {
                      const isActive = active?.id === doc.id;
                      return (
                        <li key={doc.id}>
                          <Link
                            to={`/documentacion/${doc.id}`}
                            className={`ca-docs__link${isActive ? ' is-active' : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <span className="ca-docs__link-title">{doc.title}</span>
                            <span className="ca-docs__link-desc">{doc.description}</span>
                            <span className="ca-docs__link-path">{doc.path}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </aside>

        <div className="ca-docs__main">
          {!active ? (
            <div className="ca-docs__welcome">
              <h2 className="ca-docs__welcome-title">Elegí un documento</h2>
              <p className="ca-docs__welcome-text">
                El índice a la izquierda lista toda la documentación indexada del repo. Esta ruta
                no está en el menú lateral; se abre solo con el enlace directo.
              </p>
              <ul className="ca-docs__welcome-hints">
                <li>
                  Empezá por{' '}
                  <Link to="/documentacion/operation-flows">Flujos de operación</Link> o{' '}
                  <Link to="/documentacion/web-app">Web App</Link>.
                </li>
                <li>
                  Spec financiera:{' '}
                  <Link to="/documentacion/financial-mvp">Especificación financiera MVP</Link>.
                </li>
              </ul>
            </div>
          ) : (
            <article className="ca-docs__article" ref={articleRef}>
              <div className="ca-docs__article-bar">
                <Link to="/documentacion" className="ca-docs__back">
                  ← Índice
                </Link>
                <span className="ca-docs__article-path">{active.path}</span>
                <span className="ca-docs__chip ca-docs__chip--cat">{active.category}</span>
              </div>
              <div
                className="ca-docs__content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
              <MermaidBlocks rootRef={articleRef} contentKey={active.id} />
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
