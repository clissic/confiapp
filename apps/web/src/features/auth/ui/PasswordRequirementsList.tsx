import { Check, Circle } from 'lucide-react';

import { getPasswordRequirements } from '../lib/password';

/** Lista de requisitos de contraseña que se marcan al cumplirse. */
export function PasswordRequirementsList({ password }: { password: string }) {
  const requirements = getPasswordRequirements(password);

  return (
    <ul className="ca-auth__pw-reqs" aria-live="polite">
      {requirements.map((req) => (
        <li
          key={req.id}
          className={`ca-auth__pw-req${req.met ? ' ca-auth__pw-req--met' : ''}`}
        >
          <span className="ca-auth__pw-req-icon" aria-hidden>
            {req.met ? <Check size={14} strokeWidth={2.5} /> : <Circle size={12} strokeWidth={2} />}
          </span>
          <span>{req.label}</span>
          <span className="visually-hidden">
            {req.met ? 'cumplido' : 'pendiente'}
          </span>
        </li>
      ))}
    </ul>
  );
}
