import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { ImagePlus, Trash2 } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';
import { getApiErrorMessage } from '@/shared/api/client';
import { defaultPaymentCurrency, PAYMENT_CURRENCY_OPTIONS } from '@/shared/lib/money';
import { useUserPreferences } from '@/shared/preferences';
import { useProfile } from '@/features/profile/hooks/useProfile';

import { useCreateSellerTransaction } from '../hooks/useTransactions';
import {
  createSellerTransactionSchema,
  type CreateSellerTransactionValues,
} from '../model/schemas';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  type DeliveryLocationValue,
  type ProductCategory,
  type ProductCondition,
} from '../model/types';
import { DeliveryLocationPicker, hasRegisteredAddress } from './DeliveryLocationPicker';
import { FeePayerFields } from './FeePayerFields';
import '../styles/transactions.css';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

const DEFAULT_DELIVERY: DeliveryLocationValue = { mode: 'MAP' };

export function StartSellerTransactionPage() {
  const navigate = useNavigate();
  const create = useCreateSellerTransaction();
  const { data: profileData } = useProfile();
  const profile = profileData?.profile;
  const { currency: preferredCurrency } = useUserPreferences();
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryLocationValue>(DEFAULT_DELIVERY);
  const [images, setImages] = useState<Array<{ url: string; alt?: string }>>([]);

  const form = useZodForm(createSellerTransactionSchema, {
    defaultValues: {
      title: '',
      description: '',
      conditionsSummary: '',
      inviteExpiresInDays: 7,
      productTitle: '',
      productDescription: '',
      condition: 'GOOD',
      category: 'OTHER',
      price: undefined as unknown as number,
      currency: defaultPaymentCurrency(preferredCurrency),
      feePayer: 'BUYER',
      imageUrl: '',
      returnInstructions: '',
    },
  });

  const watchedPrice = form.watch('price');
  const watchedCurrency = form.watch('currency');
  const watchedFeePayer = form.watch('feePayer');

  const addImage = () => {
    setError(null);
    const url = (form.getValues('imageUrl') || '').trim();
    if (!url) {
      setError('Pegá una URL de imagen');
      return;
    }
    if (!isHttpUrl(url) && !url.startsWith('data:image/')) {
      setError('La foto debe ser una URL http(s) o data:image');
      return;
    }
    if (images.some((img) => img.url === url)) {
      setError('Esa foto ya está en la lista');
      return;
    }
    setImages((prev) => [...prev, { url }]);
    form.setValue('imageUrl', '');
  };

  const onFileSelected = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes');
      return;
    }
    if (file.size > 1_200_000) {
      setError('La imagen local debe pesar menos de 1.2 MB (o usá una URL)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) {
        setError('No se pudo leer la imagen');
        return;
      }
      setImages((prev) => [...prev, { url: result, alt: file.name }]);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = form.handleSubmit(async (values: CreateSellerTransactionValues) => {
    setError(null);
    if (images.length < 1) {
      setError('Agregá al menos una foto del producto');
      return;
    }

    if (delivery.mode === 'MAP') {
      if (
        !delivery.meetingLocation?.label ||
        !delivery.meetingLocation.coordinates ||
        delivery.meetingLocation.coordinates.length !== 2
      ) {
        setError('Elegí un punto en el mapa o buscá una dirección.');
        return;
      }
    }
    if (delivery.mode === 'HOME') {
      if (!hasRegisteredAddress(profile)) {
        setError('Completá tu domicilio en el perfil para usar esta opción.');
        return;
      }
      if (!delivery.meetingLocation?.coordinates) {
        setError('No pudimos ubicar tu domicilio. Revisalo en el perfil o elegí otro modo.');
        return;
      }
    }

    try {
      const result = await create.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        conditionsSummary: values.conditionsSummary,
        inviteExpiresInDays: values.inviteExpiresInDays,
        meetingLocationMode: delivery.mode,
        meetingLocation: delivery.mode === 'CHAT' ? undefined : delivery.meetingLocation,
        returnInstructions: values.returnInstructions,
        feePayer: values.feePayer,
        product: {
          title: values.productTitle,
          description: values.productDescription,
          condition: values.condition as ProductCondition,
          category: values.category as ProductCategory,
          price: values.price,
          currency: values.currency,
          images,
        },
      });
      navigate(`/operaciones/${result.data.code}`, {
        state: {
          shareUrl: result.data.invite.shareUrl,
          justCreated: true,
          initiatedBySeller: true,
        },
      });
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'No se pudo crear la operación. Revisá los datos e intentá de nuevo.',
        ),
      );
    }
  });

  return (
    <div className="ca-tx ca-tx--seller">
      <header className="ca-tx-flow-hero">
        <div className="ca-tx-flow-hero__visual">
          <img src="/landing/Sale.png" alt="" width={480} height={480} decoding="async" />
        </div>
        <div className="ca-tx-flow-hero__copy">
          <p className="ca-tx__kicker">Nueva operación</p>
          <h2 className="ca-tx__title">Iniciar como vendedor</h2>
          <p className="ca-tx__lead">
            Cargá el producto y las instrucciones para el Agente. El comprador solo verá la
            descripción del producto; el resto llega al Agente.
          </p>
          <Link
            to="/operaciones/nueva"
            className="btn btn-outline-secondary ca-tx-flow-hero__action"
          >
            Cambiar rol
          </Link>
        </div>
      </header>

      <motion.div
        className="ca-tx-panel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <header className="ca-tx-panel__head">
          <h3 className="ca-section-title">Datos de la operación</h3>
          <p className="ca-section-lead ca-section-lead--soft-emphasis">
            Completá el producto y el acuerdo. Al crear la operación te damos un enlace para
            compartirlo con el comprador.
          </p>
        </header>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <Form onSubmit={onSubmit} className="ca-tx-edit" noValidate>
          <fieldset className="ca-tx-fieldset">
            <legend>Acuerdo</legend>
            <div className="row g-3">
              <Form.Group className="col-12" controlId="seller-tx-title">
                <Form.Label>Título de la operación</Form.Label>
                <Form.Control
                  {...form.register('title')}
                  placeholder="Ej. Venta de notebook usada"
                  isInvalid={Boolean(form.formState.errors.title)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.title?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="col-12" controlId="seller-tx-desc">
                <Form.Label>Descripción (opcional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  {...form.register('description')}
                  placeholder="Contexto breve del acuerdo"
                />
              </Form.Group>

              <Form.Group className="col-12 col-md-8" controlId="seller-tx-conditions">
                <Form.Label>Instrucciones para el Agente</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  {...form.register('conditionsSummary')}
                  placeholder="Horarios disponibles, lugares de entrega, etc."
                  isInvalid={Boolean(form.formState.errors.conditionsSummary)}
                />
                <Form.Text muted>Solo las ve el Agente, no el comprador.</Form.Text>
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.conditionsSummary?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="col-12 col-md-4" controlId="seller-tx-expires">
                <Form.Label>Validez del enlace (días)</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={30}
                  {...form.register('inviteExpiresInDays')}
                />
              </Form.Group>
            </div>
          </fieldset>

          <fieldset className="ca-tx-fieldset">
            <legend>Producto</legend>
            <div className="row g-3">
              <Form.Group className="col-12" controlId="seller-product-title">
                <Form.Label>Título del producto</Form.Label>
                <Form.Control
                  {...form.register('productTitle')}
                  placeholder="Ej. Notebook Lenovo ThinkPad"
                  isInvalid={Boolean(form.formState.errors.productTitle)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.productTitle?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="col-12" controlId="seller-product-desc">
                <Form.Label>Descripción del producto</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  {...form.register('productDescription')}
                  placeholder="Estado, accesorios, detalles relevantes…"
                  isInvalid={Boolean(form.formState.errors.productDescription)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.productDescription?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="col-6 col-md-3" controlId="seller-condition">
                <Form.Label>Condición</Form.Label>
                <Form.Select {...form.register('condition')}>
                  {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((key) => (
                    <option key={key} value={key}>
                      {CONDITION_LABELS[key]}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="col-6 col-md-3" controlId="seller-category">
                <Form.Label>Categoría</Form.Label>
                <Form.Select {...form.register('category')}>
                  {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABELS[key]}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="col-6 col-md-3" controlId="seller-price">
                <Form.Label>Precio</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="1"
                  {...form.register('price')}
                  isInvalid={Boolean(form.formState.errors.price)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.price?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="col-6 col-md-3" controlId="seller-currency">
                <Form.Label>Moneda</Form.Label>
                <Form.Select {...form.register('currency')}>
                  {PAYMENT_CURRENCY_OPTIONS.map((option) => (
                    <option
                      key={option.code}
                      value={option.code}
                      disabled={option.disabled}
                    >
                      {option.label}
                      {option.disabled ? ' (próximamente)' : ''}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>

            <FeePayerFields
              controlId="seller-fee-payer"
              feePayer={watchedFeePayer}
              onFeePayerChange={(value) =>
                form.setValue('feePayer', value, { shouldValidate: true })
              }
              priceMajor={Number(watchedPrice) || null}
              currency={watchedCurrency}
              error={form.formState.errors.feePayer?.message}
              disabled={create.isPending}
              viewerHint="seller"
            />
          </fieldset>

          <fieldset className="ca-tx-fieldset ca-tx-photos">
            <legend>Fotos</legend>
            <p className="ca-tx-fieldset__hint">
              Agregá al menos una foto por URL o desde tu dispositivo.
            </p>
            <div className="ca-tx-photos__add">
              <Form.Control
                {...form.register('imageUrl')}
                placeholder="https://…"
                aria-label="URL de foto"
              />
              <Button type="button" variant="outline-primary" onClick={addImage}>
                <ImagePlus size={16} className="me-1" />
                Agregar
              </Button>
            </div>
            <Form.Control
              type="file"
              accept="image/*"
              className="mt-2"
              onChange={(event) => {
                const input = event.currentTarget as unknown as HTMLInputElement;
                onFileSelected(input.files);
              }}
            />
            {images.length ? (
              <ul className="ca-tx-photos__grid">
                {images.map((img) => (
                  <li key={img.url}>
                    <img src={img.url} alt={img.alt || 'Foto'} />
                    <button
                      type="button"
                      aria-label="Quitar foto"
                      onClick={() =>
                        setImages((prev) => prev.filter((item) => item.url !== img.url))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </fieldset>

          <div className="ca-tx-delivery-wrap">
            <DeliveryLocationPicker
              value={delivery}
              onChange={setDelivery}
              profile={profile}
              disabled={create.isPending}
            />
          </div>

          <fieldset className="ca-tx-fieldset">
            <legend>Devolución</legend>
            <p className="ca-tx-fieldset__hint">
              Indicále al Agente cómo devolver tu producto si el comprador lo rechaza en la
              entrega personal. Solo lo ve el Agente.
            </p>
            <Form.Group controlId="seller-return-instructions">
              <Form.Label>Instrucciones para el Agente</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                {...form.register('returnInstructions')}
                placeholder="Ej. Devolver en el mismo punto, embalar con el packaging original, coordinar retiro en domicilio…"
                isInvalid={Boolean(form.formState.errors.returnInstructions)}
              />
              <Form.Control.Feedback type="invalid">
                {form.formState.errors.returnInstructions?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </fieldset>

          <div className="ca-form-actions">
            <Button type="submit" className="ca-btn-cta" disabled={create.isPending}>
              {create.isPending ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Generando…
                </>
              ) : (
                'Generar enlace para el comprador'
              )}
            </Button>
          </div>
        </Form>
      </motion.div>
    </div>
  );
}
