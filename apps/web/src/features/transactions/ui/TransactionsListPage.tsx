import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Spinner } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { Handshake, Plus } from 'lucide-react';

import { formatOperationMoney } from '@/shared/lib/money';
import { useTransactions } from '../hooks/useTransactions';
import { STATUS_LABELS, type Transaction } from '../model/types';
import '../styles/transactions.css';

type OpsTab = 'buyer' | 'seller';

const TABS: Array<{ id: OpsTab; label: string; empty: string; createTo: string; createLabel: string }> =
  [
    {
      id: 'buyer',
      label: 'Como comprador',
      empty: 'Todavía no iniciaste operaciones como comprador.',
      createTo: '/operaciones/nueva/comprador',
      createLabel: 'Iniciar como comprador',
    },
    {
      id: 'seller',
      label: 'Como vendedor',
      empty: 'Todavía no iniciaste operaciones como vendedor.',
      createTo: '/operaciones/nueva/vendedor',
      createLabel: 'Iniciar como vendedor',
    },
  ];

function isInitiatedAs(tx: Transaction, tab: OpsTab): boolean {
  if (tab === 'buyer') {
    return tx.initiatedBy === 'BUYER' && tx.viewerRole === 'BUYER';
  }
  return tx.initiatedBy === 'SELLER' && tx.viewerRole === 'SELLER';
}

export function TransactionsListPage() {
  const { data, isLoading, isError } = useTransactions();
  const [tab, setTab] = useState<OpsTab>('buyer');

  const list = data?.data ?? [];
  const filtered = useMemo(() => list.filter((tx) => isInitiatedAs(tx, tab)), [list, tab]);
  const activeTab = TABS.find((item) => item.id === tab)!;
  const buyerCount = useMemo(
    () => list.filter((tx) => isInitiatedAs(tx, 'buyer')).length,
    [list],
  );
  const sellerCount = useMemo(
    () => list.filter((tx) => isInitiatedAs(tx, 'seller')).length,
    [list],
  );
  const counts: Record<OpsTab, number> = { buyer: buyerCount, seller: sellerCount };

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

  return (
    <div className="ca-tx">
      <header className="ca-tx__header">
        <div className="ca-tx__brand">
          <Handshake size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-tx__kicker">Operaciones</p>
            <h2 className="ca-tx__title">Tus acuerdos de confianza</h2>
            <p className="ca-tx__lead">
              Separá las operaciones que iniciaste como comprador de las que iniciaste como
              vendedor.
            </p>
          </div>
        </div>
        <div className="ca-tx__meta col-12 col-md-auto px-0">
          <Link to={activeTab.createTo} className="btn ca-btn-cta w-100 w-md-auto">
            <Plus size={16} className="me-1" />
            {activeTab.createLabel}
          </Link>
        </div>
      </header>

      <div className="ca-tx-ops-tabs" role="tablist" aria-label="Rol con el que iniciaste">
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`ops-tab-${item.id}`}
              className={['ca-tx-ops-tabs__btn', selected ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setTab(item.id)}
            >
              <span>{item.label}</span>
              <span className="ca-tx-ops-tabs__count">{counts[item.id]}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          role="tabpanel"
          aria-labelledby={`ops-tab-${tab}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0, 0, 0.2, 1] }}
        >
          {filtered.length === 0 ? (
            <div className="ca-tx-panel ca-tx-empty">
              <Handshake size={36} strokeWidth={1.5} />
              <p>{activeTab.empty}</p>
              <Link to={activeTab.createTo} className="btn ca-btn-primary">
                {activeTab.createLabel}
              </Link>
            </div>
          ) : (
            <ul className="ca-tx-list">
              {filtered.map((tx, index) => (
                <motion.li
                  key={tx.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Link className="ca-tx-list__item" to={`/operaciones/${tx.code}`}>
                    <div className="ca-tx-list__row">
                      <span className="ca-tx-list__name">{tx.title}</span>
                      <Badge bg="primary">{STATUS_LABELS[tx.status]}</Badge>
                    </div>
                    <div className="ca-tx-list__row">
                      <span className="ca-tx-list__code">{tx.code}</span>
                      <span>{formatOperationMoney(tx.amountCents, tx.currency)}</span>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
