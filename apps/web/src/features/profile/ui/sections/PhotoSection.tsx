import { Alert, Badge, Button, Form } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';

import { useUpdateProfile } from '../../hooks/useProfile';
import { photoFormSchema, type PhotoFormValues } from '../../model/schemas';
import type { UserProfile } from '../../model/types';

export function PhotoSection({ profile }: { profile: UserProfile }) {
  const update = useUpdateProfile();
  const [feedback, setFeedback] = useState<string | null>(null);

  const form = useZodForm(photoFormSchema, {
    defaultValues: {
      url: profile.avatar ?? '',
      kind: 'AVATAR',
      isPrimary: true,
    },
  });

  useEffect(() => {
    form.reset({
      url: profile.avatar ?? '',
      kind: 'AVATAR',
      isPrimary: true,
    });
  }, [profile, form]);

  const onSubmit = form.handleSubmit(async (values: PhotoFormValues) => {
    setFeedback(null);
    const rest = profile.photos.filter((photo) => photo.url !== values.url);
    await update.mutateAsync({
      avatar: values.url,
      photos: [
        { url: values.url, kind: values.kind, isPrimary: values.isPrimary },
        ...rest.map((photo) => ({
          url: photo.url,
          kind: photo.kind,
          isPrimary: values.isPrimary ? false : photo.isPrimary,
        })),
      ],
    });
    setFeedback('Fotografía actualizada.');
  });

  return (
    <section>
      <h3 className="ca-section-title">Fotografía</h3>
      <p className="ca-section-lead">
        Avatar y galería. Pegá una URL pública (sin upload de archivos aún).
      </p>

      {feedback ? <Alert variant="success">{feedback}</Alert> : null}

      <div className="ca-photo-preview mb-3">
        {profile.avatar ? (
          <img src={profile.avatar} alt="Avatar actual" />
        ) : (
          <div className="ca-photo-preview__empty">
            <ImagePlus size={28} />
            <span>Sin fotografía</span>
          </div>
        )}
      </div>

      <Form onSubmit={onSubmit} className="ca-form-grid">
        <Form.Group controlId="photoUrl" className="ca-form-grid__full">
          <Form.Label>URL de imagen</Form.Label>
          <Form.Control
            {...form.register('url')}
            placeholder="https://…"
            isInvalid={Boolean(form.formState.errors.url)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.url?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group controlId="photoKind">
          <Form.Label>Tipo</Form.Label>
          <Form.Select {...form.register('kind')}>
            <option value="AVATAR">Avatar</option>
            <option value="PROFILE">Perfil</option>
            <option value="ID_FRONT">Documento (frente)</option>
            <option value="ID_BACK">Documento (dorso)</option>
            <option value="SELFIE">Selfie</option>
            <option value="OTHER">Otro</option>
          </Form.Select>
        </Form.Group>

        <Form.Group controlId="photoPrimary" className="d-flex align-items-end">
          <Form.Check
            type="checkbox"
            label="Usar como principal"
            checked={form.watch('isPrimary')}
            onChange={(event) =>
              form.setValue('isPrimary', event.target.checked, { shouldValidate: true })
            }
          />
        </Form.Group>

        <div className="ca-form-actions ca-form-grid__full">
          <Button type="submit" className="ca-btn-cta" disabled={update.isPending}>
            Guardar fotografía
          </Button>
        </div>
      </Form>

      {profile.photos.length > 0 ? (
        <div className="ca-photo-grid mt-4">
          {profile.photos.map((photo) => (
            <figure key={`${photo.url}-${photo.uploadedAt}`} className="ca-photo-card">
              <img src={photo.url} alt={photo.kind} />
              <figcaption>
                <Badge bg="light" text="dark">
                  {photo.kind}
                </Badge>
                {photo.isPrimary ? <Badge className="ca-badge-positive">Principal</Badge> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
