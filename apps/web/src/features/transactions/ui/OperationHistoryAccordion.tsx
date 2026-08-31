import { Accordion } from 'react-bootstrap';
import { History } from 'lucide-react';

import { formatDateTime } from '@/shared/lib/money';
import type { Transaction } from '../model/types';
import { friendlyHistoryNote, historyStatusLabel } from './operation-history';

/** Historial de la operación, colapsado por defecto. */
export function OperationHistoryAccordion({
  tx,
  upcoming,
}: {
  tx: Transaction;
  upcoming?: { title: string; detail: string } | null;
}) {
  if (!tx.statusHistory.length && !upcoming) return null;

  return (
    <Accordion className="ca-tx-history-acc" defaultActiveKey="">
      <Accordion.Item eventKey="history" className="ca-tx-history-acc__item">
        <Accordion.Header>
          <span className="ca-tx-history-acc__title">
            <History size={16} strokeWidth={1.75} aria-hidden />
            Historial de la operación
          </span>
        </Accordion.Header>
        <Accordion.Body>
          <ul className="ca-tx-timeline">
            {tx.statusHistory.map((event, idx) => (
              <li key={`${event.status}-${idx}`} className="ca-tx-timeline__item">
                <div className="ca-tx-timeline__row">
                  <span className="ca-tx-timeline__status">{historyStatusLabel(event)}</span>
                  <time dateTime={event.changedAt}>{formatDateTime(event.changedAt)}</time>
                </div>
                {event.note ? (
                  <p className="ca-tx-timeline__note">{friendlyHistoryNote(event.note)}</p>
                ) : null}
              </li>
            ))}
            {upcoming ? (
              <li
                className="ca-tx-timeline__item ca-tx-timeline__item--pending"
                aria-disabled="true"
              >
                <div className="ca-tx-timeline__row">
                  <span className="ca-tx-timeline__status">{upcoming.title}</span>
                </div>
                <p className="ca-tx-timeline__note">{upcoming.detail}</p>
              </li>
            ) : null}
          </ul>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
}
