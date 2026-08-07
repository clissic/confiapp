import { Form, Spinner } from 'react-bootstrap';
import { ClipboardList } from 'lucide-react';

import type { TransactionChecklistItem } from '../model/types';

/** Checklist de la operación: el Agente marca ítems; el resto lo ve en solo lectura. */
export function AgentChecklistPanel({
  items,
  canToggle,
  pendingItemId,
  onToggle,
  title = 'Checklist del Agente',
  lead,
}: {
  items: TransactionChecklistItem[];
  canToggle: boolean;
  pendingItemId?: string | null;
  onToggle: (itemId: string, done: boolean) => void;
  title?: string;
  lead?: string;
}) {
  if (!items.length) return null;

  const doneCount = items.filter((item) => item.done).length;

  return (
    <section className="ca-tx-checklist">
      <div className="ca-tx-checklist__head">
        <h3 className="ca-section-title mb-0">
          <ClipboardList size={18} className="me-1" aria-hidden />
          {title}
        </h3>
        <span className="ca-tx-checklist__progress">
          {doneCount}/{items.length}
        </span>
      </div>
      <p className="ca-section-lead ca-tx-checklist__lead">
        {lead ??
          (canToggle
            ? 'Marcá cada paso a medida que lo verifiques en la entrega.'
            : 'Guía de verificación para el Agente (solo visible para vos y el Agente).')}
      </p>
      <ul className="ca-tx-checklist__list">
        {items.map((item) => {
          const pending = pendingItemId === item.id;
          return (
            <li
              key={item.id}
              className={`ca-tx-checklist__item${item.done ? ' ca-tx-checklist__item--done' : ''}`}
            >
              <Form.Check
                type="checkbox"
                id={`checklist-${item.id}`}
                checked={item.done}
                disabled={!canToggle || pending}
                label={item.text}
                onChange={(event) => onToggle(item.id, event.currentTarget.checked)}
              />
              {pending ? <Spinner animation="border" size="sm" className="ms-2" /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
