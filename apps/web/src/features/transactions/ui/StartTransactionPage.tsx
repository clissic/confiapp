import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, OverlayTrigger, Spinner, Tooltip } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';
import { getApiErrorMessage } from '@/shared/api/client';
import {
  defaultPaymentCurrency,
  formatOperationMoney,
  PAYMENT_CURRENCY_OPTIONS,
} from '@/shared/lib/money';
import { useUserPreferences } from '@/shared/preferences';
import { useProfile } from '@/features/profile/hooks/useProfile';

import { useCreateTransaction } from '../hooks/useTransactions';
import { createTransactionSchema, type CreateTransactionValues } from '../model/schemas';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  FEE_PAYER_LABELS,
  type DeliveryLocationValue,
  type FeePayer,
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
import { ConfiAnzaBonusFields, ConfiAnzaMark } from './ConfiAnzaBonusFields';
import '../styles/transactions.css';

const DEFAULT_DELIVERY: DeliveryLocationValue = { mode: 'MAP' };

const BUYER_STEPS = [
  {
    id: 'product',
    label: 'Producto',
    title: 'Producto',
    lead: 'Describe el producto de la transacción.',
  },
  {
    id: 'price',
    label: 'Precio',
    title: 'Precio y comisión',
    lead: 'Definí el precio y quién cubre la comisión de ConfiApp.',
  },
  {
    id: 'meeting',
    label: 'Encuentro',
    title: 'Punto de encuentro',
    lead: 'Indicá dónde querés que se haga la entrega intermediada.',
  },
  {
    id: 'agent',
    label: 'Agente',
    title: 'Instrucciones al Agente',
    lead: 'El vendedor no ve estas instrucciones ni el checklist.',
  },
  {
    id: 'review',
    label: 'Revisar',
    title: 'Revisar y crear',
    lead: 'Confirmá los datos. Al crear te damos un enlace para el vendedor.',
  },
] as const;

type BuyerStepId = (typeof BUYER_STEPS)[number]['id'];

const STEP_FIELDS: Record<BuyerStepId, (keyof CreateTransactionValues)[]> = {
  product: ['productTitle', 'productDescription', 'condition', 'category'],
  price: ['amount', 'currency', 'feePayer'],
  meeting: [],
  agent: ['title', 'description', 'conditionsSummary', 'inviteExpiresInDays'],
  review: [],
};

const DELIVERY_MODE_LABELS: Record<DeliveryLocationValue['mode'], string> = {
  MAP: 'Punto en el mapa',
  HOME: 'Domicilio registrado',
  CHAT: 'Coordinar en el chat',
};

const INVITE_EXPIRES_OPTIONS = [
  { days: 1, label: '1 día' },
  { days: 3, label: '3 días' },
  { days: 5, label: '5 días' },
  { days: 7, label: '7 días' },
  { days: 10, label: '10 días' },
] as const;

function majorToCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Alta de operación como comprador — wizard de 5 pasos. */
export function StartTransactionPage() {
  const navigate = useNavigate();
  const create = useCreateTransaction();
  const { data: profileData } = useProfile();
  const profile = profileData?.profile;
  const { currency: preferredCurrency } = useUserPreferences();

  const [stepIndex, setStepIndex] = useState(0);
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
      confiAnzaAmount: undefined,
      confiAnzaCurrency: defaultPaymentCurrency(preferredCurrency),
    },
  });

  const watchedAmount = form.watch('amount');
  const watchedCurrency = form.watch('currency');
  const watchedFeePayer = form.watch('feePayer');
  const watchedConfiAnzaAmount = form.watch('confiAnzaAmount');
  const watchedConfiAnzaCurrency = form.watch('confiAnzaCurrency');
  const values = form.watch();

  const step = BUYER_STEPS[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === BUYER_STEPS.length - 1;

  const checklistPreview = useMemo(
    () => checklistItems.map((item) => item.text.trim()).filter(Boolean),
    [checklistItems],
  );

  function validateDelivery(): string | null {
    if (delivery.mode === 'MAP') {
      if (
        !delivery.meetingLocation?.label ||
        !delivery.meetingLocation.coordinates ||
        delivery.meetingLocation.coordinates.length !== 2
      ) {
        return 'Elegí un punto en el mapa o buscá una dirección.';
      }
    }
    if (delivery.mode === 'HOME') {
      if (!hasRegisteredAddress(profile)) {
        return 'Completá tu domicilio en el perfil para usar esta opción.';
      }
      if (!delivery.meetingLocation?.coordinates) {
        return 'No pudimos ubicar tu domicilio. Revisalo en el perfil o elegí otro modo.';
      }
    }
    return null;
  }

  async function goNext() {
    setError(null);
    const fields = STEP_FIELDS[step.id];
    if (fields.length > 0) {
      const ok = await form.trigger(fields);
      if (!ok) return;
    }

    if (step.id === 'meeting') {
      const deliveryError = validateDelivery();
      if (deliveryError) {
        setError(deliveryError);
        return;
      }
    }

    if (step.id === 'agent') {
      if (checklistPreview.length === 0) {
        setError('Agregá al menos un ítem en el checklist para el Agente.');
        return;
      }
    }

    setStepIndex((i) => Math.min(i + 1, BUYER_STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function goToStep(index: number) {
    if (index < stepIndex) {
      setError(null);
      setStepIndex(index);
    }
  }

  const onSubmit = form.handleSubmit(async (formValues: CreateTransactionValues) => {
    setError(null);

    const deliveryError = validateDelivery();
    if (deliveryError) {
      setError(deliveryError);
      setStepIndex(2);
      return;
    }

    const checklist = checklistDraftToPayload(checklistItems);
    if (!checklist?.length) {
      setError('Agregá al menos un ítem en el checklist para el Agente.');
      setStepIndex(3);
      return;
    }

    try {
      const result = await create.mutateAsync({
        title: formValues.title,
        description: formValues.description?.trim() || undefined,
        conditionsSummary: formValues.conditionsSummary,
        checklist,
        amount: formValues.amount,
        currency: formValues.currency,
        feePayer: formValues.feePayer,
        inviteExpiresInDays: formValues.inviteExpiresInDays,
        confiAnzaAmount: formValues.confiAnzaAmount,
        confiAnzaCurrency: formValues.confiAnzaCurrency,
        meetingLocationMode: delivery.mode,
        meetingLocation: delivery.mode === 'CHAT' ? undefined : delivery.meetingLocation,
        productTitle: formValues.productTitle,
        productDescription: formValues.productDescription,
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
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        if (isLast) void onSubmit();
        else void goNext();
      }}
      className="ca-tx ca-tx--buyer ca-tx-buyer-wizard"
      noValidate
    >
      <div className="ca-tx-buyer-wizard__intro">
        <div className="ca-tx-buyer-wizard__title-row">
          <h1 className="ca-tx-buyer-wizard__heading">Iniciar como comprador</h1>
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip id="buyer-switch-role">Cambiar rol</Tooltip>}
          >
            <Link
              to="/operaciones/nueva"
              className="ca-tx-buyer-wizard__switch"
              aria-label="Cambiar rol"
            >
              <ArrowLeftRight size={20} strokeWidth={2.25} aria-hidden />
            </Link>
          </OverlayTrigger>
        </div>
      </div>

      <nav className="ca-tx-buyer-wizard__steps-wrap" aria-label="Pasos del formulario">
        <ol className="ca-tx-steps ca-tx-buyer-wizard__steps">
          {BUYER_STEPS.map((item, index) => {
            const done = index < stepIndex;
            const active = index === stepIndex;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={[
                    'ca-tx-steps__item',
                    done ? 'ca-tx-steps__item--done' : '',
                    active ? 'ca-tx-steps__item--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!done}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => goToStep(index)}
                >
                  <span className="ca-tx-steps__num" aria-hidden>
                    {index + 1}
                  </span>
                  <span className="ca-tx-steps__label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="ca-tx-steps__current">
          Paso {stepIndex + 1} de {BUYER_STEPS.length} · {step.label}
        </p>
      </nav>

      <header className="ca-tx-buyer-wizard__step-head">
        <h2 className="ca-tx-buyer-wizard__step-title">{step.title}</h2>
        {step.lead ? <p className="ca-tx-buyer-wizard__step-lead">{step.lead}</p> : null}
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          className="ca-tx-buyer-wizard__panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
        >
              {step.id === 'product' ? (
                <div className="ca-tx-start-grid">
                  <Form.Group className="ca-tx-start-grid__full" controlId="tx-product-title">
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

                  <Form.Group className="ca-tx-start-grid__full" controlId="tx-product-desc">
                    <Form.Label>Descripción</Form.Label>
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

                  <Form.Group controlId="tx-condition">
                    <Form.Label>Condición</Form.Label>
                    <Form.Select {...form.register('condition')}>
                      {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((key) => (
                        <option key={key} value={key}>
                          {CONDITION_LABELS[key]}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  <Form.Group controlId="tx-category">
                    <Form.Label>Categoría</Form.Label>
                    <Form.Select {...form.register('category')}>
                      {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((key) => (
                        <option key={key} value={key}>
                          {CATEGORY_LABELS[key]}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </div>
              ) : null}

              {step.id === 'price' ? (
                <div className="ca-tx-buyer-wizard__stack">
                  <div className="ca-tx-start-grid ca-tx-start-grid--price">
                    <Form.Group controlId="tx-amount">
                      <Form.Label>Precio</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="1"
                        inputMode="decimal"
                        {...form.register('amount')}
                        isInvalid={Boolean(form.formState.errors.amount)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {form.formState.errors.amount?.message}
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group controlId="tx-currency">
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

                  <ConfiAnzaBonusFields
                    controlIdPrefix="tx"
                    register={form.register}
                    amountError={form.formState.errors.confiAnzaAmount}
                    disabled={create.isPending}
                  />

                  <FeePayerFields
                    controlId="tx-fee-payer"
                    feePayer={watchedFeePayer}
                    onFeePayerChange={(value) =>
                      form.setValue('feePayer', value, { shouldValidate: true })
                    }
                    priceMajor={Number(watchedAmount) || null}
                    currency={watchedCurrency}
                    confiAnzaMajor={Number(watchedConfiAnzaAmount) || null}
                    confiAnzaCurrency={watchedConfiAnzaCurrency}
                    error={form.formState.errors.feePayer?.message}
                    disabled={create.isPending}
                    viewerHint="buyer"
                  />
                </div>
              ) : null}

              {step.id === 'meeting' ? (
                <div className="ca-tx-delivery-wrap">
                  <DeliveryLocationPicker
                    value={delivery}
                    onChange={setDelivery}
                    profile={profile}
                    disabled={create.isPending}
                    hideHeader
                  />
                </div>
              ) : null}

              {step.id === 'agent' ? (
                <div className="ca-tx-start-grid">
                  <Form.Group className="ca-tx-start-grid__full" controlId="tx-title">
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

                  <Form.Group className="ca-tx-start-grid__full" controlId="tx-description">
                    <Form.Label>
                      Descripción <span className="ca-tx-start-optional">(opcional)</span>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      {...form.register('description')}
                      placeholder="Contexto breve del acuerdo"
                    />
                  </Form.Group>

                  <Form.Group className="ca-tx-start-grid__full" controlId="tx-conditions">
                    <Form.Label>Instrucciones para el Agente</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      {...form.register('conditionsSummary')}
                      placeholder="Horarios, lugares de entrega, qué verificar…"
                      isInvalid={Boolean(form.formState.errors.conditionsSummary)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {form.formState.errors.conditionsSummary?.message}
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group className="ca-tx-start-grid__full" controlId="tx-expires">
                    <Form.Label>Validez del enlace</Form.Label>
                    <div
                      className="ca-tx-invite-expires"
                      role="radiogroup"
                      aria-label="Validez del enlace"
                    >
                      {INVITE_EXPIRES_OPTIONS.map((option) => {
                        const selected = Number(values.inviteExpiresInDays) === option.days;
                        return (
                          <button
                            key={option.days}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={[
                              'ca-tx-invite-expires__btn',
                              selected ? 'is-active' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            disabled={create.isPending}
                            onClick={() =>
                              form.setValue('inviteExpiresInDays', option.days, {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {form.formState.errors.inviteExpiresInDays ? (
                      <div className="invalid-feedback d-block">
                        {form.formState.errors.inviteExpiresInDays.message}
                      </div>
                    ) : null}
                  </Form.Group>

                  <div className="ca-tx-start-grid__full">
                    <ChecklistEditor items={checklistItems} onChange={setChecklistItems} />
                  </div>
                </div>
              ) : null}

              {step.id === 'review' ? (
                <div className="ca-tx-buyer-review">
                  <section className="ca-tx-buyer-review__block">
                    <h3 className="ca-tx-buyer-review__label">Producto</h3>
                    <dl className="ca-tx-buyer-review__dl">
                      <div className="ca-tx-buyer-review__wide">
                        <dt>Título</dt>
                        <dd>{values.productTitle || '—'}</dd>
                      </div>
                      <div className="ca-tx-buyer-review__wide">
                        <dt>Descripción</dt>
                        <dd>{values.productDescription || '—'}</dd>
                      </div>
                      <div>
                        <dt>Condición</dt>
                        <dd>
                          {CONDITION_LABELS[values.condition as ProductCondition] ??
                            values.condition}
                        </dd>
                      </div>
                      <div>
                        <dt>Categoría</dt>
                        <dd>
                          {CATEGORY_LABELS[values.category as ProductCategory] ?? values.category}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="ca-tx-buyer-review__block">
                    <h3 className="ca-tx-buyer-review__label">Precio</h3>
                    <dl className="ca-tx-buyer-review__dl">
                      <div>
                        <dt>Monto</dt>
                        <dd>
                          {Number(values.amount) > 0
                            ? formatOperationMoney(
                                majorToCents(Number(values.amount)),
                                values.currency,
                              )
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Comisión</dt>
                        <dd>
                          {FEE_PAYER_LABELS[values.feePayer as FeePayer] ?? values.feePayer}
                        </dd>
                      </div>
                      {Number(values.confiAnzaAmount) > 0 ? (
                        <div className="ca-tx-buyer-review__wide">
                          <dt>
                            <ConfiAnzaMark />
                          </dt>
                          <dd>
                            {formatOperationMoney(
                              majorToCents(Number(values.confiAnzaAmount)),
                              values.confiAnzaCurrency || values.currency,
                            )}{' '}
                            <span className="text-muted">(lo pagás vos)</span>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>

                  <section className="ca-tx-buyer-review__block">
                    <h3 className="ca-tx-buyer-review__label">Encuentro</h3>
                    <dl className="ca-tx-buyer-review__dl">
                      <div className="ca-tx-buyer-review__wide">
                        <dt>Modo</dt>
                        <dd>{DELIVERY_MODE_LABELS[delivery.mode]}</dd>
                      </div>
                      {delivery.mode !== 'CHAT' && delivery.meetingLocation?.label ? (
                        <div className="ca-tx-buyer-review__wide">
                          <dt>Lugar</dt>
                          <dd>{delivery.meetingLocation.label}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>

                  <section className="ca-tx-buyer-review__block">
                    <h3 className="ca-tx-buyer-review__label">Agente</h3>
                    <dl className="ca-tx-buyer-review__dl">
                      <div className="ca-tx-buyer-review__wide">
                        <dt>Operación</dt>
                        <dd>{values.title || '—'}</dd>
                      </div>
                      {values.description?.trim() ? (
                        <div className="ca-tx-buyer-review__wide">
                          <dt>Contexto</dt>
                          <dd>{values.description}</dd>
                        </div>
                      ) : null}
                      <div className="ca-tx-buyer-review__wide">
                        <dt>Instrucciones</dt>
                        <dd>{values.conditionsSummary || '—'}</dd>
                      </div>
                      <div className="ca-tx-buyer-review__wide">
                        <dt>Checklist</dt>
                        <dd>
                          {checklistPreview.length > 0 ? (
                            <ul className="ca-tx-buyer-review__list">
                              {checklistPreview.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                      <div className="ca-tx-buyer-review__wide">
                        <dt>Validez del enlace</dt>
                        <dd>{values.inviteExpiresInDays} días</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

      <div className="ca-tx-buyer-wizard__actions">
        <Button
          type="button"
          variant="outline-secondary"
          disabled={isFirst || create.isPending}
          onClick={goBack}
        >
          Atrás
        </Button>
        {isLast ? (
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
        ) : (
          <Button type="submit" className="ca-btn-cta">
            Siguiente
          </Button>
        )}
      </div>
    </Form>
  );
}
