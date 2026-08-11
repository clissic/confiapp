import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import '../styles/photo-lightbox.css';

type GalleryImage = {
  url: string;
  alt?: string;
};

type Props = {
  images: GalleryImage[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function PhotoLightbox({
  images,
  index,
  open,
  onClose,
  onIndexChange,
}: Props) {
  const titleId = useId();
  const current = images[index];
  const hasMany = images.length > 1;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (!hasMany) return;
      if (event.key === 'ArrowLeft') {
        onIndexChange((index - 1 + images.length) % images.length);
      }
      if (event.key === 'ArrowRight') {
        onIndexChange((index + 1) % images.length);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, hasMany, index, images.length, onClose, onIndexChange]);

  if (!open || !current) return null;

  return createPortal(
    <div
      className="ca-photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="ca-photo-lightbox__chrome"
        onClick={(event) => event.stopPropagation()}
      >
        <p id={titleId} className="ca-photo-lightbox__title">
          {current.alt || 'Foto del producto'}
          {hasMany ? (
            <span>
              {' '}
              · {index + 1}/{images.length}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          className="ca-photo-lightbox__close"
          aria-label="Cerrar galería"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>

      <div
        className="ca-photo-lightbox__stage"
        onClick={(event) => event.stopPropagation()}
      >
        {hasMany ? (
          <button
            type="button"
            className="ca-photo-lightbox__nav ca-photo-lightbox__nav--prev"
            aria-label="Foto anterior"
            onClick={() =>
              onIndexChange((index - 1 + images.length) % images.length)
            }
          >
            <ChevronLeft size={28} />
          </button>
        ) : null}

        <img
          src={current.url}
          alt={current.alt || 'Foto del producto'}
          className="ca-photo-lightbox__image"
        />

        {hasMany ? (
          <button
            type="button"
            className="ca-photo-lightbox__nav ca-photo-lightbox__nav--next"
            aria-label="Foto siguiente"
            onClick={() => onIndexChange((index + 1) % images.length)}
          >
            <ChevronRight size={28} />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
