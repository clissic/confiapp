import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Handshake, Package, ShoppingBag } from 'lucide-react';

import '../styles/transactions.css';

export function NewTransactionHubPage() {
  return (
    <div className="ca-tx">
      <header className="ca-tx__header">
        <div className="ca-tx__brand">
          <Handshake size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-tx__kicker">Nueva operación</p>
            <h2 className="ca-tx__title">¿Quién inicia?</h2>
            <p className="ca-tx__lead">
              Elegí tu rol. Generamos un enlace para invitar a la otra parte.
            </p>
          </div>
        </div>
        <Link to="/operaciones" className="btn btn-outline-secondary">
          Volver
        </Link>
      </header>

      <div className="ca-tx-role-grid">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="ca-tx-panel ca-tx-role"
        >
          <ShoppingBag size={28} strokeWidth={1.6} />
          <h3 className="ca-section-title">Soy comprador</h3>
          <p className="ca-section-lead">
            Definís el acuerdo y el monto. El vendedor completa el producto al recibir el
            enlace.
          </p>
          <Link to="/operaciones/nueva/comprador" className="btn ca-btn-primary">
            Iniciar como comprador
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="ca-tx-panel ca-tx-role"
        >
          <Package size={28} strokeWidth={1.6} />
          <h3 className="ca-section-title">Soy vendedor</h3>
          <p className="ca-section-lead">
            Cargás el producto, precio y fotos. Generamos un enlace para que el comprador
            acepte.
          </p>
          <Link to="/operaciones/nueva/vendedor" className="btn ca-btn-cta">
            Iniciar como vendedor
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
