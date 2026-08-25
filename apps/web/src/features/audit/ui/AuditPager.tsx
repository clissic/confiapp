import { Button } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type AuditPagerProps = {
  total: number;
  totalPages: number;
  currentPage: number;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
  itemLabel?: { one: string; other: string };
};

/** Controles de paginación compartidos en auditoría. */
export function AuditPager({
  total,
  totalPages,
  currentPage,
  isFetching = false,
  onPageChange,
  itemLabel = { one: 'evento', other: 'eventos' },
}: AuditPagerProps) {
  const countLabel = total === 1 ? itemLabel.one : itemLabel.other;
  if (totalPages > 1) {
    return (
      <nav className="ca-audit__pager" aria-label="Paginación de auditoría">
        <Button
          type="button"
          variant="outline-secondary"
          size="sm"
          className="ca-audit__pager-btn"
          disabled={currentPage <= 1 || isFetching}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          aria-label="Anterior"
        >
          <ChevronLeft size={16} aria-hidden />
          <span className="ca-audit__pager-label">Anterior</span>
        </Button>
        <span className="ca-audit__pager-status">
          Página {currentPage} de {totalPages}
          <span className="ca-audit__pager-total">
            {' '}
            · {total} {countLabel}
          </span>
        </span>
        <Button
          type="button"
          variant="outline-secondary"
          size="sm"
          className="ca-audit__pager-btn"
          disabled={currentPage >= totalPages || isFetching}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Siguiente"
        >
          <span className="ca-audit__pager-label">Siguiente</span>
          <ChevronRight size={16} aria-hidden />
        </Button>
      </nav>
    );
  }

  if (total > 0) {
    return (
      <p className="ca-audit__pager-status ca-audit__pager-status--solo">
        {total} {countLabel}
      </p>
    );
  }

  return null;
}
