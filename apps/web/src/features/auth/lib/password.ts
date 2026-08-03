/** Política de contraseña alineada con la API (isStrongPassword). */
export function isStrongPassword(password: string): boolean {
  if (password.length < 8 || password.length > 128) return false;
  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export const PASSWORD_HINT =
  'Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo (ej. Demo1234!).';
