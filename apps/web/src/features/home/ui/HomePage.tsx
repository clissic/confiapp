import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';

import { HOME_PRIMARY_ACTIONS, HOME_TOOL_ACTIONS, type HomeAction } from '@/app/layout/nav-config';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { VerifiedName } from '@/shared/ui/VerifiedName';

import './home.css';

function firstNameFrom(fullName: string | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || 'ahí';
}

function ActionCard({ action, index }: { action: HomeAction; index: number }) {
  const Icon = action.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04, ease: [0, 0, 0.2, 1] }}
    >
      <Link
        to={action.to}
        className={`ca-home-card ca-home-card--${action.size} ca-home-card--${action.tone}`}
      >
        <div className="ca-home-card__icon" aria-hidden>
          <Icon size={action.size === 'lg' ? 36 : action.size === 'md' ? 30 : 22} strokeWidth={1.6} />
        </div>
        <div className="ca-home-card__body">
          <h3 className="ca-home-card__title">{action.title}</h3>
          <p className="ca-home-card__desc">{action.description}</p>
        </div>
        <span className="ca-home-card__go" aria-hidden>
          <ArrowRight size={16} strokeWidth={2} />
        </span>
      </Link>
    </motion.div>
  );
}

/** Inicio autenticado: acciones principales + herramientas (sin marketing). */
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

      <div className="ca-home__primary">
        {HOME_PRIMARY_ACTIONS.filter((a) => a.size === 'lg').map((action, index) => (
          <ActionCard key={action.id} action={action} index={index} />
        ))}
      </div>

      <div className="ca-home__secondary">
        {HOME_PRIMARY_ACTIONS.filter((a) => a.size === 'md').map((action, index) => (
          <ActionCard key={action.id} action={action} index={index + 2} />
        ))}
      </div>

      <div className="ca-home__tools">
        <h2 className="ca-home__tools-title">Más opciones</h2>
        <div className="ca-home__tools-grid">
          {HOME_TOOL_ACTIONS.map((action, index) => (
            <ActionCard key={action.id} action={action} index={index + 5} />
          ))}
        </div>
      </div>
    </section>
  );
}
