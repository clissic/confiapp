import { useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { CheckCircle2, ClipboardList } from 'lucide-react';

import type { TransactionChecklistItem } from '../model/types';

/** Checklist de la operación: el Agente marca ítems; el resto lo ve en solo lectura. */
export function AgentChecklistPanel({
  items,
  canToggle,
  pendingItemId,
  onToggle,
  title = 'Checklist del Agente',
  lead,
  showFinalize = false,
  finalizePending = false,
  verificationDone = false,
  verificationPassed,
  /** Si se pasa, el modal usa este valor (p. ej. todos los checklists). */
  finalizeAllPassed,
  onFinalize,
}: {
  items: TransactionChecklistItem[];
  canToggle: boolean;
  pendingItemId?: string | null;
  onToggle: (itemId: string, done: boolean) => void;
  title?: string;
  lead?: string;
  /** Muestra el CTA “Finalizar verificación” (solo Agente). */
  showFinalize?: boolean;
  finalizePending?: boolean;
  verificationDone?: boolean;
  verificationPassed?: boolean;
  finalizeAllPassed?: boolean;
  onFinalize?: (note?: string) => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState('');

  if (!items.length) return null;

  const doneCount = items.filter((item) => item.done).length;
  const allPassed = finalizeAllPassed ?? doneCount === items.length;

  const closeModal = () => {
    if (finalizePending) return;
    setConfirmOpen(false);
    setNote('');
  };

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
                disabled={!canToggle || pending || verificationDone}
                label={item.text}
                onChange={(event) => onToggle(item.id, event.currentTarget.checked)}
              />
              {pending ? <Spinner animation="border" size="sm" className="ms-2" /> : null}
            </li>
          );
        })}
      </ul>

      {showFinalize ? (
        <div className="ca-tx-checklist__finalize">
          {verificationDone ? (
            <p className="ca-tx-checklist__finalize-done mb-0">
              <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
              {verificationPassed
                ? 'Verificación finalizada: todo correcto. El comprador ya fue notificado.'
                : 'Verificación finalizada con observaciones. El comprador ya fue notificado.'}
            </p>
          ) : (
            <Button
              type="button"
              className="ca-btn-cta"
              disabled={!canToggle || finalizePending}
              onClick={() => {
                setNote('');
                setConfirmOpen(true);
              }}
            >
              Finalizar verificación
            </Button>
          )}
        </div>
      ) : null}

      <Modal show={confirmOpen} onHide={closeModal} centered>
        <Modal.Header closeButton={!finalizePending}>
          <Modal.Title>
            {allPassed ? 'Verificación correcta' : 'Verificación incompleta'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {allPassed ? (
            <p>
              Se detectó que toda la verificación fue correcta. Al confirmar, se procederá a
              notificar al comprador.
            </p>
          ) : (
            <p>
              Se detectó que faltan pasos de verificación o no todos están marcados. Al confirmar,
              se procederá a notificar al comprador.
            </p>
          )}
          <Form.Group controlId="agent-verification-note">
            <Form.Label>Nota para el comprador (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={2000}
              value={note}
              disabled={finalizePending}
              placeholder="Ej.: el producto coincide, pero el embalaje venía abierto…"
              onChange={(event) => setNote(event.currentTarget.value)}
            />
            <Form.Text muted>Hasta 2000 caracteres. El comprador la verá al decidir.</Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={finalizePending} onClick={closeModal}>
            Volver
          </Button>
          <Button
            className="ca-btn-cta"
            disabled={finalizePending}
            onClick={() => {
              void (async () => {
                try {
                  await onFinalize?.(note.trim() || undefined);
                  setConfirmOpen(false);
                  setNote('');
                } catch {
                  /* el caller muestra el error */
                }
              })();
            }}
          >
            {finalizePending ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Notificando…
              </>
            ) : (
              'Confirmar y notificar'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}
