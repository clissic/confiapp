import { Pencil } from 'lucide-react';
import { Button } from 'react-bootstrap';

import { findCountryByIso } from '../../model/country-dial-codes';
import { formatPayoutMethodType } from '../../model/payout-methods';
import type { UserProfile } from '../../model/types';
import { MaskedAccountNumber } from '../MaskedAccountNumber';
import { VerifiedName } from '@/shared/ui/VerifiedName';

function displayOrDash(value: string | undefined | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

function splitStreetLine(line1: string | undefined): { street: string; streetNumber: string } {
  const value = (line1 ?? '').trim();
  if (!value) return { street: '', streetNumber: '' };
  const match = value.match(/^(.*?)(?:\s+)(\d+[A-Za-z0-9\-º°]*)$/);
  if (!match) return { street: value, streetNumber: '' };
  return {
    street: (match[1] ?? '').trim(),
    streetNumber: match[2] ?? '',
  };
}

function joinParts(parts: Array<string | undefined | null>, sep = ' · '): string {
  return parts.map((p) => p?.trim()).filter(Boolean).join(sep);
}

export function ProfileViewSection({
  profile,
  onEdit,
}: {
  profile: UserProfile;
  onEdit: () => void;
}) {
  const countryName =
    findCountryByIso(profile.address.country ?? '')?.name ?? profile.address.country;
  const { street, streetNumber } = splitStreetLine(profile.address.line1);

  const streetLine = joinParts([
    joinParts([street, streetNumber], ' '),
    profile.address.line2?.trim() || null,
    profile.address.postalCode ? `CP ${profile.address.postalCode}` : null,
  ]);

  const localityLine = joinParts([
    profile.locationLabel,
    joinParts([profile.address.city, profile.address.state], ', '),
  ]);

  const countryLine = countryName?.trim() || '';
  const hasAddress = Boolean(streetLine || localityLine || countryLine);
  const bio = profile.bio?.trim();
  const payoutMethods = profile.payoutMethods ?? [];

  return (
    <section className="ca-profile-view">
      <div className="ca-profile-view__card">
        <div className="ca-profile-view__head">
          <h3 className="ca-profile-view__heading">Datos personales</h3>
          <Button
            type="button"
            className="ca-btn-cta ca-profile-view__edit"
            onClick={onEdit}
            aria-label="Editar"
            title="Editar"
          >
            <Pencil size={18} strokeWidth={1.75} aria-hidden />
            <span className="d-none d-md-inline">Editar</span>
          </Button>
        </div>

        <div className="ca-profile-view__fields">
          <div className="ca-profile-view__field">
            <p className="ca-profile-view__label">Nombre completo</p>
            <VerifiedName
              className="ca-profile-view__value"
              name={displayOrDash(profile.fullName)}
              verified={
                Boolean(profile.identityVerified) || profile.kyc?.status === 'VERIFIED'
              }
            />
          </div>
          <div className="ca-profile-view__field">
            <p className="ca-profile-view__label">DNI / Pasaporte</p>
            <p className="ca-profile-view__value">{displayOrDash(profile.documentNumber)}</p>
          </div>
          <div className="ca-profile-view__field">
            <p className="ca-profile-view__label">Teléfono</p>
            <p className="ca-profile-view__value">{displayOrDash(profile.phone)}</p>
          </div>
        </div>

        {bio ? (
          <div className="ca-profile-view__bio">
            <p className="ca-profile-view__label">Biografía</p>
            <p className="ca-profile-view__value ca-profile-view__value--multiline">{bio}</p>
          </div>
        ) : null}

        <div className="ca-profile-view__address">
          <h4 className="ca-profile-view__subheading">Dirección</h4>
          {hasAddress ? (
            <>
              {streetLine ? <p className="ca-profile-view__value">{streetLine}</p> : null}
              {localityLine ? <p className="ca-profile-view__value">{localityLine}</p> : null}
              {countryLine ? <p className="ca-profile-view__value">{countryLine}</p> : null}
            </>
          ) : (
            <p className="ca-profile-view__value">—</p>
          )}
        </div>

        <div className="ca-profile-view__payouts">
          <h4 className="ca-profile-view__subheading">Métodos de cobro</h4>
          {payoutMethods.length > 0 ? (
            <ul className="ca-profile-view__payout-list">
              {payoutMethods.map((method) => (
                <li key={method.id} className="ca-profile-view__payout-item">
                  <div className="ca-profile-view__payout-main">
                    <p className="ca-profile-view__value ca-profile-view__payout-bank">{method.bank}</p>
                    <p className="ca-profile-view__payout-meta">{formatPayoutMethodType(method)}</p>
                  </div>
                  <p className="ca-profile-view__payout-number">
                    <MaskedAccountNumber number={method.number} />
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ca-profile-view__value">—</p>
          )}
        </div>
      </div>
    </section>
  );
}
