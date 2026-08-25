/** Política de contraseña alineada con la API (isStrongPassword). */

export type PasswordRequirementId =
  | 'minLength'
  | 'upper'
  | 'lower'
  | 'digit'
  | 'special';

export interface PasswordRequirement {
  id: PasswordRequirementId;
  label: string;
  met: boolean;
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: 'minLength',
      label: 'Al menos 8 caracteres',
      met: password.length >= 8,
    },
    {
      id: 'upper',
      label: 'Una letra mayúscula',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lower',
      label: 'Una letra minúscula',
      met: /[a-z]/.test(password),
    },
    {
      id: 'digit',
      label: 'Un número',
      met: /\d/.test(password),
    },
    {
      id: 'special',
      label: 'Un símbolo (ej. ! @ # $)',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function isStrongPassword(password: string): boolean {
  if (password.length > 128) return false;
  return getPasswordRequirements(password).every((req) => req.met);
}

export const PASSWORD_HINT =
  'Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo (ej. Demo1234!).';
