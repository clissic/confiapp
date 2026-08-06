import { useEffect, useState, type ReactNode } from 'react';
import { Alert, OverlayTrigger, Popover, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Camera,
  History,
  Mail,
  Phone,
  Settings,
  Star,
  UserRound,
  Wallet,
} from 'lucide-react';

import { VerifiedName } from '@/shared/ui/VerifiedName';

import { useProfile } from '../hooks/useProfile';
import { HistorySection } from './sections/HistorySection';
import { PhotoSection } from './sections/PhotoSection';
import { ProfileViewSection } from './sections/ProfileViewSection';
import { RatingsSection } from './sections/RatingsSection';
import { SettingsSection } from './sections/SettingsSection';
import { WalletSection } from './sections/WalletSection';
import '../styles/profile.css';

const SECTIONS = [
  { id: 'edit', label: 'Perfil', Icon: UserRound },
  { id: 'history', label: 'Historial', Icon: History },
  { id: 'ratings', label: 'Calificaciones', Icon: Star },
  { id: 'wallet', label: 'Wallet', Icon: Wallet },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'] | 'photo' | 'settings';

function sectionFromTab(tab: string | null): SectionId {
  if (tab === 'settings') return 'settings';
  if (tab === 'photo') return 'photo';
  if (tab === 'history' || tab === 'ratings' || tab === 'wallet') return tab;
  return 'edit';
}

function roleStatus(role: string): { label: string; className: string } {
  if (role === 'ADMIN') {
    return { label: 'Usuario ADMIN', className: 'ca-profile__status-icon--admin' };
  }
  if (role === 'AGENT') {
    return { label: 'Agente', className: 'ca-profile__status-icon--agent' };
  }
  return { label: 'Usuario estándar', className: 'ca-profile__status-icon--user' };
}

/** Ícono de estado con popover (hover en desktop, tap en mobile/tablet). */
function StatusIconPopover({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className: string;
  children: ReactNode;
}) {
  const popover = (
    <Popover id={id} className="ca-profile-status-popover">
      <Popover.Body>{label}</Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger
      trigger={['hover', 'focus', 'click']}
      placement="bottom"
      rootClose
      overlay={popover}
    >
      <button
        type="button"
        className={`ca-profile__status-icon ${className}`}
        aria-label={label}
      >
        {children}
      </button>
    </OverlayTrigger>
  );
}

export function ProfilePage() {
  const { data, isLoading, isError } = useProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<SectionId>(() =>
    sectionFromTab(searchParams.get('tab')),
  );
  const [scrollToEdit, setScrollToEdit] = useState(false);
  const [phoneVerifiedUi, setPhoneVerifiedUi] = useState(false);

  useEffect(() => {
    setSection(sectionFromTab(searchParams.get('tab')));
  }, [searchParams]);

  useEffect(() => {
    if (section !== 'settings' || !scrollToEdit) return;
    const timer = window.setTimeout(() => {
      document.getElementById('editar-perfil')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setScrollToEdit(false);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [section, scrollToEdit]);

  const selectSection = (next: SectionId) => {
    setSection(next);
    if (next === 'settings') {
      setSearchParams({ tab: 'settings' }, { replace: true });
    } else if (searchParams.get('tab')) {
      setSearchParams({}, { replace: true });
    }
  };

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

  const { profile } = data;
  const role = roleStatus(profile.role);
  const emailLabel = profile.emailVerified ? 'Email verificado' : 'Email sin verificar';
  const phoneIsVerified = section === 'settings' ? phoneVerifiedUi : profile.phoneVerified;
  const phoneLabel = phoneIsVerified ? 'Teléfono verificado' : 'Teléfono sin verificar';

  const goToEditProfile = () => {
    setScrollToEdit(true);
    selectSection('settings');
  };

  return (
    <div className="ca-profile">
      <header className="ca-profile__header">
        <div className="ca-profile__identity">
          <button
            type="button"
            className={`ca-profile__avatar ${section === 'photo' ? 'ca-profile__avatar--active' : ''}`}
            aria-label="Editar fotografía de perfil"
            title="Editar fotografía"
            onClick={() => selectSection('photo')}
          >
            <span className="ca-profile__avatar-media" aria-hidden>
              {profile.avatar ? (
                <img src={profile.avatar} alt="" />
              ) : (
                <UserRound size={28} strokeWidth={1.75} />
              )}
            </span>
            <span className="ca-profile__avatar-edit" aria-hidden>
              <Camera size={14} strokeWidth={2} />
            </span>
          </button>
          <div>
            <p className="ca-profile__kicker">Mi perfil</p>
            <VerifiedName
              as="h2"
              className="ca-profile__title"
              name={profile.fullName}
              verified={
                Boolean(profile.identityVerified) || profile.kyc?.status === 'VERIFIED'
              }
            />
            <p className="ca-profile__meta mb-0">
              {profile.email}
              {profile.phone ? ` · ${profile.phone}` : ''}
            </p>
            <div className="ca-profile__badges" aria-label="Estado de la cuenta">
              <StatusIconPopover
                id="profile-status-role"
                label={role.label}
                className={role.className}
              >
                <UserRound size={16} strokeWidth={1.75} aria-hidden />
              </StatusIconPopover>
              <StatusIconPopover
                id="profile-status-email"
                label={emailLabel}
                className={
                  profile.emailVerified
                    ? 'ca-profile__status-icon--ok'
                    : 'ca-profile__status-icon--warn'
                }
              >
                <Mail size={16} strokeWidth={1.75} aria-hidden />
              </StatusIconPopover>
              <StatusIconPopover
                id="profile-status-phone"
                label={phoneLabel}
                className={
                  phoneIsVerified
                    ? 'ca-profile__status-icon--ok'
                    : 'ca-profile__status-icon--warn'
                }
              >
                <Phone size={16} strokeWidth={1.75} aria-hidden />
              </StatusIconPopover>
              <button
                type="button"
                className={`ca-profile__settings-btn ${section === 'settings' ? 'ca-profile__settings-btn--active' : ''}`}
                aria-label="Configuración"
                title="Configuración"
                onClick={() => selectSection('settings')}
              >
                <Settings size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="ca-profile__tabs" aria-label="Secciones de perfil">
        {SECTIONS.map((item) => {
          const { Icon } = item;
          return (
            <button
              key={item.id}
              type="button"
              className={`ca-profile__tab ${section === item.id ? 'ca-profile__tab--active' : ''}`}
              aria-label={item.label}
              title={item.label}
              onClick={() => selectSection(item.id)}
            >
              <Icon className="ca-profile__tab-icon" size={18} strokeWidth={1.75} aria-hidden />
              <span className="ca-profile__tab-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <motion.div
        key={section}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="ca-profile__panel"
      >
        {section === 'edit' ? (
          <ProfileViewSection profile={profile} onEdit={goToEditProfile} />
        ) : null}
        {section === 'photo' ? <PhotoSection profile={profile} /> : null}
        {section === 'history' ? <HistorySection profile={profile} /> : null}
        {section === 'ratings' ? <RatingsSection profile={profile} /> : null}
        {section === 'wallet' ? <WalletSection profile={profile} /> : null}
        {section === 'settings' ? (
          <SettingsSection profile={profile} onPhoneVerifiedUiChange={setPhoneVerifiedUi} />
        ) : null}
      </motion.div>
    </div>
  );
}
