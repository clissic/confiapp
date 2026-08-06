import { Form } from 'react-bootstrap';
import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { ImagePlus, Link2, Upload } from 'lucide-react';

import {
  fileToImageDataUrl,
  IMAGE_ACCEPTED_TYPES,
  type ImageProcessOptions,
} from '../model/image-source';

type SourceMode = 'url' | 'file';

type Props = {
  id: string;
  title: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  processOptions?: ImageProcessOptions;
  maxHintLabel?: string;
};

export function ImageSourceField({
  id,
  title,
  hint,
  value,
  onChange,
  disabled = false,
  processOptions,
  maxHintLabel = 'máx. 1 MB',
}: Props) {
  const fileInputId = useId();
  const [source, setSource] = useState<SourceMode>(
    value.startsWith('data:image/') ? 'file' : 'url',
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [urlDraft, setUrlDraft] = useState(value.startsWith('http') ? value : '');
  const [readingFile, setReadingFile] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(value || null);
    if (value.startsWith('http')) {
      setUrlDraft(value);
      setSource('url');
      setFileName(null);
    } else if (value.startsWith('data:image/')) {
      setSource('file');
    } else if (!value) {
      setUrlDraft('');
      setFileName(null);
    }
  }, [value]);

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setLocalError(null);
    setReadingFile(true);
    try {
      const dataUrl = await fileToImageDataUrl(file, processOptions);
      onChange(dataUrl);
      setPreview(dataUrl);
      setFileName(file.name);
      setSource('file');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
      setFileName(null);
      input.value = '';
    } finally {
      setReadingFile(false);
    }
  };

  return (
    <div className="ca-kyc-slot">
      <h4 className="ca-kyc-slot__title">{title}</h4>
      <p className="ca-kyc-slot__hint">{hint}</p>

      <div className="ca-photo-editor ca-kyc-slot__editor">
        <div className="ca-photo-preview ca-kyc-slot__preview">
          {preview ? (
            <img src={preview} alt={`Vista previa: ${title}`} />
          ) : (
            <div className="ca-photo-preview__empty">
              <ImagePlus size={28} />
              <span>Sin imagen</span>
            </div>
          )}
        </div>

        <div className="ca-photo-editor__controls">
          <div className="ca-photo-source" role="tablist" aria-label={`Origen · ${title}`}>
            <button
              type="button"
              role="tab"
              aria-selected={source === 'url'}
              disabled={disabled}
              className={`ca-photo-source__btn ${source === 'url' ? 'ca-photo-source__btn--active' : ''}`}
              onClick={() => {
                setSource('url');
                setLocalError(null);
                setFileName(null);
                if (urlDraft.startsWith('http')) {
                  onChange(urlDraft);
                  setPreview(urlDraft);
                }
              }}
            >
              <Link2 size={16} aria-hidden />
              URL
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={source === 'file'}
              disabled={disabled}
              className={`ca-photo-source__btn ${source === 'file' ? 'ca-photo-source__btn--active' : ''}`}
              onClick={() => {
                setSource('file');
                setLocalError(null);
              }}
            >
              <Upload size={16} aria-hidden />
              Archivo
            </button>
          </div>

          {source === 'url' ? (
            <Form.Group controlId={`${id}-url`} className="mb-0">
              <Form.Label className="visually-hidden">URL de imagen</Form.Label>
              <Form.Control
                value={urlDraft}
                disabled={disabled}
                placeholder="https://…"
                inputMode="url"
                onChange={(event) => {
                  const next = event.target.value.trim();
                  setUrlDraft(event.target.value);
                  if (/^https?:\/\//i.test(next)) {
                    onChange(next);
                    setPreview(next);
                    setLocalError(null);
                  } else if (!next) {
                    onChange('');
                    setPreview(null);
                  }
                }}
              />
            </Form.Group>
          ) : (
            <Form.Group controlId={fileInputId} className="mb-0">
              <Form.Label className="visually-hidden">Archivo local</Form.Label>
              <div className="ca-photo-file">
                <input
                  id={fileInputId}
                  className="ca-photo-file__input"
                  type="file"
                  accept={IMAGE_ACCEPTED_TYPES.join(',')}
                  onChange={(event) => void onPickFile(event)}
                  disabled={disabled || readingFile}
                />
                <label
                  htmlFor={fileInputId}
                  className={`ca-photo-file__trigger ${disabled || readingFile ? 'ca-photo-file__trigger--disabled' : ''}`}
                >
                  <Upload size={16} aria-hidden />
                  <span className="ca-photo-file__label">
                    {readingFile ? 'Procesando…' : fileName ? fileName : 'Elegir imagen'}
                  </span>
                </label>
                <p className="ca-photo-file__hint mb-0">
                  JPG, PNG, WEBP o GIF · {maxHintLabel}
                </p>
              </div>
            </Form.Group>
          )}

          {localError ? <p className="ca-kyc-slot__error mb-0">{localError}</p> : null}
        </div>
      </div>
    </div>
  );
}
