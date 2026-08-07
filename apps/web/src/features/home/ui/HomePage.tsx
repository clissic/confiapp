import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';

import { HOME_PRIMARY_ACTIONS, type HomeAction } from '@/app/layout/nav-config';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { VerifiedName } from '@/shared/ui/VerifiedName';

import './home.css';

function firstNameFrom(fullName: string | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || 'ahí';
}

function ActionCard({ action, index }: { action: HomeAction; index: number }) {
  return (
    <motion.div
      className="ca-home-card-wrap"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.05, ease: [0, 0, 0.2, 1] }}
    >
      <Link to={action.to} className={`ca-home-card ca-home-card--${action.tone}`}>
        <div className="ca-home-card__visual" aria-hidden>
          <span className="ca-home-card__glass" />
          <img
            src={action.image}
            alt=""
            className="ca-home-card__img"
            width={512}
            height={512}
            decoding="async"
          />
        </div>
        <div className="ca-home-card__footer">
          <div className="ca-home-card__body">
            <h3 className="ca-home-card__title">{action.title}</h3>
            <p className="ca-home-card__desc">{action.description}</p>
          </div>
          <span className="ca-home-card__go" aria-hidden>
            <ArrowRight size={18} strokeWidth={2.25} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/** Inicio autenticado: grilla 2×2 (Comprar, Vender, Mi Agencia, Mensajes). */
export function HomePage() {
  const { user } = useAuth();
  const firstName = firstNameFrom(user?.fullName);

  return (
    <section className="ca-home">
      <header className="ca-home__hero">
        <h1 className="ca-home__greeting">
          Hola,{' '}
          <VerifiedName name={firstName} verified={Boolean(user?.identityVerified)} />{' '}
          👋
        </h1>
        <p className="ca-home__lead">¿Qué querés hacer hoy?</p>
        <p className="ca-home__trust">
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
          <span>
            Todas tus operaciones están <strong>protegidas</strong>
          </span>
        </p>
      </header>

      <div className="ca-home__grid">
        {HOME_PRIMARY_ACTIONS.map((action, index) => (
          <ActionCard key={action.id} action={action} index={index} />
        ))}
      </div>
    </section>
  );
}
