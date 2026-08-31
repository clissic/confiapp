import { Star } from 'lucide-react';
import { useState } from 'react';

type StarRatingInputProps = {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  disabled?: boolean;
  size?: number;
};

/** Selector de puntaje con estrellas grandes (1–5). */
export function StarRatingInput({
  value,
  onChange,
  max = 5,
  disabled = false,
  size = 40,
}: StarRatingInputProps) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="ca-star-rating" role="radiogroup" aria-label="Puntaje">
      {Array.from({ length: max }, (_, index) => {
        const star = index + 1;
        const filled = star <= display;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} de ${max}`}
            disabled={disabled}
            className={`ca-star-rating__star${filled ? ' is-filled' : ''}`}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
          >
            <Star size={size} strokeWidth={1.5} fill={filled ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </div>
  );
}
