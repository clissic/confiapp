import { useEffect, useId, useRef, type RefObject } from 'react';

type MermaidBlocksProps = {
  /** Contenedor del HTML ya parseado (incluye `.ca-docs-mermaid`). */
  rootRef: RefObject<HTMLElement | null>;
  /** Cambia al cambiar de documento para re-renderizar diagramas. */
  contentKey: string;
};

/** Renderiza bloques Mermaid dentro del HTML del documento activo. */
export function MermaidBlocks({ rootRef, contentKey }: MermaidBlocksProps) {
  const runId = useId().replace(/:/g, '');
  const themeRef = useRef<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.ca-docs-mermaid'));
    if (nodes.length === 0) return;

    let cancelled = false;

    void (async () => {
      const mermaid = (await import('mermaid')).default;
      const themeAttr =
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';

      if (themeRef.current !== themeAttr) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: themeAttr,
          fontFamily: 'inherit',
        });
        themeRef.current = themeAttr;
      }

      for (let i = 0; i < nodes.length; i += 1) {
        if (cancelled) return;
        const el = nodes[i];
        if (!el) continue;
        const source = el.textContent?.trim() ?? '';
        if (!source) continue;

        try {
          const id = `ca-docs-mmd-${runId}-${i}`;
          const { svg } = await mermaid.render(id, source);
          if (cancelled) return;
          el.innerHTML = svg;
          el.setAttribute('data-rendered', 'true');
        } catch {
          el.setAttribute('data-error', 'true');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentKey, rootRef, runId]);

  return null;
}
