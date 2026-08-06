const LOCAL_VERIFIED_KEY = 'confiapp.phone.localVerified';

/** Normaliza un teléfono a solo dígitos para comparar. */
export function phoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = phoneDigits(a);
  const right = phoneDigits(b);
  return Boolean(left) && left === right;
}

/** Teléfono marcado como verificado en esta sesión (stub UI, sin backend). */
export function getLocalVerifiedPhoneDigits(): string | null {
  try {
    return sessionStorage.getItem(LOCAL_VERIFIED_KEY);
  } catch {
    return null;
  }
}

export function setLocalVerifiedPhone(phone: string): void {
  const digits = phoneDigits(phone);
  if (!digits) return;
  try {
    sessionStorage.setItem(LOCAL_VERIFIED_KEY, digits);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearLocalVerifiedPhone(): void {
  try {
    sessionStorage.removeItem(LOCAL_VERIFIED_KEY);
  } catch {
    /* ignore */
  }
}

/** ¿El número actual cuenta como verificado (perfil o stub de sesión)? */
export function isPhoneCurrentlyVerified(options: {
  currentPhone: string | null | undefined;
  savedPhone: string | null | undefined;
  profilePhoneVerified: boolean;
}): boolean {
  const current = phoneDigits(options.currentPhone);
  if (!current) return false;

  if (options.profilePhoneVerified && phonesMatch(options.currentPhone, options.savedPhone)) {
    return true;
  }

  return getLocalVerifiedPhoneDigits() === current;
}
