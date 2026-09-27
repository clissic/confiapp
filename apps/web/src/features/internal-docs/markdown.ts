import { Marked } from 'marked';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const marked = new Marked({
  gfm: true,
  breaks: false,
});

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = (lang ?? '').trim();
      if (language === 'mermaid') {
        return `<pre class="ca-docs-mermaid">${escapeHtml(text)}</pre>\n`;
      }
      const classAttr = language ? ` class="language-${escapeHtml(language)}"` : '';
      return `<pre class="ca-docs-code"><code${classAttr}>${escapeHtml(text)}</code></pre>\n`;
    },
    link({ href, title, text }) {
      const safeHref = href ?? '#';
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      const isExternal = /^https?:\/\//i.test(safeHref);
      const rel = isExternal ? ' rel="noopener noreferrer"' : '';
      const target = isExternal ? ' target="_blank"' : '';
      return `<a href="${escapeHtml(safeHref)}"${titleAttr}${target}${rel}>${text}</a>`;
    },
  },
});

/** Convierte markdown del repo a HTML seguro para el visor interno. */
export function renderDocsMarkdown(source: string): string {
  const result = marked.parse(source, { async: false });
  return typeof result === 'string' ? result : '';
}
