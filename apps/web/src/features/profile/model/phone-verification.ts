const LOCAL_VERIFIED_KEY = 'confiapp.phone.localVerified';

type LocalVerifiedPayload = {
  userId: string;
  digits: string;
};

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

function readLocalVerified(): LocalVerifiedPayload | null {
  try {
    const raw = sessionStorage.getItem(LOCAL_VERIFIED_KEY);
    if (!raw) return null;
    // Compat: versiones viejas guardaban solo dígitos.
    if (/^\d+$/.test(raw)) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<LocalVerifiedPayload>;
    if (!parsed.userId || !parsed.digits) return null;
    return { userId: parsed.userId, digits: parsed.digits };
  } catch {
    return null;
  }
}

/** Teléfono marcado como verificado en esta sesión (stub UI, sin backend). */
export function getLocalVerifiedPhoneDigits(userId?: string | null): string | null {
  const payload = readLocalVerified();
  if (!payload) return null;
  if (userId && payload.userId !== userId) return null;
  return payload.digits;
}

export function setLocalVerifiedPhone(userId: string, phone: string): void {
  const digits = phoneDigits(phone);
  if (!userId || !digits) return;
  try {
    const payload: LocalVerifiedPayload = { userId, digits };
    sessionStorage.setItem(LOCAL_VERIFIED_KEY, JSON.stringify(payload));
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
  userId?: string | null;
  currentPhone: string | null | undefined;
  savedPhone: string | null | undefined;
  profilePhoneVerified: boolean;
}): boolean {
  const current = phoneDigits(options.currentPhone);
  if (!current) return false;

  if (options.profilePhoneVerified && phonesMatch(options.currentPhone, options.savedPhone)) {
    return true;
  }

  return getLocalVerifiedPhoneDigits(options.userId) === current;
}
