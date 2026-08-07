import { useEffect } from 'react';

const ALERT_SELECTOR = '.alert-danger, .alert-warning';
const SCROLLED_ATTR = 'data-ca-alert-scroll';

function isScrollAlert(el: Element): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    (el.classList.contains('alert-danger') || el.classList.contains('alert-warning'))
  );
}

function scrollToAlert(el: HTMLElement): void {
  const signature = (el.textContent ?? '').trim();
  if (!signature) return;
  if (el.getAttribute(SCROLLED_ATTR) === signature) return;
  el.setAttribute(SCROLLED_ATTR, signature);

  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  });
}

function scanNode(node: Node): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (isScrollAlert(el)) {
    scrollToAlert(el);
  }
  el.querySelectorAll?.(ALERT_SELECTOR).forEach((child) => {
    if (isScrollAlert(child)) scrollToAlert(child);
  });
}

/**
 * Observa el DOM y hace scroll automático a alertas Bootstrap danger/warning
 * cuando aparecen o cambia su mensaje. Cubre Alert de react-bootstrap existentes
 * y futuros sin migrar cada pantalla.
 */
export function AlertScrollObserver() {
  useEffect(() => {
    const root = document.body;

    root.querySelectorAll(ALERT_SELECTOR).forEach((el) => {
      if (isScrollAlert(el)) scrollToAlert(el);
    });

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(scanNode);
          // Texto/contenido reemplazado dentro de un alert ya montado
          if (mutation.target instanceof Element) {
            const host = mutation.target.closest(ALERT_SELECTOR);
            if (host && isScrollAlert(host)) {
              host.removeAttribute(SCROLLED_ATTR);
              scrollToAlert(host);
            }
          }
        } else if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement?.closest(ALERT_SELECTOR);
          if (parent && isScrollAlert(parent)) {
            parent.removeAttribute(SCROLLED_ATTR);
            scrollToAlert(parent);
          }
        } else if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          if (isScrollAlert(mutation.target)) {
            mutation.target.removeAttribute(SCROLLED_ATTR);
            scrollToAlert(mutation.target);
          }
        }
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
