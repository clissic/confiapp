import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';

import { useZodForm } from '@/shared/lib/form';
import { getApiErrorMessage } from '@/shared/api/client';
import { defaultPaymentCurrency } from '@/shared/lib/money';
import { useUserPreferences } from '@/shared/preferences';
import { useProfile } from '@/features/profile/hooks/useProfile';

import { useCreateTransaction } from '../hooks/useTransactions';
import { createTransactionSchema, type CreateTransactionValues } from '../model/schemas';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  type DeliveryLocationValue,
  type ProductCategory,
  type ProductCondition,
} from '../model/types';
import {
  ChecklistEditor,
  checklistDraftToPayload,
  createEmptyChecklistItem,
  type ChecklistDraftItem,
} from './ChecklistEditor';
import { DeliveryLocationPicker, hasRegisteredAddress } from './DeliveryLocationPicker';
import { FeePayerFields } from './FeePayerFields';
import '../styles/transactions.css';

const DEFAULT_DELIVERY: DeliveryLocationValue = { mode: 'MAP' };

export function StartTransactionPage() {
  const navigate = useNavigate();
  const create = useCreateTransaction();
  const { data: profileData } = useProfile();
  const profile = profileData?.profile;
  const { currency: preferredCurrency } = useUserPreferences();
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryLocationValue>(DEFAULT_DELIVERY);
  const [checklistItems, setChecklistItems] = useState<ChecklistDraftItem[]>([
    createEmptyChecklistItem(),
  ]);

  const form = useZodForm(createTransactionSchema, {
    defaultValues: {
      title: '',
      description: '',
      conditionsSummary: '',
      inviteExpiresInDays: 7,
      productTitle: '',
      productDescription: '',
      condition: 'GOOD',
      category: 'OTHER',
      amount: undefined as unknown as number,
      currency: defaultPaymentCurrency(preferredCurrency),
      feePayer: 'BUYER',
    },
  });

  const watchedAmount = form.watch('amount');
  const watchedCurrency = form.watch('currency');
  const watchedFeePayer = form.watch('feePayer');

  const onSubmit = form.handleSubmit(async (values: CreateTransactionValues) => {
    setError(null);

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

    const checklist = checklistDraftToPayload(checklistItems);

    try {
      const result = await create.mutateAsync({
        title: values.title,
        description: values.description?.trim() || undefined,
        conditionsSummary: values.conditionsSummary,
        checklist,
        amount: values.amount,
        currency: values.currency,
        feePayer: values.feePayer,
        inviteExpiresInDays: values.inviteExpiresInDays,
        meetingLocationMode: delivery.mode,
        meetingLocation: delivery.mode === 'CHAT' ? undefined : delivery.meetingLocation,
        productTitle: values.productTitle,
        productDescription: values.productDescription,
      });
      navigate(`/operaciones/${result.data.code}`, {
        state: { shareUrl: result.data.invite.shareUrl, justCreated: true },
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
    <div className="ca-tx ca-tx--buyer">
      <header className="ca-tx-flow-hero">
        <div className="ca-tx-flow-hero__visual">
          <img src="/landing/Shopping.png" alt="" width={480} height={480} decoding="async" />
        </div>
        <div className="ca-tx-flow-hero__copy">
          <p className="ca-tx__kicker">Nueva operación</p>
          <h2 className="ca-tx__title">Iniciar como comprador</h2>
          <p className="ca-tx__lead">
            Definí el producto y las instrucciones para el Agente. El vendedor solo verá la
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
            Completá el acuerdo y el producto. Al crear la operación te damos un enlace para
            compartirlo con el vendedor.
          </p>
        </header>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <Form onSubmit={onSubmit} className="ca-tx-edit" noValidate>
          <fieldset className="ca-tx-fieldset">
            <legend>Acuerdo</legend>
            <div className="row g-3">
              <Form.Group className="col-12" controlId="tx-title">
                <Form.Label>Título de la operación</Form.Label>
                <Form.Control
                  {...form.register('title')}
                  placeholder="Ej. Compra de notebook usada"
                  isInvalid={Boolean(form.formState.errors.title)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.title?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="col-12" controlId="tx-description">
                <Form.Label>Descripción (opcional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  {...form.register('description')}
                  placeholder="Contexto breve del acuerdo"
                />
              </Form.Group>

              <Form.Group className="col-12 col-md-8" controlId="tx-conditions">
                <Form.Label>Instrucciones para el Agente</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  {...form.register('conditionsSummary')}
                  placeholder="Horarios disponibles, lugares de entrega, etc."
                  isInvalid={Boolean(form.formState.errors.conditionsSummary)}
                />
                <Form.Text muted>Solo las ve el Agente, no el vendedor.</Form.Text>
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.conditionsSummary?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="col-12 col-md-4" controlId="tx-expires">
                <Form.Label>Validez del enlace (días)</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={30}
                  {...form.register('inviteExpiresInDays')}
                />
              </Form.Group>

              <div className="col-12">
                <ChecklistEditor items={checklistItems} onChange={setChecklistItems} />
              </div>
            </div>
          </fieldset>

          <fieldset className="ca-tx-fieldset">
            <legend>Producto</legend>
            <p className="ca-tx-fieldset__hint">
              Esta descripción la ve el vendedor y el Agente. Condiciones, checklist y ubicación
              quedan solo para el Agente.
            </p>
            <div className="row g-3">
              <Form.Group className="col-12" controlId="tx-product-title">
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

              <Form.Group className="col-12" controlId="tx-product-desc">
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

              <Form.Group className="col-6 col-md-3" controlId="tx-condition">
                <Form.Label>Condición</Form.Label>
                <Form.Select {...form.register('condition')}>
                  {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((key) => (
                    <option key={key} value={key}>
                      {CONDITION_LABELS[key]}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="col-6 col-md-3" controlId="tx-category">
                <Form.Label>Categoría</Form.Label>
                <Form.Select {...form.register('category')}>
                  {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABELS[key]}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="col-6 col-md-3" controlId="tx-amount">
                <Form.Label>Precio</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="1"
                  {...form.register('amount')}
                  isInvalid={Boolean(form.formState.errors.amount)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.amount?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="col-6 col-md-3" controlId="tx-currency">
                <Form.Label>Moneda</Form.Label>
                <Form.Select {...form.register('currency')}>
                  <option value="UYU">UYU $</option>
                  <option value="USD">USD $</option>
                </Form.Select>
              </Form.Group>
            </div>

            <FeePayerFields
              controlId="tx-fee-payer"
              feePayer={watchedFeePayer}
              onFeePayerChange={(value) =>
                form.setValue('feePayer', value, { shouldValidate: true })
              }
              priceMajor={Number(watchedAmount) || null}
              currency={watchedCurrency}
              error={form.formState.errors.feePayer?.message}
              disabled={create.isPending}
              viewerHint="buyer"
            />
          </fieldset>

          <div className="ca-tx-delivery-wrap">
            <DeliveryLocationPicker
              value={delivery}
              onChange={setDelivery}
              profile={profile}
              disabled={create.isPending}
            />
          </div>

          <div className="ca-form-actions">
            <Button type="submit" className="ca-btn-cta" disabled={create.isPending}>
              {create.isPending ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Generando…
                </>
              ) : (
                'Generar enlace y crear'
              )}
            </Button>
          </div>
        </Form>
      </motion.div>
    </div>
  );
}
