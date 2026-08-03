import { useState } from 'react';
import { Alert, Badge, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { UserRound } from 'lucide-react';

import { useProfile } from '../hooks/useProfile';
import { AddressSection } from './sections/AddressSection';
import { EditProfileSection } from './sections/EditProfileSection';
import { HistorySection } from './sections/HistorySection';
import { PhoneSection } from './sections/PhoneSection';
import { PhotoSection } from './sections/PhotoSection';
import { RatingsSection } from './sections/RatingsSection';
import { SettingsSection } from './sections/SettingsSection';
import { WalletSection } from './sections/WalletSection';
import '../styles/profile.css';

const SECTIONS = [
  { id: 'edit', label: 'Perfil' },
  { id: 'photo', label: 'Fotografía' },
  { id: 'phone', label: 'Teléfono' },
  { id: 'address', label: 'Dirección' },
  { id: 'history', label: 'Historial' },
  { id: 'ratings', label: 'Calificaciones' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'settings', label: 'Configuración' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function ProfilePage() {
  const { data, isLoading, isError } = useProfile();
  const [section, setSection] = useState<SectionId>('edit');

  if (isLoading) {
    return (
      <div className="ca-profile ca-profile--loading">
        <Spinner animation="border" role="status" />
        <span className="ms-2">Cargando perfil…</span>
      </div>
    );
  }

  if (isError || !data) {
    return <Alert variant="danger">No se pudo cargar el perfil.</Alert>;
  }

  const { profile, source } = data;

  return (
    <div className="ca-profile">
      <header className="ca-profile__header">
        <div className="ca-profile__identity">
          <div className="ca-profile__avatar" aria-hidden>
            {profile.avatar ? (
              <img src={profile.avatar} alt="" />
            ) : (
              <UserRound size={28} strokeWidth={1.75} />
            )}
          </div>
          <div>
            <p className="ca-profile__kicker">Mi perfil</p>
            <h2 className="ca-profile__title">{profile.displayName || profile.fullName}</h2>
            <p className="ca-profile__meta mb-0">
              {profile.email}
              {profile.phone ? ` · ${profile.phone}` : ''}
            </p>
            <div className="ca-profile__badges">
              <Badge bg="primary">{profile.role}</Badge>
              {profile.emailVerified ? (
                <Badge className="ca-badge-positive">Email verificado</Badge>
              ) : (
                <Badge bg="warning" text="dark">
                  Email pendiente
                </Badge>
              )}
              <Badge bg="light" text="dark">
                {source === 'demo' ? 'Modo demo' : 'API'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <nav className="ca-profile__tabs" aria-label="Secciones de perfil">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ca-profile__tab ${section === item.id ? 'ca-profile__tab--active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <motion.div
        key={section}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="ca-profile__panel"
      >
        {section === 'edit' ? <EditProfileSection profile={profile} /> : null}
        {section === 'photo' ? <PhotoSection profile={profile} /> : null}
        {section === 'phone' ? <PhoneSection profile={profile} /> : null}
        {section === 'address' ? <AddressSection profile={profile} /> : null}
        {section === 'history' ? <HistorySection profile={profile} /> : null}
        {section === 'ratings' ? <RatingsSection profile={profile} /> : null}
        {section === 'wallet' ? <WalletSection profile={profile} /> : null}
        {section === 'settings' ? <SettingsSection profile={profile} /> : null}
      </motion.div>
    </div>
  );
}
