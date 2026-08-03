import { Link } from 'react-router-dom';
import { Alert, Badge, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { Handshake, Plus } from 'lucide-react';

import { formatMoney } from '../api/transactions.api';
import { useTransactions } from '../hooks/useTransactions';
import { STATUS_LABELS } from '../model/types';
import '../styles/transactions.css';

export function TransactionsListPage() {
  const { data, isLoading, isError } = useTransactions();

  if (isLoading) {
    return (
      <div className="ca-tx ca-tx--loading">
        <Spinner animation="border" />
        <span>Cargando operaciones…</span>
      </div>
    );
  }

  if (isError || !data) {
    return <Alert variant="danger">No se pudieron cargar las operaciones.</Alert>;
  }

  const list = data.data;

  return (
    <div className="ca-tx">
      <header className="ca-tx__header">
        <div className="ca-tx__brand">
          <Handshake size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-tx__kicker">Operaciones</p>
            <h2 className="ca-tx__title">Tus acuerdos de confianza</h2>
            <p className="ca-tx__lead">
              Iniciá como comprador o vendedor, generá el enlace y compartilo con la otra
              parte.
            </p>
          </div>
        </div>
        <div className="ca-tx__meta">
          <Badge bg="light" text="dark">
            {data.source === 'demo' ? 'Modo demo' : 'API'}
          </Badge>
          <Link to="/operaciones/nueva" className="btn ca-btn-cta">
            <Plus size={16} className="me-1" />
            Iniciar operación
          </Link>
        </div>
      </header>

      {list.length === 0 ? (
        <motion.div
          className="ca-tx-panel ca-tx-empty"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Handshake size={36} strokeWidth={1.5} />
          <p>Todavía no tenés operaciones.</p>
          <Link to="/operaciones/nueva" className="btn ca-btn-primary">
            Crear la primera
          </Link>
        </motion.div>
      ) : (
        <ul className="ca-tx-list">
          {list.map((tx, index) => (
            <motion.li
              key={tx.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Link className="ca-tx-list__item" to={`/operaciones/${tx.code}`}>
                <div className="ca-tx-list__row">
                  <span className="ca-tx-list__name">{tx.title}</span>
                  <Badge bg="primary">{STATUS_LABELS[tx.status]}</Badge>
                </div>
                <div className="ca-tx-list__row">
                  <span className="ca-tx-list__code">{tx.code}</span>
                  <span>{formatMoney(tx.amountCents, tx.currency)}</span>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
