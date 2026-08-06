import { BadgeCheck } from 'lucide-react';

type Props = {
  name: string;
  verified?: boolean;
  className?: string;
  as?: 'span' | 'h2' | 'h3' | 'p' | 'strong';
};

/** Nombre con ícono de identidad verificada (KYC). */
export function VerifiedName({ name, verified = false, className, as: Tag = 'span' }: Props) {
  return (
    <Tag className={`ca-verified-name ${className ?? ''}`.trim()}>
      <span className="ca-verified-name__text">{name}</span>
      {verified ? (
        <BadgeCheck
          size={Tag === 'h2' ? 22 : 16}
          strokeWidth={1.5}
          fill="currentColor"
          absoluteStrokeWidth
          className="ca-verified-name__badge"
          aria-label="Identidad verificada"
        />
      ) : null}
    </Tag>
  );
}
