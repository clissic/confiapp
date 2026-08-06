import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Input de contraseña con toggle de visibilidad. */
export function PasswordInput({ className = 'ca-auth__input', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="ca-auth__password">
      <input {...props} className={className} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="ca-auth__password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
      </button>
    </div>
  );
}
