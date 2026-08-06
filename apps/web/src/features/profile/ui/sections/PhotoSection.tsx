import { Alert, Button, Form } from 'react-bootstrap';
import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { ImagePlus, Link2, Upload } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';
import { useAppToast } from '@/shared/ui';

import { useUpdateProfile } from '../../hooks/useProfile';
import { photoFormSchema, type PhotoFormValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';

type SourceMode = 'url' | 'file';

const MAX_SOURCE_BYTES = 1 * 1024 * 1024;
const MAX_EDGE_PX = 512;
const JPEG_QUALITY = 0.82;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function fileToProfileDataUrl(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Formato no soportado. Usá JPG, PNG, WEBP o GIF.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('La imagen supera 1 MB. Elegí un archivo más liviano.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_EDGE_PX);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen.');
    ctx.drawImage(img, 0, 0, width, height);
    // GIF/PNG con transparencia → JPEG opaco (fondo blanco).
    if (file.type !== 'image/jpeg' && file.type !== 'image/webp') {
      const opaque = document.createElement('canvas');
      opaque.width = width;
      opaque.height = height;
      const octx = opaque.getContext('2d');
      if (!octx) throw new Error('No se pudo procesar la imagen.');
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, width, height);
      octx.drawImage(canvas, 0, 0);
      return opaque.toDataURL('image/jpeg', JPEG_QUALITY);
    }
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = src;
  });
}

function fitWithin(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function PhotoSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const toast = useAppToast();
  const fileInputId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceMode>('url');
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(profile.avatar ?? null);
  const [readingFile, setReadingFile] = useState(false);

  const form = useZodForm(photoFormSchema, {
    defaultValues: {
      url: profile.avatar?.startsWith('http') ? profile.avatar : '',
    },
  });

  const watchedUrl = form.watch('url');

  useEffect(() => {
    form.reset({
      url: profile.avatar?.startsWith('http') ? profile.avatar : '',
    });
    setPreview(profile.avatar ?? null);
    setFileName(null);
    setSource(profile.avatar?.startsWith('data:image/') ? 'file' : 'url');
  }, [profile, form]);

  useEffect(() => {
    if (source === 'url' && watchedUrl?.startsWith('http')) {
      setPreview(watchedUrl);
    }
  }, [source, watchedUrl]);

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setFormError(null);
    setReadingFile(true);
    try {
      const dataUrl = await fileToProfileDataUrl(file);
      form.setValue('url', dataUrl, { shouldDirty: true, shouldValidate: true });
      setPreview(dataUrl);
      setFileName(file.name);
      setSource('file');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
      setFileName(null);
      input.value = '';
    } finally {
      setReadingFile(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values: PhotoFormValues) => {
    setFormError(null);
    const otherPhotos = profile.photos.filter(
      (photo) =>
        photo.kind !== 'AVATAR' &&
        photo.kind !== 'PROFILE' &&
        photo.url !== values.url &&
        photo.url !== profile.avatar,
    );
    await update.mutateAsync({
      avatar: values.url,
      photos: [
        { url: values.url, kind: 'AVATAR', isPrimary: true },
        ...otherPhotos.map((photo) => ({
          url: photo.url,
          kind: photo.kind,
          isPrimary: false,
        })),
      ],
    });
    toast.success('Foto de perfil actualizada.');
  });

  return (
    <section>
      <h3 className="ca-section-title">Foto de perfil</h3>
      <p className="ca-section-lead">
        Esta imagen se muestra en tu perfil y en la app. Podés pegar una URL o subir un archivo.
      </p>

      {formError ? <Alert variant="danger">{formError}</Alert> : null}
      {update.isError ? <Alert variant="danger">No se pudo guardar la foto.</Alert> : null}

      <Form onSubmit={onSubmit} className="ca-photo-form">
        <div className="ca-photo-editor">
          <div className="ca-photo-preview">
            {preview ? (
              <img src={preview} alt="Vista previa de foto de perfil" />
            ) : (
              <div className="ca-photo-preview__empty">
                <ImagePlus size={28} />
                <span>Sin fotografía</span>
              </div>
            )}
          </div>

          <div className="ca-photo-editor__controls">
            <div className="ca-photo-source" role="tablist" aria-label="Origen de la imagen">
              <button
                type="button"
                role="tab"
                aria-selected={source === 'url'}
                className={`ca-photo-source__btn ${source === 'url' ? 'ca-photo-source__btn--active' : ''}`}
                onClick={() => {
                  setSource('url');
                  setFormError(null);
                  if (profile.avatar?.startsWith('http')) {
                    form.setValue('url', profile.avatar, { shouldValidate: true });
                    setPreview(profile.avatar);
                  } else {
                    form.setValue('url', '', { shouldValidate: false });
                  }
                  setFileName(null);
                }}
              >
                <Link2 size={16} aria-hidden />
                URL
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={source === 'file'}
                className={`ca-photo-source__btn ${source === 'file' ? 'ca-photo-source__btn--active' : ''}`}
                onClick={() => {
                  setSource('file');
                  setFormError(null);
                }}
              >
                <Upload size={16} aria-hidden />
                Archivo
              </button>
            </div>

            {source === 'url' ? (
              <Form.Group controlId="photoUrl" className="mb-0">
                <Form.Label className="visually-hidden">URL de imagen</Form.Label>
                <Form.Control
                  {...form.register('url')}
                  placeholder="https://…"
                  inputMode="url"
                  isInvalid={Boolean(form.formState.errors.url)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.url?.message}
                </Form.Control.Feedback>
              </Form.Group>
            ) : (
              <Form.Group controlId={fileInputId} className="mb-0">
                <Form.Label className="visually-hidden">Archivo local</Form.Label>
                <div className="ca-photo-file">
                  <input
                    id={fileInputId}
                    className="ca-photo-file__input"
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    onChange={(event) => void onPickFile(event)}
                    disabled={readingFile || update.isPending}
                  />
                  <label
                    htmlFor={fileInputId}
                    className={`ca-photo-file__trigger ${readingFile || update.isPending ? 'ca-photo-file__trigger--disabled' : ''}`}
                  >
                    <Upload size={16} aria-hidden />
                    <span className="ca-photo-file__label">
                      {readingFile
                        ? 'Procesando…'
                        : fileName
                          ? fileName
                          : 'Elegir imagen'}
                    </span>
                  </label>
                  <p className="ca-photo-file__hint mb-0">
                    JPG, PNG, WEBP o GIF · máx. 1 MB
                  </p>
                </div>
                {form.formState.errors.url && !watchedUrl ? (
                  <div className="invalid-feedback d-block">
                    {form.formState.errors.url.message}
                  </div>
                ) : null}
              </Form.Group>
            )}
          </div>
        </div>

        <div className="ca-form-actions">
          <Button
            type="submit"
            className="ca-btn-cta"
            disabled={update.isPending || readingFile || !watchedUrl}
          >
            {update.isPending ? 'Guardando…' : 'Guardar foto de perfil'}
          </Button>
        </div>
      </Form>
    </section>
  );
}
